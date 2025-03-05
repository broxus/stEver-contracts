import { Contract, fromNano, Signer, toNano } from "locklift";
import { TokenRootUpgradeableAbi } from "../build/factorySource";
import { expect } from "chai";
import { toNanoBn } from "../utils";
import { User } from "../utils/entities/user";
import { preparation } from "./preparation";
import { Governance } from "../utils/entities/governance";
import { createControllers, DePoolStrategyWithPool } from "../utils/entities/dePoolStrategy";

import { Vault } from "../utils/entities/vault";
import { StrategyFactory } from "../utils/entities/strategyFactory";
import { Cluster } from "../utils/entities/cluster";
import { Controller } from "../utils/controller";
import { Elector } from "../utils/elector";

let signer: Signer;
let admin: User;
let governance: Governance;
let user1: User;
let user2: User;
let tokenRoot: Contract<TokenRootUpgradeableAbi>;
let vault: Vault;
let controllers: Array<Controller> = [];
let strategyFactory: StrategyFactory;
let cluster: Cluster;
let elector: Elector;
const MIN_STAKE_TO_SEND = 50_000;

describe("Reduction factor", async function () {
  before(async () => {
    const {
      vault: v,
      tokenRoot: tr,
      signer: s,
      users: [adminUser, _, u1, u2],
      governance: g,
      strategyFactory: st,
      elector: e,
    } = await preparation({ deployUserValue: locklift.utils.toNano(MIN_STAKE_TO_SEND * 10) });
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
    await vault.setMinDepositToStrategyValue({ minDepositToStrategyValue: toNano(1) });
    await vault.setGainFee({ ginFee: toNano(1) });
    await vault.setStEverFeePercent({ percentFee: 0 });
    cluster = await Cluster.create({
      vault,
      clusterOwner: admin.account,
      assurance: toNano(0),
      maxStrategiesCount: 10,
    });
  });
  it("should strategy deployed", async () => {
    controllers = await createControllers({
      validator: admin.account.address,
      cluster,
      count: 1,
    });
  });
  it("user should deposit to vault", async () => {
    await user1.depositToVault(locklift.utils.toNano(MIN_STAKE_TO_SEND));
  });
  // it("controller should receive stake", async () => {
  //   controllers[0].sendRequestLoan({
  //     queryId: 1,
  //     minLoan: toNano(1),
  //     maxLoan: toNano(MIN_STAKE_TO_SEND),
  //     maxInterest: "0",
  //   });
  // });

  it("check reduction-factor", async () => {
    const DAYLE_REWARD = MIN_STAKE_TO_SEND + 1;
    await elector.setReward(toNano(DAYLE_REWARD));

    const { fullUnlockSeconds } = await vault.getDetails();

    const COUNT_OF_REPORTS = 40;
    await locklift.giver.sendTo(elector.electorContract.address, toNano(DAYLE_REWARD * COUNT_OF_REPORTS));

    const SECONDS_BETWEEN_REPORTS = 30;
    for (let _ of Array(COUNT_OF_REPORTS)) {
      await controllers[0].sendRequestLoan({
        queryId: 1,
        minLoan: toNano(1),
        maxLoan: toNano(MIN_STAKE_TO_SEND),
        maxInterest: "0",
      });

      await controllers[0].runFullCycle({
        queryId: 1,
        maxFactor: 1,
        adnlAddr: "0x1",
        stakeAt: 1,
        valueToStake: toNano(MIN_STAKE_TO_SEND),
        validatorPubKey: "0x1",
      });
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
  });
});
