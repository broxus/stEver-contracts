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
import { INCREASE_STRATEGY_TOTAL_ASSETS_CORRECTION } from "../utils/constants";

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
describe("Strategy base", function () {
  before(async () => {
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
  });
  it("Vault should be initialized", async () => {
    await vault.setStEverFeePercent({ percentFee: ST_EVER_FEE_PERCENT });
    await vault.setMinDepositToStrategyValue({ minDepositToStrategyValue: toNano(1) });
  });
  it("should cluster created", async () => {
    cluster = await Cluster.create({
      vault,
      clusterOwner: admin.account,
      assurance: toNano(0),
      maxStrategiesCount: 10,
    });
  });
  it("should strategy deployed", async () => {
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

    const { traceTree: secondTraceTree } = await cluster.addStrategies([strategy.strategy.address]);
    expect(secondTraceTree).to.error(5011);
    const clusterDetails = await cluster.getDetails();
    const clusterStrategies = await cluster.getStrategies();
    expect(clusterStrategies.length).to.be.eq(1);
    const [strategyAddress, strategyParams] = clusterStrategies[0];
    expect(strategyAddress.equals(strategy.strategy.address)).to.be.true;
    expect(strategyParams.state).to.be.eq("1", "Strategy should be active");

    const stEverStrategy = await vault.getStrategiesInfo().then(res => res[strategyAddress.toString()]);
    expect(stEverStrategy.state).to.be.eq("0", "Strategy should be active");
    expect(stEverStrategy.cluster.toString()).to.be.eq(
      cluster.clusterContract.address.toString(),
      "Cluster should owns the strategy",
    );
  });
  it("governance should deposit to strategies", async () => {
    const DEPOSIT_TO_STRATEGIES_AMOUNT = toNanoBn(119.4);
    const DEPOSIT_FEE = new BigNumber(locklift.utils.toNano(0.6));

    await user1.depositToVault(toNanoBn(140).toString());
    const vaultStateBefore = await vault.getDetails();

    console.log(`vault balance before ${await getAddressEverBalance(vault.vaultContract.address)}`);
    const { traceTree } = await governance.depositToStrategies({
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
    await traceTree!.beautyPrint();
    expect(traceTree).and.emit("StrategyHandledDeposit").count(1).withNamedArgs({
      strategy: strategy.strategy.address,
      depositValue: DEPOSIT_TO_STRATEGIES_AMOUNT.toString(),
    });

    const vaultStateAfter = await vault.getDetails();

    expect(vaultStateBefore.totalAssets.toNumber()).to.be.gt(
      vaultStateAfter.totalAssets.toNumber(),
      "total assets should be reduced by fee",
    );
    expect(vaultStateAfter.totalAssets.toNumber()).to.be.gt(
      vaultStateBefore.totalAssets.minus(DEPOSIT_FEE).toNumber(),
      "some fee should be returned",
    );
    expect(vaultStateBefore.availableAssets.minus(DEPOSIT_TO_STRATEGIES_AMOUNT).toNumber()).to.be.gt(
      vaultStateAfter.availableAssets.toNumber(),
      "total assets should be reduced more than deposit amount",
    );

    expect(vaultStateAfter.availableAssets.toNumber()).to.be.gt(
      vaultStateBefore.availableAssets.minus(DEPOSIT_TO_STRATEGIES_AMOUNT).minus(DEPOSIT_FEE).toNumber(),
      "some fee should be returned",
    );
    const strategyInfo = await vault.getStrategyInfo(strategy.strategy.address);
    expect(strategyInfo.totalGain).to.be.equals("0");
    expect(strategyInfo.lastReport).to.be.equals("0");
    expect(strategyInfo.totalAssets).to.be.equals(DEPOSIT_TO_STRATEGIES_AMOUNT.minus(toNano("0.3")).toString());
    console.log(`vault balance after ${await getAddressEverBalance(vault.vaultContract.address)}`);
  });

  it("strategy and vault state should be changed after report", async () => {
    const ROUND_REWARD = toNanoBn(10);
    const vaultStateBefore = await vault.getDetails();
    const strategyInfoBefore = await vault.getStrategyInfo(strategy.strategy.address);

    const { traceTree } = await strategy.emitDePoolRoundComplete(ROUND_REWARD.toString());
    const vaultStateAfter = await vault.getDetails();
    const strategyInfoAfter = await vault.getStrategyInfo(strategy.strategy.address);
    expect(strategyInfoAfter.totalGain).to.be.equals(toNanoBn(10).toString());

    const expectedAccumulatedFee = ROUND_REWARD.multipliedBy(vaultStateBefore.stEverFeePercent).dividedBy(1000);
    expect(vaultStateAfter.totalStEverFee.toNumber()).to.be.equals(expectedAccumulatedFee.toNumber());

    const expectedAvailableBalance = vaultStateBefore.totalAssets.plus(
      ROUND_REWARD.minus(expectedAccumulatedFee).minus(vaultStateBefore.gainFee),
    );

    const gainWithoutFee = traceTree!.findForContract({ contract: vault.vaultContract, name: "StrategyReported" })[0]!
      .params!.report.gain;

    expect(strategyInfoAfter.totalAssets).to.be.equals(
      new BigNumber(strategyInfoBefore.totalAssets)
        .plus(gainWithoutFee)
        .minus(INCREASE_STRATEGY_TOTAL_ASSETS_CORRECTION)
        .toString(),
    );
    expect(vaultStateAfter.totalAssets.toNumber()).to.be.equals(expectedAvailableBalance.toNumber());
  });

  it("governance shouldn't withdraw from strategy if dePool will reject request", async () => {
    const ATTACHED_FEE = toNanoBn(0.6);
    const WITHDRAW_AMOUNT = toNanoBn(100);

    await strategy.setDePoolWithdrawalState({ isClosed: true });

    const vaultDetailsBefore = await vault.getDetails();
    const vaultStrategyBefore = await vault.getStrategiesInfo().then(res => res[strategy.strategy.address.toString()]);

    const { traceTree } = await governance.withdrawFromStrategiesRequest({
      _withdrawConfig: [
        [strategy.strategy.address, { amount: WITHDRAW_AMOUNT.toString(), fee: ATTACHED_FEE.toString() }],
      ],
    });
    const vaultStrategyAfter = await vault.getStrategiesInfo().then(res => res[strategy.strategy.address.toString()]);
    expect(vaultStrategyBefore.totalAssets).to.be.equals(vaultStrategyAfter.totalAssets);
    const vaultDetailsAfter = await vault.getDetails();
    expect(vaultDetailsBefore.totalAssets.toNumber()).to.be.gt(
      vaultDetailsAfter.totalAssets.toNumber(),
      "some fee should payed from total assets",
    );

    expect(vaultDetailsAfter.totalAssets.toNumber()).to.be.gt(
      vaultDetailsBefore.totalAssets.minus(ATTACHED_FEE).toNumber(),
      "some fee should returned after failed withdraw",
    );
    expect(traceTree).to.emit("StrategyWithdrawError").count(1).withNamedArgs({
      strategy: strategy.strategy.address,
    });

    await strategy.setDePoolWithdrawalState({ isClosed: false });
  });

  it("governance shouldn't deposit to strategy if dePool is closed", async () => {
    const DEPOSIT_TO_STRATEGIES_AMOUNT = toNanoBn(110);
    const DEPOSIT_FEE = toNanoBn(0.6);
    await user1.depositToVault(DEPOSIT_TO_STRATEGIES_AMOUNT.toString());
    const vaultStrategyBefore = await vault.getStrategiesInfo().then(res => res[strategy.strategy.address.toString()]);

    const vaultStateBefore = await vault.getDetails();
    await strategy.setDePoolDepositsState({ isClosed: true });
    const { traceTree } = await governance.depositToStrategies({
      _depositConfigs: [
        [
          strategy.strategy.address,
          {
            fee: DEPOSIT_FEE.toString(),
            amount: DEPOSIT_TO_STRATEGIES_AMOUNT.toString(),
          },
        ],
      ],
    });
    const vaultStrategyAfter = await vault.getStrategiesInfo().then(res => res[strategy.strategy.address.toString()]);
    expect(vaultStrategyBefore.totalAssets).to.be.equals(vaultStrategyAfter.totalAssets);

    const vaultStateAfter = await vault.getDetails();
    expect(traceTree).to.emit("StrategyDidntHandleDeposit").count(1);

    expect(vaultStateAfter.availableAssets.toNumber()).to.be.gt(
      vaultStateBefore.availableAssets.minus(DEPOSIT_FEE).toNumber(),
      "some fee should be returned to vault, also full deposit amount should be returned",
    );

    await strategy.setDePoolDepositsState({ isClosed: false });
  });
  it("should validate deposit request", async () => {
    const result = await vault.vaultContract.methods
      .validateDepositRequest({
        _depositConfigs: [
          [
            strategy.strategy.address,
            {
              amount: locklift.utils.toNano(90000),
              fee: locklift.utils.toNano(0.6),
            },
          ],
        ],
      })
      .call();
    expect(result.value0.length).to.be.equals(1);
  });
  it("Vault should reject deposit to strategy cause strategy not in initial state", async () => {
    await lastValueFrom(timer(500));
    const FIRST_WITHDRAW_AMOUNT = toNanoBn(100);
    await user1.depositToVault(toNano(500));
    const { traceTree } = await governance.withdrawFromStrategiesRequest({
      _withdrawConfig: [
        [strategy.strategy.address, { amount: FIRST_WITHDRAW_AMOUNT.toString(), fee: toNanoBn(0.6).toString() }],
      ],
    });
    expect(traceTree).to.emit("StrategyHandledWithdrawRequest").count(1);
    const SECOND_WITHDRAW_AMOUNT = toNanoBn(201);
    const { traceTree: withdrawTraceTree } = await governance.withdrawFromStrategiesRequest({
      _withdrawConfig: [
        [strategy.strategy.address, { amount: SECOND_WITHDRAW_AMOUNT.toString(), fee: toNanoBn(0.6).toString() }],
      ],
    });
    expect(withdrawTraceTree).to.emit("ProcessWithdrawFromStrategyError").count(1).withNamedArgs({
      strategy: strategy.strategy.address,
      errcode: "1013",
    });

    const { traceTree: depositTraceTree } = await governance.depositToStrategies({
      _depositConfigs: [
        [strategy.strategy.address, { amount: SECOND_WITHDRAW_AMOUNT.toString(), fee: toNanoBn(0.6).toString() }],
      ],
    });
    expect(depositTraceTree).to.emit("ProcessDepositToStrategyError").count(1).withNamedArgs({
      strategy: strategy.strategy.address,
      errcode: "1013",
    });
  });
  it("governance should make force withdraw from strategy", async () => {
    expect(
      await vault.getStrategyInfo(strategy.strategy.address).then(res => Number(res.withdrawingAmount)),
    ).to.be.above(0, "strategy should in withdrawing state");
    const vaultStrategyBefore = await vault.getStrategiesInfo().then(res => res[strategy.strategy.address.toString()]);

    const WITHDRAW_FROM_POOLING_ROUND_VALUE = toNanoBn(101);
    const ATTACHED_FEE = toNanoBn(0.6);
    const { traceTree, successEvents } = await governance.forceWithdrawFromStrategies({
      _withdrawConfig: [
        [strategy.strategy.address, { fee: toNano(0.6), amount: WITHDRAW_FROM_POOLING_ROUND_VALUE.toString() }],
      ],
    });
    const vaultStrategyAfter = await vault.getStrategiesInfo().then(res => res[strategy.strategy.address.toString()]);
    expect(
      new BigNumber(vaultStrategyBefore.totalAssets)
        .minus(WITHDRAW_FROM_POOLING_ROUND_VALUE)
        .minus(ATTACHED_FEE)
        .toNumber(),
    ).to.be.lte(Number(vaultStrategyAfter.totalAssets));

    expect(traceTree).to.emit("StrategyWithdrawSuccess").count(1);
    expect(successEvents.length).to.be.equals(1);
    expect(Number(successEvents[0].data.amount)).to.be.gt(WITHDRAW_FROM_POOLING_ROUND_VALUE.toNumber());
    expect(Number(successEvents[0].data.amount)).to.be.lt(
      WITHDRAW_FROM_POOLING_ROUND_VALUE.plus(ATTACHED_FEE).toNumber(),
    );
  });
  it("report with low gain than the gain fee should be 0", async () => {
    const { transaction, traceTree } = await strategy.emitDePoolRoundComplete(toNano(0.9));
    const events = await vault.getEventsAfterTransaction({
      eventName: "StrategyReported",
      parentTransaction: transaction,
    });
    expect(traceTree)
      .to.emit("StrategyReported")
      .count(1)
      .withNamedArgs({
        report: {
          gain: "0",
        },
      });
  });

  it("governance should withdraw extra money from strategy", async () => {
    const vaultStateBefore = await vault.getDetails();
    console.log(`strategy balance ${await getAddressEverBalance(strategy.strategy.address)}`);

    const { traceTree, successEvents } = await governance.withdrawExtraMoneyFromStrategy({
      _strategies: [strategy.strategy.address],
    });

    const vaultStateAfter = await vault.getDetails();
    expect(traceTree).to.emit("ReceiveExtraMoneyFromStrategy").count(1);
    expect(vaultStateBefore.availableAssets.plus(successEvents[0]?.value || 0).toNumber()).to.be.eq(
      vaultStateAfter.availableAssets.toNumber(),
    );
  });
  it("strategy should be deleted", async () => {
    const { traceTree } = await cluster.removeStrategies([strategy.strategy.address]);
    expect(traceTree)
      .to.emit("StrategiesPendingRemove")
      .withNamedArgs({
        strategies: [strategy.strategy.address],
      });
    expect(new BigNumber(traceTree!.getBalanceDiff(admin.account.address)).negated().toNumber())
      .to.be.lte(new BigNumber(toNano(1.1)).toNumber())
      .and.gte(Number(toNano(1)));

    const { totalAssets } = await vault.getStrategiesInfo().then(res => res[strategy.strategy.address.toString()]);
    expect(Number(totalAssets)).to.be.lte(Number(toNano(101)));

    await governance.withdrawFromStrategiesRequest({
      _withdrawConfig: [[strategy.strategy.address, { amount: toNano(101), fee: toNanoBn(0.6).toString() }]],
    });

    const { traceTree: roundCompleteTraceTree } = await strategy.emitDePoolRoundComplete(
      locklift.utils.toNano(0.1),
      true,
    );
    expect(roundCompleteTraceTree).to.emit("StrategyRemoved").withNamedArgs({
      strategy: strategy.strategy.address,
    });
  });

  it("strategy should be immediately removed", async () => {
    const strategy = await createStrategy({
      signer,
      poolDeployValue: locklift.utils.toNano(200),
      cluster,
    });

    await cluster.addStrategies([strategy.strategy.address]);
    const { traceTree } = await cluster.removeStrategies([strategy.strategy.address]);
    expect(traceTree).to.emit("StrategyRemoved").withNamedArgs({
      strategy: strategy.strategy.address,
    });
  });

  it("should created and deposited to 3 clusters with 15 strategies per each", async () => {
    const clustersWithStrategies = await lastValueFrom(
      range(3).pipe(
        concatMap(() =>
          from(
            Cluster.create({
              vault,
              clusterOwner: admin.account,
              maxStrategiesCount: 15,
              assurance: toNano(0),
            }),
          ).pipe(
            switchMap(cluster =>
              range(15).pipe(
                concatMap(() =>
                  from(
                    createStrategy({
                      cluster,
                      poolDeployValue: locklift.utils.toNano(200),
                      signer,
                    }),
                  ),
                ),
                toArray(),
                switchMap(strategies =>
                  from(cluster.addStrategies(strategies.map(el => el.strategy.address))).pipe(
                    map(() => ({ cluster, strategies })),
                  ),
                ),
              ),
            ),
          ),
        ),
        toArray(),
      ),
    );

    await user1.depositToVault(locklift.utils.toNano(1000));
    console.log(`Vault balance before ${await getAddressEverBalance(vault.vaultContract.address)}`);

    const { traceTree } = await governance.depositToStrategies({
      _depositConfigs: clustersWithStrategies
        .flatMap(({ strategies }) => strategies)
        .map(({ strategy }) => [
          strategy.address,
          {
            fee: locklift.utils.toNano(0.6),
            amount: locklift.utils.toNano(2),
          },
        ]),
    });
    await traceTree!.beautyPrint();
    console.log(`total gas Used ${fromNano(traceTree!.totalGasUsed())}`);

    console.log(`Vault balance after ${await getAddressEverBalance(vault.vaultContract.address)}`);
  });
});
