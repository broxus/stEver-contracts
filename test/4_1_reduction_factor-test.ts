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

  it("check reduction-factor", async () => {
    const DAYLE_REWARD = 100;
    const { fullUnlockSeconds } = await vault.getDetails();

    const COUNT_OF_REPORTS = 40;
    const SECONDS_BETWEEN_REPORTS = 30;
    for (let _ of Array(COUNT_OF_REPORTS)) {
      const { traceTree } = await strategiesWithPool[0].emitDePoolRoundComplete(toNano(DAYLE_REWARD));
      await locklift.testing.increaseTime(SECONDS_BETWEEN_REPORTS);
    }
    await locklift.testing.increaseTime(Number(fullUnlockSeconds) / 2);
    const rate1 = await vault.getWithdrawRate();

    expect(Number(rate1)).to.be.closeTo(COUNT_OF_REPORTS / 2 + 1, 0.2);
    await user1.depositToVault(toNano("0.01"));

    await locklift.testing.increaseTime(Number(fullUnlockSeconds) / 2 - 1000);
    await user1.depositToVault(toNano("0.01"));

    const details1000SecondBeforeFullUnlock = await vault.getDetails();
    expect(Number(details1000SecondBeforeFullUnlock.remainingSeconds)).to.be.gte(350);

    await locklift.testing.increaseTime(1000);

    await user1.depositToVault(toNano("0.01"));
    const detailsAfterFullUnlock = await vault.getDetails();
    expect(detailsAfterFullUnlock.remainingSeconds).to.be.eq("0");

    expect(Number(await vault.getWithdrawRate())).to.be.closeTo(COUNT_OF_REPORTS + 1, 0.001);
    debugger;
  });
});
