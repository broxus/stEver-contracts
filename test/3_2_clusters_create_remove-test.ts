import { preparation } from "./preparation";
import { Contract, Signer, toNano } from "locklift";
import { User } from "../utils/entities/user";
import { Governance } from "../utils/entities/governance";
import { TokenRootUpgradeableAbi } from "../build/factorySource";

import { expect } from "chai";
import { Vault } from "../utils/entities/vault";
import { createStrategy, DePoolStrategyWithPool } from "../utils/entities/dePoolStrategy";
import { toNanoBn } from "../utils";
import { concatMap, from, lastValueFrom, map, range, toArray } from "rxjs";
import { StrategyFactory } from "../utils/entities/strategyFactory";
import BigNumber from "bignumber.js";
import { Cluster } from "../utils/entities/cluster";

let signer: Signer;
let admin: User;
let governance: Governance;
let user1: User;
let user2: User;
let tokenRoot: Contract<TokenRootUpgradeableAbi>;
let vault: Vault;
let strategyFactory: StrategyFactory;
const ST_EVER_FEE_PERCENT = 11;
let cluster: Cluster;
let strategies: Array<DePoolStrategyWithPool>;
describe("Cluster create and remove after one round", () => {
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
    console.log(`New vault ${vault.vaultContract.address.toString()}`);
  });
  it("Vault should be initialized", async () => {
    await vault.setStEverFeePercent({ percentFee: ST_EVER_FEE_PERCENT });
    await vault.setMinDepositToStrategyValue({ minDepositToStrategyValue: toNano(1) });
    await vault.setMinWithdrawFromStrategyValue({ minWithdrawFromStrategyValue: toNano(1) });
  });
  it("cluster should created and register three strategies", async () => {
    cluster = await Cluster.create({
      vault,
      clusterOwner: admin.account,
      assurance: toNano(10),
      maxStrategiesCount: 3,
    });
    strategies = await lastValueFrom(
      range(3).pipe(
        concatMap(() =>
          createStrategy({
            cluster,
            poolDeployValue: locklift.utils.toNano(200),
            signer,
          }),
        ),
        toArray(),
      ),
    );
    const { traceTree: addStrategyWithoutAssuranceTraceTree } = await cluster.addStrategies(
      strategies.map(s => s.strategy.address),
    );
    expect(addStrategyWithoutAssuranceTraceTree).to.error(5009);

    await admin.depositToVault(toNano(100));

    await admin.wallet.walletContract.methods
      .transfer({
        amount: toNano(10),
        deployWalletValue: 0,
        payload: "",
        notify: true,
        recipient: cluster.clusterContract.address,
        remainingGasTo: admin.account.address,
      })
      .send({
        from: admin.account.address,
        amount: toNano(2),
      });

    const { traceTree: addMoreStrategiesThanAllowedTraceTree } = await cluster.addStrategies(
      [...strategies, ...strategies].map(s => s.strategy.address),
    );
    expect(addMoreStrategiesThanAllowedTraceTree).to.error(5010);

    const { traceTree } = await cluster.addStrategies(strategies.map(s => s.strategy.address));
    expect(traceTree).to.emit("StrategiesAdded");

    const vaultStrategies = await vault.getStrategiesInfo();

    strategies.forEach(({ strategy }) => {
      expect(vaultStrategies[strategy.address.toString()]).not.to.be.undefined;
    });
  });
  it("strategies should handle deposits", async () => {
    const DEPOSIT_TO_STRATEGIES_AMOUNT = toNanoBn(20);
    const DEPOSIT_FEE = new BigNumber(locklift.utils.toNano(0.6));
    await user1.depositToVault(toNano(1000));
    const { traceTree: depositToStrategyTraceTree } = await governance.depositToStrategies({
      _depositConfigs: strategies.map(({ strategy }) => [
        strategy.address,
        {
          fee: DEPOSIT_FEE.toString(),
          amount: DEPOSIT_TO_STRATEGIES_AMOUNT.toString(),
        },
      ]),
    });

    expect(depositToStrategyTraceTree).to.emit("StrategyHandledDeposit").count(strategies.length);
  });
  it("strategies should marked as deleting", async () => {
    const { traceTree } = await cluster.removeCluster();
    expect(traceTree).to.emit("StrategiesPendingRemove");

    const vaultStrategies = await vault.getStrategiesInfo();
    strategies.forEach(strategy => {
      expect(vaultStrategies[strategy.strategy.address.toString()].state).to.be.eq("3");
    });
  });
  it("governance shouldn't have possibility to deposit to the deleting strategy", async () => {
    const DEPOSIT_TO_STRATEGIES_AMOUNT = toNanoBn(20);
    const DEPOSIT_FEE = new BigNumber(locklift.utils.toNano(0.6));
    const { traceTree: depositToStrategyTraceTree } = await governance.depositToStrategies({
      _depositConfigs: strategies.map(({ strategy }) => [
        strategy.address,
        {
          fee: DEPOSIT_FEE.toString(),
          amount: DEPOSIT_TO_STRATEGIES_AMOUNT.toString(),
        },
      ]),
    });
    expect(depositToStrategyTraceTree).to.emit("ProcessDepositToStrategyError").count(strategies.length).withNamedArgs({
      errcode: "1013",
    });
  });
  it("governance should emit withdraw process", async () => {
    const WITHDRAW_AMOUNT = toNanoBn(25);
    const ATTACHED_FEE = new BigNumber(locklift.utils.toNano(0.6));

    const { traceTree } = await governance.withdrawFromStrategiesRequest({
      _withdrawConfig: strategies.map(strategy => [
        strategy.strategy.address,
        { amount: WITHDRAW_AMOUNT.toString(), fee: ATTACHED_FEE.toString() },
      ]),
    });
    expect(traceTree).to.emit("StrategyHandledWithdrawRequest").count(strategies.length);
  });
  it("Round should completed and strategies with cluster should be deleted", async () => {
    const strategiesWithTraceTree = await lastValueFrom(
      from(strategies).pipe(
        concatMap(strategy =>
          from(strategy.emitDePoolRoundComplete(toNano(1), true)).pipe(
            map(({ traceTree }) => ({ strategy, traceTree })),
          ),
        ),
        toArray(),
      ),
    );
    strategiesWithTraceTree.forEach(({ traceTree, strategy }) => {
      expect(traceTree).to.emit("StrategyRemoved").withNamedArgs({
        strategy: strategy.strategy.address,
      });
    });
    const lastStrategy = strategiesWithTraceTree.at(-1)!;
    expect(lastStrategy.traceTree).to.emit("ClusterRemoved").withNamedArgs({
      cluster: cluster.clusterContract.address,
      clusterOwner: admin.account.address,
      clusterNonce: "0",
    });
    const stEverBalanceChange = lastStrategy.traceTree!.tokens.getTokenBalanceChange(
      admin.wallet.walletContract.address,
    );
    expect(stEverBalanceChange).to.be.eq(toNano(10));
  });
});
