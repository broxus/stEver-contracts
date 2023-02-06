import { Contract, Signer, toNano } from "locklift";
import { User } from "../utils/entities/user";
import { Governance } from "../utils/entities/governance";
import { TokenRootUpgradeableAbi } from "../build/factorySource";
import { Vault } from "../utils/entities/vault";
import { StrategyFactory } from "../utils/entities/strategyFactory";
import { preparation } from "./preparation";
import { expect } from "chai";
import { concatMap, from, lastValueFrom, map, mergeMap, range, switchMap, timer, toArray } from "rxjs";
import { createAndRegisterStrategy } from "../utils/highOrderUtils";

let signer: Signer;
let admin: User;
let governance: Governance;
let user1: User;
let user2: User;
let user3: User;
let tokenRoot: Contract<TokenRootUpgradeableAbi>;
let vault: Vault;
let strategyFactory: StrategyFactory;
describe("Upgrade testing", function () {
  before(async () => {
    const {
      vault: v,
      tokenRoot: tr,
      signer: s,
      users: [adminUser, _, u1, u2, u3],
      governance: g,
      strategyFactory: sf,
    } = await preparation({ deployUserValue: locklift.utils.toNano(2000), vaultVersion: "OldVaultVersion" });
    signer = s;
    vault = v;
    admin = adminUser;
    governance = g;
    user1 = u1;
    user2 = u2;
    user3 = u3;
    tokenRoot = tr;
    strategyFactory = sf;
  });
  it("users should deposit to the StEverVault and make withdraw requests", async () => {
    const users1 = [user1, user2, user3];
    await lastValueFrom(
      from(users1).pipe(
        concatMap(user =>
          from(user.depositToVault(toNano(100))).pipe(concatMap(() => user.makeWithdrawRequest(toNano(20)))),
        ),
      ),
    );
  });
  it("new account code should set", async () => {
    await vault.setNewAccountCode();
  });
  it("user should upgrade his code", async () => {
    const upgradedUser = await user1.getUpgradedUserData();
    expect(await upgradedUser.checkIsUpdateApplied().then(({ value0 }) => value0.version)).to.be.eq("1");
    user1 = upgradedUser;
  });
  it("upgraded user should make new withdraw request", async () => {
    await user1.makeWithdrawRequest(toNano(20));
    expect(await user1.getWithdrawRequests().then(res => res.length)).to.be.eq(
      2,
      "user should have both withdraw requests",
    );
  });

  it("two users should be upgraded by the admin", async () => {
    await lastValueFrom(timer(1000));
    const users = [user2, user3];
    const upgradedUsersData = await lastValueFrom(
      from(users).pipe(
        toArray(),
        concatMap(() => admin.upgradeAccounts(users.map(user => user.account.address))),
        switchMap(() => from(users.map(user => user.getUpgradedUser()))),
        mergeMap(user => user.checkIsUpdateApplied()),
        toArray(),
      ),
    );
    upgradedUsersData.forEach(({ value0: { version } }) => {
      expect(version).to.be.eq("1");
    });
  });
  // TODO outdated
  it.skip("should have error 9, deserialization error", async () => {
    const { traceTree } = await locklift.tracing.trace(
      vault.vaultContract.methods
        .onAcceptTokensBurn({
          value0: 0,
          payload: "",
          wallet: vault.tokenWallet.walletContract.address,
          value1: vault.vaultContract.address,
          value3: vault.vaultContract.address,
        })
        .send({
          from: user1.account.address,
          amount: toNano(1),
        }),
      { raise: false },
    );
    await traceTree?.beautyPrint();
    expect(traceTree).to.be.error(9);
  });
  it("should vault be upgraded", async () => {
    const NEW_VERSION = 1;
    const upgradedVault = await vault.upgradeVault(NEW_VERSION, "StEverVault");
    vault = upgradedVault;
    governance.setUpgradedVault(upgradedVault);
  });
  it("should have error 1032, not token root", async () => {
    const { traceTree } = await locklift.tracing.trace(
      vault.vaultContract.methods
        .onAcceptTokensBurn({
          value0: 0,
          payload: "",
          wallet: vault.tokenWallet.walletContract.address,
          value1: vault.vaultContract.address,
          value3: vault.vaultContract.address,
        })
        .send({
          from: user1.account.address,
          amount: toNano(1),
        }),
      { raise: false },
    );
    expect(traceTree).to.be.error(1032);
  });
  it("should governance withdraw all pending", async () => {
    const users = [user1, user2, user3];
    const withdrawals = await lastValueFrom(
      from(users).pipe(
        mergeMap(user =>
          from(user.getWithdrawRequests()).pipe(
            map(pendingWithdrawals => ({ pendingWithdrawals, userAddress: user.account.address })),
          ),
        ),
        toArray(),
      ),
    );
    const { transaction } = await governance.emitWithdraw({
      sendConfig: withdrawals.map(({ pendingWithdrawals, userAddress }) => [
        userAddress,
        { nonces: pendingWithdrawals.map(({ nonce }) => nonce) },
      ]),
    });
    const withdrawEvents = await vault.getEventsAfterTransaction({
      eventName: "WithdrawSuccess",
      parentTransaction: transaction,
    });
    expect(withdrawEvents.length).to.be.eq(3);
  });
});
