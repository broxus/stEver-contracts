import { Contract, Signer, toNano } from "locklift";
import { TokenRootUpgradeableAbi } from "../build/factorySource";
import { expect } from "chai";
import { toNanoBn } from "../utils";
import { User } from "../utils/entities/user";
import { preparation } from "./preparation";
import { Governance } from "../utils/entities/governance";
import { createControllers, DePoolStrategyWithPool } from "../utils/entities/dePoolStrategy";
import { makeWithdrawToUsers } from "../utils/highOrderUtils";
import { Vault } from "../utils/entities/vault";
import BigNumber from "bignumber.js";
import { StrategyFactory } from "../utils/entities/strategyFactory";
import { Cluster } from "../utils/entities/cluster";
import { Controller } from "../utils/controller";
import { Elector } from "../utils/elector";

let signer: Signer;
let admin: User;
let governance: Governance;
let user1: User;
let user2: User;
let tokenRoot: Contract<TokenRootUpgradeableAbi>;
let vault: Vault;
let controllers: Array<Controller> = [];
let strategyFactory: StrategyFactory;
let cluster: Cluster;
let elector: Elector;
const MIN_STAKE_TO_SEND = 50_000;

describe("Single flow", async function () {
  before(async () => {
    const {
      vault: v,
      tokenRoot: tr,
      signer: s,
      users: [adminUser, _, u1, u2],
      governance: g,
      strategyFactory: st,
      elector: e,
    } = await preparation({ deployUserValue: locklift.utils.toNano(MIN_STAKE_TO_SEND * 10) });
    signer = s;
    vault = v;
    admin = adminUser;
    governance = g;
    user1 = u1;
    user2 = u2;
    tokenRoot = tr;
    strategyFactory = st;
    elector = e;
  });
  it("Vault should be initialized", async () => {
    await vault.setStEverFeePercent({
      percentFee: 11,
    });
    cluster = await Cluster.create({
      vault,
      clusterOwner: admin.account,
      assurance: toNano(0),
      maxStrategiesCount: 10,
    });
  });
  it("should strategy deployed", async () => {
    controllers = await createControllers({
      count: 1,
      cluster,
      validator: admin.account.address,
    });
  });
  it("user should deposit to vault", async () => {
    await user1.depositToVault(locklift.utils.toNano(MIN_STAKE_TO_SEND));
  });
  it("controller should receive loan", async () => {
    await controllers[0].sendRequestLoan({
      queryId: 1,
      minLoan: toNano(1),
      maxLoan: toNano(MIN_STAKE_TO_SEND),
      maxInterest: "0",
    });
  });
  it("round should completed", async () => {
    const stateBefore = await vault.getDetails();
    const ROUND_REWARD = toNanoBn(3);
    await elector.setReward(ROUND_REWARD.toString());

    const EXPECTED_REWARD = new BigNumber(ROUND_REWARD)
      .minus(stateBefore.gainFee)
      .minus(ROUND_REWARD.multipliedBy(stateBefore.stEverFeePercent).dividedBy(1000));
    const { recoverStakeTraceTree } = await controllers[0].runFullCycle({
      queryId: 1,
      validatorPubKey: "0x1",
      stakeAt: 152,
      adnlAddr: "0x1",
      maxFactor: 1,
      valueToStake: toNano(MIN_STAKE_TO_SEND),
    });
    console.log(JSON.stringify(stateBefore, null, 4));

    expect(recoverStakeTraceTree).to.emit("StrategyRepayLoan").withNamedArgs(
      {
        strategy: controllers[0].controllerContract.address,
        reward: EXPECTED_REWARD.toString(),
      },
      "reported gain should be reduced by fee",
    );

    const stateAfter = await vault.getDetails();
    expect(stateAfter.totalAssets.toString()).equals(
      EXPECTED_REWARD.plus(stateBefore.totalAssets).toString(),
      "total assets should be increased by reward",
    );
    expect(stateAfter.stEverSupply.toString()).equals(
      stateBefore.stEverSupply.toString(),
      "stever supply should be unchanged",
    );
  });
  it("user shouldn't receive because there is no available assets", async () => {
    const vaultState = await vault.getDetails();
    const { traceTree } = await controllers[0].sendRequestLoan({
      queryId: 2,
      maxLoan: vaultState.availableAssets.toString(),
      minLoan: toNano(1),
      maxInterest: "0",
    });
    const WITHDRAW_AMOUNT = 10;
    const { errorEvents } = await makeWithdrawToUsers({
      vault: vault,
      users: [user1],
      governance,
      amount: locklift.utils.toNano(WITHDRAW_AMOUNT),
    });
    expect(errorEvents[0].user.equals(user1.account.address)).to.be.true;
    expect(errorEvents[0].amount).to.equal(locklift.utils.toNano(WITHDRAW_AMOUNT));

    const { amount, nonce } = (await user1.getWithdrawRequests())[0];
    expect(nonce).to.be.equals(errorEvents[0].withdrawInfo[0][0]);
    expect(amount).to.be.equals(locklift.utils.toNano(WITHDRAW_AMOUNT));
  });
  it("should receive repay from strategy", async () => {
    const controllerAvailableAssets = await controllers[0].getFields().then(res => res.borrowed_amount);

    const { availableAssets: availableBalanceBefore } = await vault.getDetails();
    console.log("controllerAvailableAssets", controllerAvailableAssets);
    await controllers[0].runFullCycle({
      queryId: 2,
      maxFactor: 1,
      adnlAddr: "0x1",
      stakeAt: 1,
      validatorPubKey: "0x1",
      valueToStake: (await controllers[0].getFields().then(res => res.borrowed_amount))!,
    });
    const { availableAssets: availableBalanceAfter } = await vault.getDetails();

    expect(availableBalanceAfter.toNumber()).to.be.gt(availableBalanceBefore.toNumber());
  });
  it("user should receive requested amount + reward + fee", async () => {
    await locklift.testing.increaseTime(60 * 60 * 24 * 2);
    const { userBalanceBefore, vaultBalanceBefore } = await Promise.all([
      locklift.provider.getBalance(user1.account.address),
      locklift.provider.getBalance(vault.vaultContract.address),
    ]).then(([userBalanceBefore, vaultBalanceBefore]) => ({ userBalanceBefore, vaultBalanceBefore }));

    const { value0: stateBeforeWithdraw } = await vault.vaultContract.methods.getDetails({ answerId: 0 }).call({});

    const { nonce, amount: withdrawAmount } = (await user1.getWithdrawRequests())[0];
    const expectedEverAmountWithReward = await vault.vaultContract.methods
      .getWithdrawEverAmount({
        _amount: withdrawAmount,
      })
      .call()
      .then(res => res.value0);

    const { traceTree } = await governance.emitWithdraw({
      sendConfig: [[user1.account.address, { nonces: [nonce] }]],
    });

    expect(traceTree).to.emit("WithdrawSuccess").withNamedArgs({
      user: user1.account.address,
      amount: expectedEverAmountWithReward,
    });

    const { value0: stateAfterWithdraw } = await vault.vaultContract.methods.getDetails({ answerId: 0 }).call({});

    expect(new BigNumber(stateBeforeWithdraw.totalAssets).minus(expectedEverAmountWithReward).toString()).to.be.equals(
      stateAfterWithdraw.totalAssets,
      "totalAssets should be reduced by the amount withdrawn",
    );

    expect(new BigNumber(stateBeforeWithdraw.stEverSupply).minus(withdrawAmount).toString()).to.be.equals(
      stateAfterWithdraw.stEverSupply,
      "stEverSupply should be reduced by the amount withdrawn",
    );
    const { userBalanceAfter, vaultBalanceAfter } = await Promise.all([
      locklift.provider.getBalance(user1.account.address),
      locklift.provider.getBalance(vault.vaultContract.address),
    ]).then(([userBalanceAfter, vaultBalanceAfter]) => ({ userBalanceAfter, vaultBalanceAfter }));

    const returnedFeeToUser = new BigNumber(userBalanceAfter)
      .minus(userBalanceBefore)
      .minus(expectedEverAmountWithReward);
    expect(returnedFeeToUser.toNumber()).to.be.above(
      0,
      "user should receive more than reward because we should send back attached fee from withdraw request",
    );

    const payedVaultFee = new BigNumber(vaultBalanceBefore)
      .minus(vaultBalanceAfter)
      .minus(expectedEverAmountWithReward)
      .minus(returnedFeeToUser);

    expect(payedVaultFee.toNumber()).to.be.above(0, "vault should pay a fee for iteration under withdrawal ");
  });
});
