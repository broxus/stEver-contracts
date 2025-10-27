import { Contract, Signer, toNano } from "locklift";
import { TokenRootUpgradeableAbi } from "../build/factorySource";
import { expect } from "chai";
import {
  assertEvent,
  convertEverGas,
  getAddressEverBalance,
  getBalance,
  getBalances,
  toNanoBn,
  userWithdrawMsgValue,
} from "../utils";
import { User } from "../utils/entities/user";
import { preparation } from "./preparation";
import { Governance } from "../utils/entities/governance";
import { createControllers, DePoolStrategyWithPool } from "../utils/entities/dePoolStrategy";
import { createAndRegisterStrategy } from "../utils/highOrderUtils";
import { Vault } from "../utils/entities/vault";
import BigNumber from "bignumber.js";
import { StrategyFactory } from "../utils/entities/strategyFactory";
import { concatMap, defer, from, lastValueFrom, map, range, switchMap, toArray } from "rxjs";
import { Cluster } from "../utils/entities/cluster";
import { Controller } from "../utils/controller";
import { Elector } from "../utils/elector";
import { HANDLING_REPAY_LOAN_FEE, MIN_CALL_MSG_VALUE } from "../utils/constants";

let signer: Signer;
let admin: User;
let governance: Governance;
let user1: User;
let user2: User;
let user3: User;
let user4: User;
let tokenRoot: Contract<TokenRootUpgradeableAbi>;
let vault: Vault;
let controllers: Array<Controller> = [];
let strategyFactory: StrategyFactory;
let elector: Elector;
const MIN_STAKE_TO_SEND = 50_000;

describe("Multi flow", async function () {
  before(async () => {
    const {
      vault: v,
      tokenRoot: tr,
      signer: s,
      users: [adminUser, u1, u2, u3, u4],
      governance: g,
      strategyFactory: st,
      elector: e,
    } = await preparation({ deployUserValue: locklift.utils.toNano(MIN_STAKE_TO_SEND * 10), countOfUsers: 6 });
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
    elector = e;
  });
  it("Vault should be initialized", async () => {
    await vault.setStEverFeePercent({
      percentFee: 12,
    });
  });
  it("should strategies deployed", async () => {
    const cluster = await Cluster.create({
      vault,
      clusterOwner: admin.account,
      assurance: toNano(0),
      maxStrategiesCount: 100,
    });

    controllers = await createControllers({
      count: 3,
      cluster,
      validator: admin.account.address,
    });
  });
  it("users should deposit to vault", async () => {
    const DEPOSIT_TO_STRATEGIES_AMOUNT = toNanoBn(MIN_STAKE_TO_SEND);
    await lastValueFrom(
      from([user1, user2, user3, user4]).pipe(
        concatMap(user => user.depositToVault(DEPOSIT_TO_STRATEGIES_AMOUNT.toString())),
      ),
    );
  });
  it("controllers should receive loan", async () => {
    for (let controller of controllers) {
      await controller.sendRequestLoan({
        queryId: 1,
        minLoan: toNano(1),
        maxLoan: toNano(MIN_STAKE_TO_SEND),
        maxInterest: "0",
      });
    }
  });
  it("round should completed", async () => {
    const stateBefore = await vault.getDetails();
    const ROUND_REWARD = toNanoBn(123);
    await elector.setReward(ROUND_REWARD.toString());
    const EXPECTED_REWARD = new BigNumber(ROUND_REWARD)
      .minus(stateBefore.gainFee)
      .minus(ROUND_REWARD.multipliedBy(stateBefore.stEverFeePercent).dividedBy(1000));
    const { availableAssets: availableBalanceBefore } = await vault.getDetails();

    for (let controller of controllers) {
      const { recoverStakeTraceTree } = await controller.runFullCycle({
        queryId: 1,
        adnlAddr: "0x1",
        stakeAt: 152,
        valueToStake: toNano(MIN_STAKE_TO_SEND),
        validatorPubKey: "0x1",
        maxFactor: 1,
      });
      expect(recoverStakeTraceTree).to.emit("StrategyRepayLoan").withNamedArgs({
        strategy: controller.controllerContract.address,
        reward: EXPECTED_REWARD.toString(),
      });
    }

    const stateAfter = await vault.getDetails();
    expect(stateAfter.totalAssets.toString()).equals(
      EXPECTED_REWARD.times(controllers.length).plus(stateBefore.totalAssets).toString(),
      "total assets should be increased by reward",
    );
    expect(stateAfter.stEverSupply.toNumber()).equals(
      stateBefore.stEverSupply.toNumber(),
      "stever supply should be unchanged",
    );

    const { availableAssets: availableBalanceAfter } = await vault.getDetails();

    expect(availableBalanceAfter.toNumber()).eq(
      availableBalanceBefore
        .plus(ROUND_REWARD.times(controllers.length))
        .plus(toNanoBn(MIN_STAKE_TO_SEND).times(controllers.length))
        .minus(toNanoBn(HANDLING_REPAY_LOAN_FEE).times(controllers.length))
        .toNumber(),
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
      .minus(Number(userWithdrawMsgValue) * COUNT_OF_REQUESTS);

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
    const {
      traceTree,
      transaction: { id, inMessage },
    } = await governance.emitWithdraw({
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
    const MAX_FEE = toNanoBn(convertEverGas(0.04));
    const vaultDetailsBefore = await vault.getDetails();
    const adminBalanceBefore = await getBalance(admin.account.address);
    const withdrawingAmount = vaultDetailsBefore.totalStEverFee;
    const transaction = await locklift.tracing.trace(
      vault.vaultContract.methods.withdrawStEverFee({ _amount: withdrawingAmount.toNumber() }).send({
        from: admin.account.address,
        amount: toNano(convertEverGas(MIN_CALL_MSG_VALUE)),
      }),
    );
    await transaction.traceTree?.beautyPrint();
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
