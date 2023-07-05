import { Contract, Signer, toNano } from "locklift";
import { TokenRootUpgradeableAbi } from "../build/factorySource";
import { expect } from "chai";
import { toNanoBn } from "../utils";
import { User } from "../utils/entities/user";
import { preparation } from "./preparation";
import { Governance } from "../utils/entities/governance";
import { createStrategy, DePoolStrategyWithPool } from "../utils/entities/dePoolStrategy";

import { Vault } from "../utils/entities/vault";
import BigNumber from "bignumber.js";
import { StrategyFactory } from "../utils/entities/strategyFactory";
import { Cluster } from "../utils/entities/cluster";

let signer: Signer;
let admin: User;
let governance: Governance;
let user1: User;
let user2: User;
let tokenRoot: Contract<TokenRootUpgradeableAbi>;
let vault: Vault;
let strategiesWithPool: Array<DePoolStrategyWithPool> = [];
let strategyFactory: StrategyFactory;
let cluster: Cluster;

describe("Reduction factor", async function () {
  before(async () => {
    const {
      vault: v,
      tokenRoot: tr,
      signer: s,
      users: [adminUser, _, u1, u2],
      governance: g,
      strategyFactory: st,
    } = await preparation({ deployUserValue: locklift.utils.toNano(200) });
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
    await vault.setMinDepositToStrategyValue({ minDepositToStrategyValue: toNano(1) });
    await vault.setGainFee({ ginFee: "0" });
    await vault.setStEverFeePercent({ percentFee: 0 });
    cluster = await Cluster.create({
      vault,
      clusterOwner: admin.account,
      assurance: toNano(0),
      maxStrategiesCount: 10,
    });
  });
  it("should strategy deployed", async () => {
    const strategy = await createStrategy({
      signer,
      cluster,
      poolDeployValue: locklift.utils.toNano(9999999),
    });
    await cluster.addStrategies([strategy.strategy.address]);
    strategiesWithPool.push(strategy);
  });
  it("user should deposit to vault", async () => {
    const DEPOSIT_TO_STRATEGIES_AMOUNT = 100;
    await user1.depositToVault(locklift.utils.toNano(DEPOSIT_TO_STRATEGIES_AMOUNT));
  });
  it("governance should deposit to strategies", async () => {
    const DEPOSIT_TO_STRATEGIES_AMOUNT = toNanoBn(90);
    const DEPOSIT_FEE = toNanoBn(0.6);
    const { successEvents } = await governance.depositToStrategies({
      _depositConfigs: [
        [
          strategiesWithPool[0].strategy.address,
          {
            amount: DEPOSIT_TO_STRATEGIES_AMOUNT.toString(),
            fee: DEPOSIT_FEE.toString(),
          },
        ],
      ],
    });

    expect(successEvents?.length).to.be.eq(1);
  });
  it("round should completed", async () => {
    const stateBefore = await vault.getDetails();
    const ROUND_REWARD = toNanoBn(100);
    const EXPECTED_REWARD = new BigNumber(ROUND_REWARD)
      .minus(stateBefore.gainFee)
      .minus(ROUND_REWARD.multipliedBy(stateBefore.stEverFeePercent).dividedBy(1000));
    const { transaction, traceTree } = await strategiesWithPool[0].emitDePoolRoundComplete(ROUND_REWARD.toString());

    expect(traceTree)
      .to.emit("StrategyReported")
      .withNamedArgs(
        {
          strategy: strategiesWithPool[0].strategy.address,
          report: {
            gain: EXPECTED_REWARD.toString(),
          },
        },
        "reported gain should be reduced by fee",
      );

    const stateAfter = await vault.getDetails();

    expect(stateAfter.totalAssets.toNumber()).to.be.closeTo(
      stateBefore.totalAssets.plus(EXPECTED_REWARD).toNumber(),
      Number(toNano("0.01")),
    );
    expect(stateAfter.effectiveEverAssets.toNumber()).to.be.closeTo(
      stateBefore.effectiveEverAssets.toNumber(),
      Number(toNano("0.003")),
    );
  });
  it("check reduction-factor", async () => {
    const DAYLE_REWARD = 100;

    {
      const rateImmediatelyAfterReport = await vault.getWithdrawRate();
      expect(rateImmediatelyAfterReport).to.be.closeTo(1, 0.0007);

      await locklift.testing.increaseTime(60 * 60 * 24);

      const rateAfterHalfUnlockTime = await vault.getWithdrawRate();

      expect(rateAfterHalfUnlockTime).to.be.closeTo(1.5, 0.0007);

      await locklift.testing.increaseTime(60 * 60 * 24);

      const rateAfterFullUnlockTime = await vault.getWithdrawRate();
      expect(rateAfterFullUnlockTime).to.be.closeTo(2, 0.0007);
    }
    {
      await strategiesWithPool[0].emitDePoolRoundComplete(toNano(DAYLE_REWARD));
      const rate1 = await vault.getWithdrawRate();
      expect(rate1).to.be.closeTo(2, 0.0007);

      await locklift.testing.increaseTime(60 * 60 * 24);
      await strategiesWithPool[0].emitDePoolRoundComplete(toNano(DAYLE_REWARD));
      const rate2 = await vault.getWithdrawRate();

      expect(rate2).to.be.closeTo(2.5, 0.0007);
      await locklift.testing.increaseTime(60 * 60 * 24);

      await strategiesWithPool[0].emitDePoolRoundComplete(toNano(DAYLE_REWARD));
      const rate3 = await vault.getWithdrawRate();
      expect(rate3).to.be.closeTo(3.62, 0.007);

      await locklift.testing.increaseTime(60 * 60 * 24);
      const rate4 = await vault.getWithdrawRate();

      const DAYS = 10;
      const incomeBefore10Days = await vault.vaultContract.methods
        .getWithdrawEverAmount({ _amount: toNano(100) })
        .call()
        .then(res => Number(res.value0));
      for (let _ of Array(DAYS)) {
        await strategiesWithPool[0].emitDePoolRoundComplete(toNano(DAYLE_REWARD / 2));
        await locklift.testing.increaseTime(60 * 60 * 12);
        await strategiesWithPool[0].emitDePoolRoundComplete(toNano(DAYLE_REWARD / 2));
        await locklift.testing.increaseTime(60 * 60 * 12);
      }
      const incomeAfter10Days = await vault.vaultContract.methods
        .getWithdrawEverAmount({ _amount: toNano(100) })
        .call()
        .then(res => Number(res.value0));

      expect(new BigNumber((incomeAfter10Days - incomeBefore10Days) / DAYS).shiftedBy(-9).toNumber()).to.be.closeTo(
        DAYLE_REWARD,
        0.8,
      );
      const resultRate = await vault.getWithdrawRate();
      expect(resultRate).to.be.closeTo(14.5, 0.0007);
      await user1.makeWithdrawRequest(toNano(100));
      {
        const { traceTree } = await governance.withdrawFromStrategiesRequest({
          _withdrawConfig: [
            [
              strategiesWithPool[0].strategy.address,
              {
                amount: toNano(9999),
                fee: toNano(0.6),
              },
            ],
          ],
        });
        await traceTree?.beautyPrint();
        {
          const { traceTree } = await strategiesWithPool[0].emitDePoolRoundComplete(toNano(0), true);
          await traceTree?.beautyPrint();
        }
      }

      const { traceTree } = await governance.emitWithdraw({
        sendConfig: [
          [user1.account.address, { nonces: await user1.getWithdrawRequests().then(res => res.map(el => el.nonce)) }],
        ],
      });
      await traceTree?.beautyPrint();
      expect(Number(traceTree?.getBalanceDiff(user1.account.address))).to.be.closeTo(
        toNanoBn(100).multipliedBy(resultRate).toNumber(),
        Number(toNano(1)),
      );
    }
  });
});
