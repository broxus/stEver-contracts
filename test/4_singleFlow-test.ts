import { Contract, Signer } from "locklift";
import { TokenRootUpgradeableAbi } from "../build/factorySource";
import { expect } from "chai";
import { toNanoBn } from "../utils";
import { User } from "../utils/entities/user";
import { preparation } from "./preparation";
import { Governance } from "../utils/entities/governance";
import { DePoolStrategyWithPool } from "../utils/entities/dePoolStrategy";
import { createAndRegisterStrategy, makeWithdrawToUsers } from "../utils/highOrderUtils";
import { Vault } from "../utils/entities/vault";
import BigNumber from "bignumber.js";
import { GAIN_FEE } from "../utils/constants";
import { StrategyFactory } from "../utils/entities/strategyFactory";

let signer: Signer;
let admin: User;
let governance: Governance;
let user1: User;
let user2: User;
let tokenRoot: Contract<TokenRootUpgradeableAbi>;
let vault: Vault;
let strategiesWithPool: Array<DePoolStrategyWithPool> = [];
let strategyFactory: StrategyFactory;

describe.skip("Single flow", async function () {
  before(async () => {
    const {
      vault: v,
      tokenRoot: tr,
      signer: s,
      users: [adminUser, _, u1, u2],
      governance: g,
      strategyFactory: st,
    } = await preparation({ deployUserValue: locklift.utils.toNano(100) });
    signer = s;
    vault = v;
    admin = adminUser;
    governance = g;
    user1 = u1;
    user2 = u2;
    tokenRoot = tr;
    strategyFactory = st;
  });
  it("Vault should be initialized", async () => {
    await vault.initialize();
  });
  it("should strategy deployed", async () => {
    strategiesWithPool.push(
      await createAndRegisterStrategy({
        admin: admin.account,
        vault,
        signer,
        poolDeployValue: locklift.utils.toNano(200),
        strategyDeployValue: locklift.utils.toNano(12),
        strategyFactory,
      }).then(({ strategy }) => strategy),
    );
  });
  it("user should deposit to vault", async () => {
    const DEPOSIT_TO_STRATEGIES_AMOUNT = 120;
    await user1.depositToVault(locklift.utils.toNano(DEPOSIT_TO_STRATEGIES_AMOUNT));
  });
  it("governance should deposit to strategies", async () => {
    const DEPOSIT_TO_STRATEGIES_AMOUNT = toNanoBn(119.4);
    const DEPOSIT_FEE = toNanoBn(0.6);
    await governance.depositToStrategies({
      _depositConfigs: [
        [
          locklift.utils.getRandomNonce(),
          {
            strategy: strategiesWithPool[0].strategy.address,
            amount: DEPOSIT_TO_STRATEGIES_AMOUNT.toString(),
            fee: DEPOSIT_FEE.toString(),
          },
        ],
      ],
    });
  });
  it("round should completed", async () => {
    const stateBefore = await vault.getDetails();
    const ROUND_REWARD = locklift.utils.toNano(3);
    const EXPECTED_REWARD = new BigNumber(ROUND_REWARD).minus(GAIN_FEE);
    const { transaction } = await strategiesWithPool[0].emitDePoolRoundComplete(ROUND_REWARD);

    const events = await vault.getEventsAfterTransaction({
      eventName: "StrategyReported",
      parentTransaction: transaction,
    });

    expect(events[0].data.strategy.equals(strategiesWithPool[0].strategy.address)).to.be.true;
    expect(events[0].data.report.gain).to.be.equals(
      EXPECTED_REWARD.toString(),
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
  it("user shouldn't receive because harvest from strategy have not evaluated yet, so reset pending withdraw request to the user", async () => {
    const WITHDRAW_AMOUNT = 10;
    debugger;
    const { errorEvents } = await makeWithdrawToUsers({
      vault: vault,
      users: [user1],
      governance,
      amount: locklift.utils.toNano(WITHDRAW_AMOUNT),
    });
    expect(errorEvents[0].data.user.equals(user1.account.address)).to.be.true;
    expect(errorEvents[0].data.amount).to.equal(locklift.utils.toNano(WITHDRAW_AMOUNT));

    const { amount, nonce } = (await user1.getWithdrawRequests())[0];
    expect(nonce).to.be.equals(errorEvents[0].data.nonces[0]);
    expect(amount).to.be.equals(locklift.utils.toNano(WITHDRAW_AMOUNT));
  });
  it("should successfully withdraw from strategy", async () => {
    const WITHDRAW_AMOUNT = toNanoBn(100);
    const { availableAssets: availableBalanceBefore } = await vault.getDetails();
    const withdrawSuccessEvents = await governance.withdrawFromStrategies({
      _withdrawConfig: [
        [
          locklift.utils.getRandomNonce(),
          {
            strategy: strategiesWithPool[0].strategy.address,
            amount: WITHDRAW_AMOUNT.toString(),
            fee: locklift.utils.toNano(0.1),
          },
        ],
      ],
    });
    const { availableAssets: availableBalanceAfter } = await vault.getDetails();
    expect(availableBalanceAfter.toNumber()).to.be.gt(availableBalanceBefore.toNumber());
  });
  it("user should receive requested amount + reward + fee", async () => {
    const { userBalanceBefore, vaultBalanceBefore } = await Promise.all([
      locklift.provider.getBalance(user1.account.address),
      locklift.provider.getBalance(vault.vaultContract.address),
    ]).then(([userBalanceBefore, vaultBalanceBefore]) => ({ userBalanceBefore, vaultBalanceBefore }));

    const { value0: stateBeforeWithdraw } = await vault.vaultContract.methods.getDetails({ answerId: 0 }).call({});
    const withdrawalRate = new BigNumber(stateBeforeWithdraw.totalAssets).dividedBy(stateBeforeWithdraw.stEverSupply);

    const { nonce, amount: withdrawAmount } = (await user1.getWithdrawRequests())[0];
    const expectedEverAmountWithReward = withdrawalRate.multipliedBy(withdrawAmount).toFixed(0, BigNumber.ROUND_DOWN);
    const { transaction } = await governance.emitWithdraw({
      sendConfig: [[locklift.utils.getRandomNonce(), { user: user1.account.address, nonces: [nonce] }]],
    });
    const success = await vault.getEventsAfterTransaction({
      eventName: "WithdrawSuccess",
      parentTransaction: transaction,
    });

    const { value0: stateAfterWithdraw } = await vault.vaultContract.methods.getDetails({ answerId: 0 }).call({});
    expect(success[0].data.user.equals(user1.account.address)).to.be.true;

    expect(success[0].data.amount).to.equal(expectedEverAmountWithReward);

    expect(new BigNumber(stateBeforeWithdraw.totalAssets).minus(expectedEverAmountWithReward).toString()).to.be.equals(
      stateAfterWithdraw.totalAssets,
      "totalAssets should be reduced by the amount withdrawn",
    );

    expect(new BigNumber(stateBeforeWithdraw.totalAssets).minus(success[0].data.amount).toString()).to.be.equals(
      stateAfterWithdraw.totalAssets,
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
