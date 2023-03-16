import { preparation } from "./preparation";
import { Contract, fromNano, Signer, toNano } from "locklift";
import { User } from "../utils/entities/user";
import { Governance } from "../utils/entities/governance";
import { TokenRootUpgradeableAbi } from "../build/factorySource";

import { expect } from "chai";
import { Vault } from "../utils/entities/vault";
import { createStrategy, DePoolStrategyWithPool } from "../utils/entities/dePoolStrategy";
import { getAddressEverBalance, toNanoBn } from "../utils";
import { createAndRegisterStrategy } from "../utils/highOrderUtils";
import { concatMap, from, lastValueFrom, map, mergeMap, range, switchMap, tap, timer, toArray } from "rxjs";
import { StrategyFactory } from "../utils/entities/strategyFactory";
import BigNumber from "bignumber.js";
import { Cluster } from "../utils/entities/cluster";
import { GAIN_FEE, INCREASE_STRATEGY_TOTAL_ASSETS_CORRECTION } from "../utils/constants";

let signer: Signer;
let admin: User;
let governance: Governance;
let user1: User;
let user2: User;
let tokenRoot: Contract<TokenRootUpgradeableAbi>;
let vault: Vault;
let strategy: DePoolStrategyWithPool;
let strategyFactory: StrategyFactory;
let cluster: Cluster;
const ST_EVER_FEE_PERCENT = 11;
describe("Strategy Total assets", function () {
  const DEPOSIT_TO_STRATEGIES_AMOUNT = toNanoBn(119.4);
  const DEPOSIT_FEE = new BigNumber(locklift.utils.toNano(0.6));
  beforeEach(async () => {
    const {
      vault: v,
      tokenRoot: tr,
      signer: s,
      users: [adminUser, _, u1, u2],
      governance: g,
      strategyFactory: st,
    } = await preparation({ deployUserValue: locklift.utils.toNano(2000) });
    signer = s;
    vault = v;
    admin = adminUser;
    governance = g;
    user1 = u1;
    user2 = u2;
    tokenRoot = tr;
    strategyFactory = st;

    await vault.setStEverFeePercent({ percentFee: ST_EVER_FEE_PERCENT });
    await vault.setMinDepositToStrategyValue({ minDepositToStrategyValue: toNano(1) });
    await vault.setMinWithdrawFromStrategyValue({ minWithdrawFromStrategyValue: toNano(1) });

    cluster = await Cluster.create({
      vault,
      clusterOwner: admin.account,
      assurance: toNano(0),
      maxStrategiesCount: 10,
    });

    strategy = await createStrategy({
      signer,
      poolDeployValue: locklift.utils.toNano(200),
      cluster,
    });

    const { traceTree: firstTraceTree } = await cluster.addStrategies([strategy.strategy.address]);
    expect(firstTraceTree)
      .to.emit("StrategiesAdded", vault.vaultContract)
      .withNamedArgs({
        strategy: [strategy.strategy.address],
      });

    await user1.depositToVault(toNanoBn(140).toString());

    await governance.depositToStrategies({
      _depositConfigs: [
        [
          strategy.strategy.address,
          {
            amount: DEPOSIT_TO_STRATEGIES_AMOUNT.toString(),
            fee: DEPOSIT_FEE.toString(),
          },
        ],
      ],
    });

    const strategyInfo = await vault.getStrategyInfo(strategy.strategy.address);
    expect(strategyInfo.totalAssets).to.be.equals(
      DEPOSIT_TO_STRATEGIES_AMOUNT.minus(INCREASE_STRATEGY_TOTAL_ASSETS_CORRECTION).toString(),
    );
  });

  it("Governance should withdraw part from strategy", async () => {
    const withdrawValue = DEPOSIT_TO_STRATEGIES_AMOUNT.minus(toNano(20));
    await governance.withdrawFromStrategiesRequest({
      _withdrawConfig: [[strategy.strategy.address, { amount: withdrawValue.toString(), fee: DEPOSIT_FEE.toString() }]],
    });

    await strategy.emitDePoolRoundComplete(toNano("0"), true);
    const strategyInfo = await vault.getStrategyInfo(strategy.strategy.address);
    expect(Number(strategyInfo.totalAssets))
      .to.be.gte(
        DEPOSIT_TO_STRATEGIES_AMOUNT.minus(withdrawValue).minus(INCREASE_STRATEGY_TOTAL_ASSETS_CORRECTION).toNumber(),
      )
      .and.lte(DEPOSIT_TO_STRATEGIES_AMOUNT.minus(withdrawValue).toNumber());
  });
  it("Governance should withdraw from pooling round", async () => {
    const withdrawValue = DEPOSIT_TO_STRATEGIES_AMOUNT.minus(toNano(20));
    const { traceTree } = await governance.forceWithdrawFromStrategies({
      _withdrawConfig: [[strategy.strategy.address, { amount: withdrawValue.toString(), fee: DEPOSIT_FEE.toString() }]],
    });

    await traceTree?.beautyPrint();

    const strategyInfo = await vault.getStrategyInfo(strategy.strategy.address);

    expect(Number(strategyInfo.totalAssets))
      .to.be.gte(
        DEPOSIT_TO_STRATEGIES_AMOUNT.minus(withdrawValue)
          // Fee will attach to the dePool response value
          .minus(DEPOSIT_FEE.plus(INCREASE_STRATEGY_TOTAL_ASSETS_CORRECTION))
          .toNumber(),
      )
      .and.lte(DEPOSIT_TO_STRATEGIES_AMOUNT.minus(withdrawValue).toNumber());
  });

  it("Total assets should be increased by gain", async () => {
    const roundReward = toNanoBn(25);

    const { traceTree } = await strategy.emitDePoolRoundComplete(roundReward.toString());
    const strategyInfo = await vault.getStrategyInfo(strategy.strategy.address);
    const roundRewardWithoutFee = traceTree?.findForContract({
      contract: vault.vaultContract,
      name: "StrategyReported",
    })[0]!.params!.report.gain!;

    const newStrategyTotalAssets = DEPOSIT_TO_STRATEGIES_AMOUNT.minus(INCREASE_STRATEGY_TOTAL_ASSETS_CORRECTION)
      .plus(roundRewardWithoutFee)
      .minus(INCREASE_STRATEGY_TOTAL_ASSETS_CORRECTION);

    expect(Number(strategyInfo.totalAssets)).to.be.eq(newStrategyTotalAssets.toNumber());
  });
  it("Total assets should be increased by gain and then decreased by withdraw value", async () => {
    const roundReward = toNanoBn(25);
    const withdrawValue = DEPOSIT_TO_STRATEGIES_AMOUNT.minus(toNano(20));

    await governance.withdrawFromStrategiesRequest({
      _withdrawConfig: [[strategy.strategy.address, { amount: withdrawValue.toString(), fee: DEPOSIT_FEE.toString() }]],
    });
    const { traceTree } = await strategy.emitDePoolRoundComplete(roundReward.toString(), true);
    const strategyInfo = await vault.getStrategyInfo(strategy.strategy.address);
    const roundRewardWithoutFee = traceTree?.findForContract({
      contract: vault.vaultContract,
      name: "StrategyReported",
    })[0]!.params!.report.gain!;

    const newStrategyTotalAssets = DEPOSIT_TO_STRATEGIES_AMOUNT.minus(INCREASE_STRATEGY_TOTAL_ASSETS_CORRECTION)
      .plus(roundRewardWithoutFee)
      .minus(INCREASE_STRATEGY_TOTAL_ASSETS_CORRECTION);

    expect(Number(strategyInfo.totalAssets))
      .to.be.gte(
        newStrategyTotalAssets.minus(withdrawValue).minus(INCREASE_STRATEGY_TOTAL_ASSETS_CORRECTION).toNumber(),
      )
      .and.to.be.lte(
        newStrategyTotalAssets.minus(withdrawValue).plus(INCREASE_STRATEGY_TOTAL_ASSETS_CORRECTION).toNumber(),
      );
  });
});
