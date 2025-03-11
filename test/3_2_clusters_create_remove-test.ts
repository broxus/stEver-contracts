import { preparation } from "./preparation";
import { Contract, Signer, toNano } from "locklift";
import { User } from "../utils/entities/user";
import { Governance } from "../utils/entities/governance";
import { ElectorAbi, TokenRootUpgradeableAbi } from "../build/factorySource";

import { expect } from "chai";
import { Vault } from "../utils/entities/vault";
import { createControllers, DePoolStrategyWithPool } from "../utils/entities/dePoolStrategy";
import { convertEverGas, toNanoBn } from "../utils";
import { concatMap, from, lastValueFrom, map, range, toArray } from "rxjs";
import { StrategyFactory } from "../utils/entities/strategyFactory";
import BigNumber from "bignumber.js";
import { Cluster } from "../utils/entities/cluster";
import { Controller } from "../utils/controller";
import { Elector } from "../utils/elector";

let signer: Signer;
let admin: User;
let user1: User;
let user2: User;
let tokenRoot: Contract<TokenRootUpgradeableAbi>;
let vault: Vault;
let elector: Elector;
let strategyFactory: StrategyFactory;
const ST_EVER_FEE_PERCENT = 11;
const MIN_STAKE_TO_SEND = 50_000;
let cluster: Cluster;
let controllers: Array<Controller>;
describe("Cluster create and remove after one round", () => {
  before(async () => {
    const {
      vault: v,
      tokenRoot: tr,
      signer: s,
      users: [adminUser, _, u1, u2],
      strategyFactory: st,
      elector: e,
    } = await preparation({ deployUserValue: locklift.utils.toNano(MIN_STAKE_TO_SEND * 4) });
    signer = s;
    vault = v;
    admin = adminUser;
    user1 = u1;
    user2 = u2;
    tokenRoot = tr;
    strategyFactory = st;
    elector = e;
    console.log(`New vault ${vault.vaultContract.address.toString()}`);
  });
  it("Vault should be initialized", async () => {
    await vault.setStEverFeePercent({ percentFee: ST_EVER_FEE_PERCENT });
    await vault.setMinDepositToStrategyValue({ minDepositToStrategyValue: toNano(1) });
    await vault.setMinWithdrawFromStrategyValue({ minWithdrawFromStrategyValue: toNano(1) });
  });
  it("cluster should created and register 3 controllers", async () => {
    cluster = await Cluster.create({
      vault,
      clusterOwner: admin.account,
      assurance: toNano(10),
      maxStrategiesCount: 3,
    });
    const addStrategyWithoutAssuranceTraceTree = await cluster.deployStrategy({
      count: 3,
      validator: admin.account.address,
    });
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
        amount: toNano(convertEverGas(0.05)),
      });

    const addMoreStrategiesThanAllowedTraceTree = await cluster.deployStrategy({
      count: 6,
      validator: admin.account.address,
    });
    expect(addMoreStrategiesThanAllowedTraceTree).to.error(5010);

    controllers = await createControllers({
      cluster,
      validator: admin.account.address,
      count: 3,
    });

    const vaultStrategies = await vault.getStrategiesInfo();

    controllers.forEach(({ controllerContract }) => {
      expect(vaultStrategies[controllerContract.address.toString()]).not.to.be.undefined;
    });
  });
  it("controllers should handle deposits", async () => {
    await user1.depositToVault(toNano(MIN_STAKE_TO_SEND * 3));

    const results = await lastValueFrom(
      from(controllers).pipe(
        concatMap(controller =>
          controller
            .sendRequestLoan({
              queryId: 0,
              maxLoan: toNano(MIN_STAKE_TO_SEND).toString(),
              minLoan: toNano(10).toString(),
              maxInterest: "10", // 1%
            })
            .then(res => res.traceTree!),
        ),
        toArray(),
      ),
    );
    results.forEach(t => {
      expect(t)
        .to.emit("ControllerCredited")
        .count(1)
        .withNamedArgs({ value: toNano(MIN_STAKE_TO_SEND) });
    });
  });
  it("controllers should marked as deleting", async () => {
    const { traceTree } = await cluster.removeCluster();
    expect(traceTree).to.emit("StrategiesPendingRemove");

    const vaultStrategies = await vault.getStrategiesInfo();
    controllers.forEach(controller => {
      expect(vaultStrategies[controller.controllerContract.address.toString()].state).to.be.eq("3");
    });
  });
  // it("governance shouldn't have possibility to deposit to the deleting strategy", async () => {
  //   const DEPOSIT_TO_STRATEGIES_AMOUNT = toNanoBn(20);
  //   const DEPOSIT_FEE = new BigNumber(locklift.utils.toNano(0.6));
  //   const { traceTree: depositToStrategyTraceTree } = await governance.depositToStrategies({
  //     _depositConfigs: controllers.map(({ strategy }) => [
  //       strategy.address,
  //       {
  //         fee: DEPOSIT_FEE.toString(),
  //         amount: DEPOSIT_TO_STRATEGIES_AMOUNT.toString(),
  //       },
  //     ]),
  //   });
  //   expect(depositToStrategyTraceTree)
  //     .to.emit("ProcessDepositToStrategyError")
  //     .count(controllers.length)
  //     .withNamedArgs({
  //       errcode: "1013",
  //     });
  // });
  // it("governance should emit withdraw process", async () => {
  //   const WITHDRAW_AMOUNT = toNanoBn(25);
  //   const ATTACHED_FEE = new BigNumber(locklift.utils.toNano(0.6));
  //
  //   const { traceTree } = await governance.withdrawFromStrategiesRequest({
  //     _withdrawConfig: controllers.map(strategy => [
  //       strategy.strategy.address,
  //       { amount: WITHDRAW_AMOUNT.toString(), fee: ATTACHED_FEE.toString() },
  //     ]),
  //   });
  //   expect(traceTree).to.emit("StrategyHandledWithdrawRequest").count(controllers.length);
  // });
  it("Controller should send stake to elector", async () => {
    const strategiesWithTraceTree = await lastValueFrom(
      from(controllers).pipe(
        concatMap(controller =>
          controller
            .newStake({
              stakeAt: 152,
              queryId: 1,
              valueToStake: toNano(MIN_STAKE_TO_SEND).toString(),
              validatorPubKey: "0x1",
              maxFactor: 1,
              adnlAddr: "0x1",
            })
            .then(res => ({ traceTree: res.traceTree!, controller: controller })),
        ),
        toArray(),
      ),
    );
  });
  it("Round should completed and controllers with cluster should be deleted", async () => {
    const { stEverTokenWallet: clusterStEverTokenWallet } = await cluster.getDetails();

    const strategiesWithTraceTree = await lastValueFrom(
      from(controllers).pipe(
        concatMap(controller =>
          controller
            .updateValidatorHashMultipleTimes()
            .then(() =>
              controller
                .recoverStake({ queryId: 0 })
                .then(res => ({ traceTree: res.traceTree!, controller: controller })),
            ),
        ),
        toArray(),
      ),
    );
    strategiesWithTraceTree.forEach(({ traceTree, controller }) => {
      expect(traceTree).to.emit("StrategyRemoved").withNamedArgs({
        strategy: controller.controllerContract.address,
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
    const clusterContractState = await locklift.provider.getFullContractState({
      address: cluster.clusterContract.address,
    });
    const clusterStEverTokenWalletState = await locklift.provider.getFullContractState({
      address: clusterStEverTokenWallet,
    });
    expect(clusterContractState.state).to.be.undefined;
    expect(clusterStEverTokenWalletState.state).to.be.undefined;
  });
});
