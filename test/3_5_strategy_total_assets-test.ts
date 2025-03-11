import { preparation } from "./preparation";
import { Contract, Signer, toNano } from "locklift";
import { User } from "../utils/entities/user";
import { Governance } from "../utils/entities/governance";
import { TokenRootUpgradeableAbi } from "../build/factorySource";

import { expect } from "chai";
import { Vault } from "../utils/entities/vault";
import { createControllers } from "../utils/entities/dePoolStrategy";
import { toNanoBn } from "../utils";

import { StrategyFactory } from "../utils/entities/strategyFactory";
import BigNumber from "bignumber.js";
import { Cluster } from "../utils/entities/cluster";
import { INCREASE_STRATEGY_TOTAL_ASSETS_CORRECTION, ONE_HUNDRED_PERCENT } from "../utils/constants";
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
const ST_EVER_FEE_PERCENT = 11;
const MIN_STAKE_TO_SEND = 50_000;
const VALIDATOR_SHARE_PERCENT = 10;
describe("Strategy Total assets", function () {
  const DEPOSIT_TO_STRATEGIES_AMOUNT = toNanoBn(MIN_STAKE_TO_SEND);
  const DEPOSIT_FEE = new BigNumber(locklift.utils.toNano(0.6));
  beforeEach(async () => {
    const {
      vault: v,
      tokenRoot: tr,
      signer: s,
      users: [adminUser, _, u1, u2],
      governance: g,
      strategyFactory: st,
      elector: e,
    } = await preparation({ deployUserValue: locklift.utils.toNano(MIN_STAKE_TO_SEND * 3) });
    signer = s;
    vault = v;
    admin = adminUser;
    governance = g;
    user1 = u1;
    user2 = u2;
    tokenRoot = tr;
    strategyFactory = st;
    elector = e;

    await vault.setStEverFeePercent({ percentFee: ST_EVER_FEE_PERCENT });
    await vault.setMinDepositToStrategyValue({ minDepositToStrategyValue: toNano(1) });
    await vault.setMinWithdrawFromStrategyValue({ minWithdrawFromStrategyValue: toNano(1) });

    cluster = await Cluster.create({
      vault,
      clusterOwner: admin.account,
      assurance: toNano(0),
      maxStrategiesCount: 10,
    });

    controller = await createControllers({
      cluster,
      validator: admin.account.address,
      count: 1,
    }).then(res => res[0]);

    await user1.depositToVault(toNanoBn(MIN_STAKE_TO_SEND * 2).toString());

    await controller.sendRequestLoan({
      queryId: 1,
      maxInterest: (ONE_HUNDRED_PERCENT / VALIDATOR_SHARE_PERCENT).toString(),
      minLoan: toNano(1).toString(),
      maxLoan: toNano(MIN_STAKE_TO_SEND).toString(),
    });

    const strategyInfo = await vault.getStrategyInfo(controller.controllerContract.address);
    expect(strategyInfo.totalAssets).to.be.equals(DEPOSIT_TO_STRATEGIES_AMOUNT.toString());
  });

  it("Total assets should be increased by gain", async () => {
    const roundReward = toNanoBn(25);
    await elector.setReward(roundReward.toString());
    {
      const { traceTree } = await controller.newStake({
        stakeAt: 152,
        queryId: 1,
        valueToStake: toNano(MIN_STAKE_TO_SEND).toString(),
        validatorPubKey: "0x1",
        maxFactor: 1,
        adnlAddr: "0x1",
      });
    }

    await controller.updateValidatorHashMultipleTimes();
    const { traceTree } = await controller.recoverStake({ queryId: 1 });
    const strategyInfo = await vault.getStrategyInfo(controller.controllerContract.address);
    // const roundRewardWithoutFee = traceTree?.findForContract({
    //   contract: vault.vaultContract,
    //   name: "StrategyRepayLoan",
    // })[0]!.params!.reward!;
    // console.log("roundRewardWithoutFee", roundRewardWithoutFee);

    const newStrategyTotalAssets = toNanoBn(0);

    expect(Number(strategyInfo.totalAssets)).to.be.eq(newStrategyTotalAssets.toNumber());
    expect(Number(strategyInfo.totalGain)).to.be.gte(
      roundReward
        .multipliedBy((ONE_HUNDRED_PERCENT - ONE_HUNDRED_PERCENT / VALIDATOR_SHARE_PERCENT) / ONE_HUNDRED_PERCENT)
        .toNumber(),
    );
    expect(Number(strategyInfo.totalGain)).to.be.lte(roundReward.toNumber());
  });
});
