import { Address, Contract, Signer } from "locklift";
import { TokenRootUpgradeableAbi } from "../build/factorySource";
import { expect } from "chai";
import { assertEvent, getAddressEverBalance, getBalance, getBalances, toNanoBn } from "../utils";
import { User } from "../utils/entities/user";
import { preparation } from "./preparation";
import { Governance } from "../utils/entities/governance";
import { DePoolStrategyWithPool } from "../utils/entities/dePoolStrategy";
import { createAndRegisterStrategy } from "../utils/highOrderUtils";
import { Vault } from "../utils/entities/vault";
import BigNumber from "bignumber.js";
import { GAIN_FEE } from "../utils/constants";
import { StrategyFactory } from "../utils/entities/strategyFactory";
import { concatMap, from, lastValueFrom, map, range, toArray } from "rxjs";
import { intersectionWith } from "lodash";

let signer: Signer;
let admin: User;
let governance: Governance;
let user1: User;
let user2: User;
let user3: User;
let user4: User;
let tokenRoot: Contract<TokenRootUpgradeableAbi>;
let vault: Vault;
let strategiesWithPool: Array<DePoolStrategyWithPool> = [];
let strategyFactory: StrategyFactory;

describe("Multi flow", async function () {
  before(async () => {
    const {
      vault: v,
      tokenRoot: tr,
      signer: s,
      users: [adminUser, u1, u2, u3, u4],
      governance: g,
      strategyFactory: st,
    } = await preparation({ deployUserValue: locklift.utils.toNano(200), countOfUsers: 6 });
    signer = s;
    vault = v;
    admin = adminUser;
    governance = g;
    user1 = u1;
    user2 = u2;
    user3 = u3;
    user4 = u4;
    tokenRoot = tr;
    strategyFactory = st;
  });
  it("Vault should be initialized", async () => {
    await vault.setStEverFeePercent({
      percentFee: 12,
    });
  });
  it("should strategies deployed", async () => {
    strategiesWithPool.push(
      ...(await lastValueFrom(
        range(3).pipe(
          concatMap(() =>
            createAndRegisterStrategy({
              admin: admin.account,
              vault,
              signer,
              poolDeployValue: locklift.utils.toNano(200),
              strategyDeployValue: locklift.utils.toNano(12),
              strategyFactory,
            }),
          ),
          map(({ strategy }) => strategy),
          toArray(),
        ),
      )),
    );
  });
  it("users should deposit to vault", async () => {
    const DEPOSIT_TO_STRATEGIES_AMOUNT = toNanoBn(100);
    await lastValueFrom(
      from([user1, user2, user3, user4]).pipe(
        concatMap(user => user.depositToVault(DEPOSIT_TO_STRATEGIES_AMOUNT.toString())),
      ),
    );
  });
  it("governance should deposit to strategies", async () => {
    const DEPOSIT_TO_STRATEGIES_AMOUNT = toNanoBn(130);
    const DEPOSIT_FEE = toNanoBn(0.6);
    console.log(`vault balance before ${await getAddressEverBalance(vault.vaultContract.address)}`);
    await governance.depositToStrategies({
      _depositConfigs: strategiesWithPool.map(({ strategy }) => [
        strategy.address,
        {
          amount: DEPOSIT_TO_STRATEGIES_AMOUNT.minus(DEPOSIT_FEE).toString(),
          fee: DEPOSIT_FEE.toString(),
        },
      ]),
    });
    console.log(`vault balance after ${await getAddressEverBalance(vault.vaultContract.address)}`);
  });
  it("round should completed", async () => {
    const stateBefore = await vault.getDetails();
    const ROUND_REWARD = toNanoBn(123);
    const EXPECTED_REWARD = new BigNumber(ROUND_REWARD)
      .minus(stateBefore.gainFee)
      .minus(ROUND_REWARD.multipliedBy(stateBefore.stEverFeePercent).dividedBy(100));
    await lastValueFrom(
      from(strategiesWithPool).pipe(concatMap(strategy => strategy.emitDePoolRoundComplete(ROUND_REWARD.toString()))),
    );

    const { events } = await vault.vaultContract.getPastEvents({ filter: ({ event }) => event === "StrategyReported" });
    assertEvent(events, "StrategyReported");
    expect(events.length).to.equal(strategiesWithPool.length);
    expect(
      intersectionWith(
        events.map(event => event.data.strategy),
        strategiesWithPool.map(({ strategy }) => strategy.address),
        (address1, address2) => address1.equals(address2),
      ).length,
    ).to.be.equals(strategiesWithPool.length, "All strategies should be reported");

    events.forEach(event => {
      expect(event.data.report.gain).to.be.equals(EXPECTED_REWARD.toString(), "Gain should be correct");
    });

    const stateAfter = await vault.getDetails();
    expect(stateAfter.totalAssets.toString()).equals(
      EXPECTED_REWARD.times(strategiesWithPool.length).plus(stateBefore.totalAssets).toString(),
      "total assets should be increased by reward",
    );
    expect(stateAfter.stEverSupply.toNumber()).equals(
      stateBefore.stEverSupply.toNumber(),
      "stever supply should be unchanged",
    );
  });

  it("should successfully withdraw from strategies", async () => {
    const WITHDRAW_AMOUNT = toNanoBn(250);
    const FEE_AMOUNT = toNanoBn(0.1);
    const { availableAssets: availableBalanceBefore } = await vault.getDetails();
    const withdrawSuccessEvents = await governance.withdrawFromStrategiesRequest({
      _withdrawConfig: strategiesWithPool.map(({ strategy }) => [
        strategy.address,
        {
          amount: WITHDRAW_AMOUNT.toString(),
          fee: FEE_AMOUNT.toString(),
        },
      ]),
    });

    await lastValueFrom(from(strategiesWithPool).pipe(concatMap(dePool => dePool.emitWithdrawByRequests())));
    const { availableAssets: availableBalanceAfter } = await vault.getDetails();

    expect(availableBalanceAfter.toNumber()).to.be.gt(
      availableBalanceBefore
        .plus(WITHDRAW_AMOUNT.times(strategiesWithPool.length))
        .minus(FEE_AMOUNT.times(strategiesWithPool.length))
        .toNumber(),
      "available balance should be increased by withdraw amount minus some fee",
    );

    expect(availableBalanceAfter.toNumber()).to.be.lt(
      availableBalanceBefore
        .plus(WITHDRAW_AMOUNT.times(strategiesWithPool.length).plus(FEE_AMOUNT.times(strategiesWithPool.length)))
        .toNumber(),
      "vault should pay some fees for withdrawing",
    );
  });
  it("users should receive requested amount + reward + fee", async () => {
    const users = [user1, user2, user3, user4];
    const balancesBefore = await getBalances(users.map(user => user.account.address));

    const withdrawalRate = await vault.getRate();
    const WITHDRAW_AMOUNT_FOR_EACH_REQUEST = toNanoBn(20);
    const COUNT_OF_REQUESTS = 4;
    const expectedAmountToReceive = WITHDRAW_AMOUNT_FOR_EACH_REQUEST.times(COUNT_OF_REQUESTS)
      .times(withdrawalRate)
      //minus 1 ever for fees
      .minus(toNanoBn(1));

    const withdrawNonces = await lastValueFrom(
      //4 users
      from(users).pipe(
        //each user makes COUNT_OF_REQUESTS withdraw requests
        concatMap(user =>
          range(COUNT_OF_REQUESTS).pipe(
            concatMap(() => user.makeWithdrawRequest(WITHDRAW_AMOUNT_FOR_EACH_REQUEST.toString())),
            map(({ nonce }) => nonce),
            toArray(),
            map(nonces => ({ user, nonces })),
          ),
        ),
        toArray(),
      ),
    );
    await governance.emitWithdraw({
      sendConfig: withdrawNonces.map(({ nonces, user }) => [user.account.address, { nonces }]),
    });

    const balancesAfterWithdraw = await getBalances(users.map(user => user.account.address));

    balancesAfterWithdraw.forEach((balanceAfter, index) => {
      expect(balanceAfter.toNumber()).to.be.gt(
        balancesBefore[index].plus(expectedAmountToReceive).toNumber(),
        "user should receive deposited amount + reward",
      );
    });
  });
  it("admin should withdraw fees", async () => {
    const MAX_FEE = toNanoBn(1);
    const vaultDetailsBefore = await vault.getDetails();
    const adminBalanceBefore = await getBalance(admin.account.address);
    const withdrawingAmount = vaultDetailsBefore.totalStEverFee;
    const { transaction } = await locklift.tracing.trace(
      governance.withdrawFee({ amount: withdrawingAmount.toNumber() }),
    );
    const [event] = await vault.getEventsAfterTransaction({
      eventName: "WithdrawFee",
      parentTransaction: transaction,
    });
    const expectedMinAdminBalanceAfterWithdraw = adminBalanceBefore
      .minus(MAX_FEE)
      .plus(vaultDetailsBefore.totalStEverFee);

    const adminBalanceAfter = await getBalance(admin.account.address);
    const vaultDetailsAfter = await vault.getDetails();

    expect(withdrawingAmount.toString()).to.be.equals(event.data.amount, "event should emitted with right amount");

    expect(adminBalanceAfter.toNumber()).to.be.gt(
      expectedMinAdminBalanceAfterWithdraw.toNumber(),
      "admin balance should increased after fee withdraw",
    );

    expect(vaultDetailsBefore.totalStEverFee.minus(event.data.amount).toNumber()).to.be.equals(
      vaultDetailsAfter.totalStEverFee.toNumber(),
      "totalStEverFee should be reduced by withdraw value",
    );

    expect(vaultDetailsAfter.totalStEverFee.toNumber()).to.be.equals(0, "Full amount of stEverFee should be withdrawn");
  });
});
