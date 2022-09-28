import { Contract, Signer, toNano } from "locklift";
import { UpgradedUser, User } from "../utils/entities/user";
import { Governance } from "../utils/entities/governance";
import { TokenRootUpgradeableAbi } from "../build/factorySource";
import { Vault } from "../utils/entities/vault";
import { StrategyFactory } from "../utils/entities/strategyFactory";
import { DePoolStrategyWithPool } from "../utils/entities/dePoolStrategy";
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
let strategies: DePoolStrategyWithPool[] = [];
describe("Withdraw extra testing", function () {
  before(async () => {
    const {
      vault: v,
      tokenRoot: tr,
      signer: s,
      users: [adminUser, _, u1, u2, u3],
      governance: g,
      strategyFactory: sf,
    } = await preparation({ deployUserValue: locklift.utils.toNano(2000) });
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

  it("two users should deposit to vault and make withdraw requests", async () => {
    await lastValueFrom(timer(1000));
    const users = [user2, user3];
    const upgradedUsersData = await lastValueFrom(
      from(users).pipe(
        concatMap(() => user1.upgradeAccounts(users.map(user => user.account.address))),
        switchMap(() => from(users.map(user => user.getUpgradedUser()))),
        mergeMap(user => user.checkIsUpdateApplied()),
        toArray(),
      ),
    );
    upgradedUsersData.forEach(({ value0: { version } }) => {
      expect(version).to.be.eq("1");
    });
  });
});
