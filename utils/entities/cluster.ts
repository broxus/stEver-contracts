import { Contract, toNano } from "locklift";
import { Address } from "locklift/everscale-provider";
import { StEverClusterAbi } from "../../build/factorySource";
import { Vault } from "./vault";
import { Account } from "locklift/everscale-client";
import { StrategyFactory } from "./strategyFactory";
import { createStrategy } from "./dePoolStrategy";
import { SignerWithAccount } from "../highOrderUtils";
import { mergeMap, range, toArray } from "rxjs";

export class Cluster {
  constructor(
    public readonly clusterContract: Contract<StEverClusterAbi>,
    private readonly clusterOwner: Account,
    private readonly strategiesFactory: StrategyFactory,
  ) {}

  addStrategies = async (strategies: Array<Address>) => {
    return locklift.tracing.trace(
      this.clusterContract.methods.addStrategies({ _strategies: strategies }).send({
        from: this.clusterOwner.address,
        amount: toNano(10),
      }),
      { raise: false },
    );
  };

  removeStrategies = (strategies: Array<Address>, value: string) => {
    return locklift.tracing.trace(
      this.clusterContract.methods
        .removeStrategies({
          _strategies: strategies,
        })
        .send({
          from: this.clusterOwner.address,
          amount: value,
        }),
      { raise: false },
    );
  };

  getDetails = () =>
    this.clusterContract.methods
      .getDetails({ answerId: 0 })
      .call()
      .then(res => res.value0);
  static create = async ({
    vault,
    assurance,
    clusterOwner,
    maxStrategiesCount,
    strategyFactory,
  }: {
    vault: Vault;
    clusterOwner: Account;
    assurance: string;
    maxStrategiesCount: number;
    strategyFactory: StrategyFactory;
  }): Promise<Cluster> => {
    const clusterContract = await vault.createCluster({
      maxStrategiesCount,
      assurance,
      clusterOwner: clusterOwner.address,
    });
    return new Cluster(clusterContract, clusterOwner, strategyFactory);
  };
}
