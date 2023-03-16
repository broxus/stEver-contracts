import { Contract, toNano } from "locklift";
import { Address } from "locklift/everscale-provider";
import { StEverClusterAbi } from "../../build/factorySource";
import { Vault } from "./vault";
import { Account } from "locklift/everscale-client";
import { StrategyFactory } from "./strategyFactory";
import { createStrategy } from "./dePoolStrategy";
import { SignerWithAccount } from "../highOrderUtils";
import { mergeMap, range, toArray } from "rxjs";
import { toNanoBn } from "../index";
import { expect } from "chai";

export class Cluster {
  constructor(public readonly clusterContract: Contract<StEverClusterAbi>, private readonly clusterOwner: Account) {}

  addStrategies = async (strategies: Array<Address>) => {
    return locklift.tracing.trace(
      this.clusterContract.methods.addStrategies({ _strategies: strategies }).send({
        from: this.clusterOwner.address,
        amount: toNanoBn(1.5).multipliedBy(strategies.length).plus(toNano(1)).toString(),
      }),
      { raise: false },
    );
  };
  removeCluster = async () => {
    const { currentStrategiesCount } = await this.clusterContract.methods
      .getDetails({ answerId: 0 })
      .call()
      .then(res => res.value0);
    return locklift.tracing.trace(
      this.clusterContract.methods.dropCluster().send({
        from: this.clusterOwner.address,
        amount: toNano((1 + 0.2) * Number(currentStrategiesCount)),
      }),
      { raise: false },
    );
  };

  removeStrategies = (strategies: Array<Address>) => {
    return locklift.tracing.trace(
      this.clusterContract.methods
        .removeStrategies({
          _strategies: strategies,
        })
        .send({
          from: this.clusterOwner.address,
          amount: toNano((1 + 0.2) * strategies.length),
        }),
      { raise: false },
    );
  };

  deployStrategy = async ({ dePools }: { dePools: Array<Address> }): Promise<Address> => {
    const { traceTree } = await locklift.tracing.trace(
      this.clusterContract.methods
        .deployStrategies({
          _dePools: dePools,
        })
        .send({
          from: this.clusterOwner.address,
          amount: toNanoBn(23).multipliedBy(dePools.length).toString(),
        }),
      { raise: false },
    );
    expect(traceTree).to.emit("NewStrategyDeployed", this.clusterContract).count(dePools.length);

    return traceTree!.findForContract({
      contract: this.clusterContract,
      name: "NewStrategyDeployed",
    })[0]!.params!.strategy;
  };

  getDetails = () =>
    this.clusterContract.methods
      .getDetails({ answerId: 0 })
      .call()
      .then(res => res.value0);
  getStrategies = () =>
    this.clusterContract.methods
      .strategies()
      .call()
      .then(res => res.strategies);
  static create = async ({
    vault,
    assurance,
    clusterOwner,
    maxStrategiesCount,
  }: {
    vault: Vault;
    clusterOwner: Account;
    assurance: string;
    maxStrategiesCount: number;
  }): Promise<Cluster> => {
    const clusterContract = await vault.createCluster({
      maxStrategiesCount,
      assurance,
      clusterOwner: clusterOwner.address,
    });
    return new Cluster(clusterContract, clusterOwner);
  };
}
