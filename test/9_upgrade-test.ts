import { Contract, Signer } from "locklift";
import { User } from "../utils/entities/user";
import { Governance } from "../utils/entities/governance";
import { TokenRootUpgradeableAbi } from "../build/factorySource";
import { Vault } from "../utils/entities/vault";
import { StrategyFactory } from "../utils/entities/strategyFactory";
import { preparation } from "./preparation";

import { createStrategy, DePoolStrategyWithPool } from "../utils/entities/dePoolStrategy";
import { expect } from "chai";
import { toNanoBn } from "../utils";
import { Cluster } from "../utils/entities/cluster";

const STRATEGIES_COUNT = 40;
const DEPOSIT_TO_STRATEGY_VALUE = 120;
const DEPOSIT_FEE = toNanoBn(0.6);
let signer: Signer;
let admin: User;
let governance: Governance;
let user1: User;

let tokenRoot: Contract<TokenRootUpgradeableAbi>;

let strategyFactory: StrategyFactory;
let vault: Vault;
let governanceSigner: Signer;

let strategies: Array<DePoolStrategyWithPool>;
describe.skip("Upgrade testing", function () {
  before(async () => {
    const {
      signer: s,
      governanceSigner: g,
      users: [adminUser, _, u1],
      vault: v,
    } = await preparation({
      deployUserValue: locklift.utils.toNano(STRATEGIES_COUNT * DEPOSIT_TO_STRATEGY_VALUE + 500),
    });
    signer = s;
    admin = adminUser;
    user1 = u1;
    vault = v;

    governanceSigner = g;
  });

  it("Old_StEverCluster code should be set", async () => {
    const { code: oldStEverClusterCode } = locklift.factory.getContractArtifacts("Old_StEverCluster");
    await vault.setNewClusterCode(oldStEverClusterCode);
    expect(await vault.getDetails().then(res => res.clusterVersion)).to.be.eq("1");
  });
  it("Old_StEverCluset should be create", async () => {
    const oldCluster = await vault
      .createCluster({
        maxStrategiesCount: 10,
        clusterOwner: admin.account.address,
        assurance: "0",
      })
      .then(clusterContract => new Cluster(clusterContract, admin.account));

    const strategy = await createStrategy({
      cluster: oldCluster,
      poolDeployValue: locklift.utils.toNano(200),
      signer,
    });

    expect(
      await oldCluster.clusterContract.methods
        .deployedStrategies()
        .call()
        .then(({ deployedStrategies }) => deployedStrategies[0][0].equals(strategy.strategy.address)),
    ).to.be.true;

    await oldCluster.addStrategies([strategy.strategy.address]);

    expect(await oldCluster.getDetails().then(({ currentStrategiesCount }) => currentStrategiesCount)).to.be.eq("1");
    // await oldCluster.removeStrategies([strategy.strategy.address]);
    // expect(
    //   await oldCluster.clusterContract.methods
    //     .strategies()
    //     .call()
    //     .then(({ strategies }) => strategies[0][1].state),
    // ).to.be.eq("3");

    const { code: newClusterCode } = locklift.factory.getContractArtifacts("StEverCluster");
    await vault.setNewClusterCode(newClusterCode);
    expect(await vault.getDetails().then(({ clusterVersion }) => clusterVersion)).to.be.eq("2");
    await vault.upgradeClusters([oldCluster.clusterContract.address]);
    const newCluster = new Cluster(
      locklift.factory.getDeployedContract("StEverCluster", oldCluster.clusterContract.address),
      admin.account,
    );

    expect(await newCluster.getDetails().then(res => res.currentVersion)).to.be.eq("2");
    expect(
      await newCluster.clusterContract.methods
        .getDetails({ answerId: 0 })
        .call()
        .then(({ value0: { currentStrategiesCount } }) => currentStrategiesCount),
    ).to.be.eq("1");
  });
});
