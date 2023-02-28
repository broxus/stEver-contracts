import { preparation } from "./preparation";
import { Contract, Signer, toNano } from "locklift";
import { User } from "../utils/entities/user";
import { Governance } from "../utils/entities/governance";
import { TokenRootUpgradeableAbi } from "../build/factorySource";

import { expect } from "chai";
import { Vault } from "../utils/entities/vault";
import { createStrategy, DePoolStrategyWithPool } from "../utils/entities/dePoolStrategy";

import { StrategyFactory } from "../utils/entities/strategyFactory";
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
let strategy: DePoolStrategyWithPool;
describe("Cluster create and immediately remove", () => {
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
  });
  it("cluster should created", async () => {
    cluster = await Cluster.create({
      vault,
      clusterOwner: admin.account,
      assurance: toNano(0),
      maxStrategiesCount: 10,
    });
    const clustersPool = await vault.vaultContract.methods
      .clusterPools()
      .call()
      .then(res => res.clusterPools);

    expect(clustersPool.length).to.be.eq(1, "only one clusters owner");
    const [clusterOwner, { currentClusterNonce, clusters }] = clustersPool[0];
    expect(clusterOwner.equals(admin.account.address)).to.be.true;
    expect(currentClusterNonce).to.be.eq("0", "First nonce of clusters");
    expect(clusters.length).to.be.eq(1, "Owner has only one cluster");
    const [clusterNonce, clusterAddress] = clusters[0];
    expect(clusterNonce).to.be.eq(currentClusterNonce);
    expect(clusterAddress.equals(cluster.clusterContract.address)).to.be.true;
  });
  it("second cluster should created", async () => {
    const cluster2 = await Cluster.create({
      vault,
      clusterOwner: admin.account,
      assurance: toNano(0),
      maxStrategiesCount: 10,
    });
    const clustersPool = await vault.vaultContract.methods
      .clusterPools()
      .call()
      .then(res => res.clusterPools);

    expect(clustersPool.length).to.be.eq(1, "only one clusters owner");
    const [clusterOwner, { currentClusterNonce, clusters }] = clustersPool[0];
    expect(clusterOwner.equals(admin.account.address)).to.be.true;
    expect(currentClusterNonce).to.be.eq("1", "Second nonce of cluster");
    expect(clusters.length).to.be.eq(2, "Now owner has two clusters");
    const [clusterNonce, clusterAddress] = clusters[1];
    expect(clusterNonce).to.be.eq(currentClusterNonce);
    expect(clusterAddress.equals(cluster2.clusterContract.address)).to.be.true;
  });
  it("cluster should create one strategy", async () => {
    strategy = await createStrategy({
      cluster,
      poolDeployValue: locklift.utils.toNano(200),
      signer,
    });
    const { traceTree: addStrategyTraceTree } = await cluster.addStrategies([strategy.strategy.address]);
    expect(addStrategyTraceTree)
      .to.emit("StrategiesAdded")
      .withNamedArgs({
        strategy: [strategy.strategy.address],
      });
    const strategyInfo = await vault.getStrategyInfo(strategy.strategy.address);
    expect(strategyInfo.cluster.equals(cluster.clusterContract.address)).to.be.true;
  });
  it("cluster should removed", async () => {
    const { traceTree: removeClusterTraceTree } = await vault.removeCluster({
      clusterNonce: 0,
      clusterOwner: admin.account.address,
    });
    expect(removeClusterTraceTree)
      .to.emit("ClusterRemoved")
      .withNamedArgs({
        cluster: cluster.clusterContract.address,
        clusterOwner: admin.account.address,
        clusterNonce: "0",
      })
      .and.emit("StrategyRemoved")
      .withNamedArgs({
        strategy: strategy.strategy.address,
      });
    const strategiesInfo = await vault.getStrategiesInfo();
    expect(Object.keys(strategiesInfo).length).to.be.eq(0);
    const clusters = await vault.vaultContract.methods
      .clusterPools()
      .call()
      .then(res => res.clusterPools);
    expect(clusters.length).to.be.eq(1);
  });
});
