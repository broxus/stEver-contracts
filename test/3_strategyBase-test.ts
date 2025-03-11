import { preparation } from "./preparation";
import { Contract, fromNano, Signer, toNano } from "locklift";
import { User } from "../utils/entities/user";
import { Governance } from "../utils/entities/governance";
import { TokenRootUpgradeableAbi } from "../build/factorySource";

import { expect } from "chai";
import { Vault } from "../utils/entities/vault";
import { createControllers } from "../utils/entities/dePoolStrategy";
import { convertEverGas, toNanoBn } from "../utils";
import { concatMap, flatMap, from, lastValueFrom, map, mergeMap, range, switchMap, timer, toArray } from "rxjs";
import { StrategyFactory } from "../utils/entities/strategyFactory";
import BigNumber from "bignumber.js";
import { Cluster } from "../utils/entities/cluster";
import { INCREASE_STRATEGY_TOTAL_ASSETS_CORRECTION } from "../utils/constants";
import { Controller } from "../utils/controller";
import { Elector } from "../utils/elector";

let signer: Signer;
let admin: User;
let governance: Governance;
let user1: User;
let user2: User;
let tokenRoot: Contract<TokenRootUpgradeableAbi>;
let vault: Vault;
let controller: Controller;
let strategyFactory: StrategyFactory;
let cluster: Cluster;
let elector: Elector;
const MIN_STAKE_TO_SEND = 50_000;

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
      elector: e,
    } = await preparation({ deployUserValue: locklift.utils.toNano(MIN_STAKE_TO_SEND * 100) });
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
    controller = await createControllers({
      cluster,
      validator: admin.account.address,
      count: 1,
    }).then(res => res[0]);

    const clusterControllers = await cluster.getStrategies();
    expect(clusterControllers.length).to.be.eq(1);
    const [strategyAddress, controllerParams] = clusterControllers[0];
    expect(strategyAddress.equals(controller.controllerContract.address)).to.be.true;
    expect(controllerParams.state).to.be.eq("1", "Strategy should be active");

    const stEverStrategy = await vault.getStrategiesInfo().then(res => res[strategyAddress.toString()]);
    expect(stEverStrategy.state).to.be.eq("0", "Strategy should be active");
    expect(stEverStrategy.cluster.toString()).to.be.eq(
      cluster.clusterContract.address.toString(),
      "Cluster should owns the strategy",
    );
  });
  it("governance should deposit to strategies", async () => {
    const DEPOSIT_TO_CONTROLLER_AMOUNT = toNanoBn(MIN_STAKE_TO_SEND);

    await user1.depositToVault(toNanoBn(MIN_STAKE_TO_SEND * 2).toString());
    const vaultStateBefore = await vault.getDetails();

    const { traceTree } = await controller.sendRequestLoan({
      queryId: 1,
      minLoan: toNano(1).toString(),
      maxLoan: toNano(MIN_STAKE_TO_SEND).toString(),
      maxInterest: "0",
    });
    expect(traceTree).and.emit("ControllerCredited").count(1).withNamedArgs({
      controller: controller.controllerContract.address,
      value: DEPOSIT_TO_CONTROLLER_AMOUNT.toString(),
    });

    const vaultStateAfter = await vault.getDetails();

    // expect(vaultStateBefore.totalAssets.toNumber()).to.be.gt(
    //   vaultStateAfter.totalAssets.toNumber(),
    //   "total assets should be reduced by fee",
    // );
    // expect(vaultStateAfter.totalAssets.toNumber()).to.be.gt(
    //   vaultStateBefore.totalAssets.minus(DEPOSIT_FEE).toNumber(),
    //   "some fee should be returned",
    // );
    expect(vaultStateBefore.availableAssets.minus(DEPOSIT_TO_CONTROLLER_AMOUNT).toNumber()).to.be.eq(
      vaultStateAfter.availableAssets.toNumber(),
      "total assets should be reduced to exact requested amount",
    );

    // expect(vaultStateAfter.availableAssets.toNumber()).to.be.gt(
    //   vaultStateBefore.availableAssets.minus(DEPOSIT_TO_CONTROLLER_AMOUNT).minus(DEPOSIT_FEE).toNumber(),
    //   "some fee should be returned",
    // );
    const strategyInfo = await vault.getStrategyInfo(controller.controllerContract.address);
    expect(strategyInfo.totalGain).to.be.equals("0");
    expect(strategyInfo.lastReport).to.be.equals("0");
    expect(strategyInfo.totalAssets).to.be.equals(DEPOSIT_TO_CONTROLLER_AMOUNT.toString());
  });

  it("strategy and vault state should be changed after report", async () => {
    const ROUND_REWARD = toNanoBn(10);
    await elector.setReward(ROUND_REWARD.toString());
    const vaultStateBefore = await vault.getDetails();
    const strategyInfoBefore = await vault.getStrategyInfo(controller.controllerContract.address);

    const { recoverStakeTraceTree, newStakeTraceTree } = await controller.runFullCycle({
      queryId: 1,
      maxFactor: 1,
      adnlAddr: "0x1",
      stakeAt: 152,
      valueToStake: toNano(MIN_STAKE_TO_SEND).toString(),
      validatorPubKey: "0x1",
    });

    const vaultStateAfter = await vault.getDetails();

    const strategyInfoAfter = await vault.getStrategyInfo(controller.controllerContract.address);
    expect(strategyInfoAfter.totalGain).to.be.equals(toNanoBn(10).toString());

    const expectedAccumulatedFee = ROUND_REWARD.multipliedBy(vaultStateBefore.stEverFeePercent).dividedBy(1000);
    expect(vaultStateAfter.totalStEverFee.toNumber()).to.be.equals(expectedAccumulatedFee.toNumber());

    const expectedAvailableBalance = vaultStateBefore.totalAssets.plus(
      ROUND_REWARD.minus(expectedAccumulatedFee).minus(vaultStateBefore.gainFee),
    );

    const gainWithoutFee = recoverStakeTraceTree!.findForContract({
      contract: vault.vaultContract,
      name: "StrategyRepayLoan",
    })[0]!.params!.reward;

    expect(vaultStateAfter.totalAssets.toNumber()).to.be.equals(expectedAvailableBalance.toNumber());
  });

  it("Controller should reject loan request cause controller not in initial state", async () => {
    {
      const { traceTree } = await controller.sendRequestLoan({
        queryId: 2,
        maxLoan: toNano(MIN_STAKE_TO_SEND),
        minLoan: toNano(10_000),
        maxInterest: "0",
      });

      expect(traceTree).to.emit("ControllerCredited").count(1);
    }
    const { traceTree } = await controller.sendRequestLoan({
      queryId: 2,
      maxLoan: toNano(MIN_STAKE_TO_SEND),
      minLoan: toNano(10_000),
      maxInterest: "0",
    });

    expect(traceTree).to.error(64001); // error::multiple_loans_are_prohibited = 0xfa01;
  });
  it("random user make force withdraw from controller", async () => {
    const vaultStrategyBefore = await vault
      .getStrategiesInfo()
      .then(res => res[controller.controllerContract.address.toString()]);

    const ATTACHED_FEE = toNano(convertEverGas(0.5));
    const { traceTree } = await locklift.tracing.trace(
      vault.vaultContract.methods
        .forceWithdrawFromStrategies({
          _withdrawConfig: [[controller.controllerContract.address, { fee: ATTACHED_FEE.toString() }]],
        })
        .send({
          from: user1.account.address,
          amount: toNano(convertEverGas(0.5 * 2)),
        }),
    );
    const vaultStrategyAfter = await vault
      .getStrategiesInfo()
      .then(res => res[controller.controllerContract.address.toString()]);
    expect(vaultStrategyAfter.totalAssets).to.be.eq("0");

    expect(traceTree).to.emit("StrategyRepayLoan").count(1);
  });

  it("strategy should be deleted", async () => {
    await locklift.giver.sendTo(controller.controllerContract.address, toNano(20));

    {
      const { traceTree } = await controller.sendRequestLoan({
        queryId: 3,
        maxInterest: "0",
        minLoan: toNano(1).toString(),
        maxLoan: toNano(MIN_STAKE_TO_SEND).toString(),
      });
    }

    await controller.newStake({
      queryId: 3,
      validatorPubKey: "0x1",
      stakeAt: 152,
      valueToStake: toNano(MIN_STAKE_TO_SEND).toString(),
      adnlAddr: "0x1",
      maxFactor: 1,
    });

    await controller.updateValidatorHashMultipleTimes();

    {
      const { traceTree } = await cluster.removeStrategies([controller.controllerContract.address]);
      expect(traceTree)
        .to.emit("StrategiesPendingRemove")
        .withNamedArgs({
          strategies: [controller.controllerContract.address],
        });
    }

    const { totalAssets } = await vault
      .getStrategiesInfo()
      .then(res => res[controller.controllerContract.address.toString()]);
    expect(Number(totalAssets)).to.be.eq(Number(toNano(MIN_STAKE_TO_SEND)));

    const { traceTree } = await controller.recoverStake({ queryId: 3 });

    expect(traceTree).to.emit("StrategyRemoved").withNamedArgs({
      strategy: controller.controllerContract.address,
    });
  });

  it("strategy should be immediately removed", async () => {
    const controller = await createControllers({
      cluster,
      count: 1,
      validator: admin.account.address,
    }).then(res => res[0]);

    const { traceTree } = await cluster.removeStrategies([controller.controllerContract.address]);
    expect(traceTree).to.emit("StrategyRemoved").withNamedArgs({
      strategy: controller.controllerContract.address,
    });
  });
});
