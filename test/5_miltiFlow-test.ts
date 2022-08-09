import { Address, Contract, Signer } from "locklift";
import { TokenRootUpgradeableAbi } from "../build/factorySource";
import { expect } from "chai";
import { assertEvent, getAddressBalance, toNanoBn } from "../utils";
import { User } from "../utils/entities/user";
import { preparation } from "./preparation";
import { Governance } from "../utils/entities/governance";
import { DePoolStrategyWithPool } from "../utils/entities/dePoolStrategy";
import { createAndRegisterStrategy, makeWithdrawToUsers } from "../utils/highOrderUtils";
import { Vault } from "../utils/entities/vault";
import BigNumber from "bignumber.js";
import { GAIN_FEE } from "../utils/constants";
import { StrategyFactory } from "../utils/entities/strategyFactory";
import { concatMap, from, lastValueFrom, range, toArray } from "rxjs";
import { intersectionWith } from "lodash";

const TOKEN_ROOT_NAME = "StEver";
const TOKEN_ROOT_SYMBOL = "STE";
const ZERO_ADDRESS = new Address("0:0000000000000000000000000000000000000000000000000000000000000000");
let signer: Signer;
let admin: User;
let governance: Governance;
let user1: User;
let user2: User;
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
      users: [adminUser, _, u1, u2],
      governance: g,
      strategyFactory: st,
    } = await preparation();
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
  it("should strategies deployed", async () => {
    strategiesWithPool.push(
      ...(await lastValueFrom(
        range(3).pipe(
          concatMap(() =>
            createAndRegisterStrategy({
              governance,
              vault,
              signer,
              poolDeployValue: locklift.utils.toNano(200),
              strategyDeployValue: locklift.utils.toNano(12),
              strategyFactory,
            }),
          ),
          toArray(),
        ),
      )),
    );
  });
  it("users should deposit to vault", async () => {
    const DEPOSIT_TO_STRATEGIES_AMOUNT = toNanoBn(100);
    await lastValueFrom(
      from([user1, user2]).pipe(concatMap(user => user.depositToVault(DEPOSIT_TO_STRATEGIES_AMOUNT.toString()))),
    );
  });
  it("governance should deposit to strategies", async () => {
    const DEPOSIT_TO_STRATEGIES_AMOUNT = toNanoBn(20);
    const DEPOSIT_FEE = toNanoBn(0.6);
    console.log(`vault balance before ${await getAddressBalance(vault.vaultContract.address)}`);
    await governance.depositToStrategies({
      depositConfig: strategiesWithPool.map(({ strategy }) => [
        locklift.utils.getRandomNonce(),
        {
          strategy: strategy.address,
          amount: DEPOSIT_TO_STRATEGIES_AMOUNT.minus(DEPOSIT_FEE).toString(),
          fee: DEPOSIT_FEE.toString(),
        },
      ]),
    });
    console.log(`vault balance after ${await getAddressBalance(vault.vaultContract.address)}`);
  });
  it("round should completed", async () => {
    const stateBefore = await vault.getDetails();
    const ROUND_REWARD = toNanoBn(3);
    const EXPECTED_REWARD = new BigNumber(ROUND_REWARD).minus(GAIN_FEE);
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
    expect(stateAfter.totalAssets).equals(
      EXPECTED_REWARD.times(strategiesWithPool.length).plus(stateBefore.totalAssets).toString(),
      "total assets should be increased by reward",
    );
    expect(stateAfter.stEverSupply).equals(stateBefore.stEverSupply, "stever supply should be unchanged");
  });

  it("should successfully withdraw from strategy", async () => {
    const WITHDRAW_AMOUNT = 15;
    const { availableAssets: availableBalanceBefore } = await vault.getDetails();
    const withdrawSuccessEvents = await governance.withdrawFromStrategies({
      withdrawConfig: [
        [
          locklift.utils.getRandomNonce(),
          {
            strategy: strategiesWithPool[0].strategy.address,
            amount: locklift.utils.toNano(WITHDRAW_AMOUNT),
            fee: locklift.utils.toNano(0.1),
          },
        ],
      ],
    });
    const {
      value0: { availableAssets: availableBalanceAfter },
    } = await vault.vaultContract.methods.getDetails({ answerId: 0 }).call({});
    expect(Number(availableBalanceAfter)).to.be.gt(Number(availableBalanceBefore));
  });
  // it("user should receive requested amount + reward + fee", async () => {
  //   const { userBalanceBefore, vaultBalanceBefore } = await Promise.all([
  //     locklift.provider.getBalance(user1.account.address),
  //     locklift.provider.getBalance(vault.vaultContract.address),
  //   ]).then(([userBalanceBefore, vaultBalanceBefore]) => ({ userBalanceBefore, vaultBalanceBefore }));
  //
  //   const { value0: stateBeforeWithdraw } = await vault.vaultContract.methods.getDetails({ answerId: 0 }).call({});
  //   const withdrawalRate = new BigNumber(stateBeforeWithdraw.totalAssets).dividedBy(stateBeforeWithdraw.stEverSupply);
  //
  //   const { nonce, amount: withdrawAmount } = (await user1.getWithdrawRequests())[0];
  //   const expectedEverAmountWithReward = withdrawalRate.multipliedBy(withdrawAmount).toFixed(0, BigNumber.ROUND_DOWN);
  //   await governance.emitWithdraw({
  //     sendConfig: [[locklift.utils.getRandomNonce(), { user: user1.account.address, nonces: [nonce] }]],
  //   });
  //   const { events: success } = await vault.vaultContract.getPastEvents({
  //     filter: ({ event }) => event === "WithdrawSuccess",
  //   });
  //   assertEvent(success, "WithdrawSuccess");
  //   const { value0: stateAfterWithdraw } = await vault.vaultContract.methods.getDetails({ answerId: 0 }).call({});
  //   expect(success[0].data.user.equals(user1.account.address)).to.be.true;
  //
  //   expect(success[0].data.amount).to.equal(expectedEverAmountWithReward);
  //
  //   expect(new BigNumber(stateBeforeWithdraw.totalAssets).minus(expectedEverAmountWithReward).toString()).to.be.equals(
  //     stateAfterWithdraw.totalAssets,
  //     "totalAssets should be reduced by the amount withdrawn",
  //   );
  //
  //   expect(new BigNumber(stateBeforeWithdraw.totalAssets).minus(success[0].data.amount).toString()).to.be.equals(
  //     stateAfterWithdraw.totalAssets,
  //   );
  //
  //   expect(new BigNumber(stateBeforeWithdraw.stEverSupply).minus(withdrawAmount).toString()).to.be.equals(
  //     stateAfterWithdraw.stEverSupply,
  //     "stEverSupply should be reduced by the amount withdrawn",
  //   );
  //   const { userBalanceAfter, vaultBalanceAfter } = await Promise.all([
  //     locklift.provider.getBalance(user1.account.address),
  //     locklift.provider.getBalance(vault.vaultContract.address),
  //   ]).then(([userBalanceAfter, vaultBalanceAfter]) => ({ userBalanceAfter, vaultBalanceAfter }));
  //
  //   const returnedFeeToUser = new BigNumber(userBalanceAfter)
  //     .minus(userBalanceBefore)
  //     .minus(expectedEverAmountWithReward);
  //   expect(returnedFeeToUser.toNumber()).to.be.above(
  //     0,
  //     "user should receive more than reward because we should send back attached fee from withdraw request",
  //   );
  //
  //   const payedVaultFee = new BigNumber(vaultBalanceBefore)
  //     .minus(vaultBalanceAfter)
  //     .minus(expectedEverAmountWithReward)
  //     .minus(returnedFeeToUser);
  //
  //   expect(payedVaultFee.toNumber()).to.be.above(0, "vault should pay a fee for iteration under withdrawal ");
  // });
});
