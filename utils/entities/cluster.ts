import { Contract, toNano } from "locklift";
import { Address } from "locklift/everscale-provider";
import { StEverClusterAbi } from "../../build/factorySource";
import { Vault } from "./vault";
import { Account } from "locklift/everscale-client";
import { StrategyFactory } from "./strategyFactory";
import { createControllers } from "./dePoolStrategy";
import { SignerWithAccount } from "../highOrderUtils";
import { mergeMap, range, toArray } from "rxjs";
import { convertEverGas, toNanoBn } from "../index";
import { expect } from "chai";
import { ViewTracingTree } from "locklift/internal/tracing/viewTraceTree/viewTracingTree";
import { CONTROLLER_DEPLOY_VALUE, MIN_CALL_MSG_VALUE } from "../constants";

export class Cluster {
  constructor(
    public readonly clusterContract: Contract<StEverClusterAbi>,
    private readonly clusterOwner: Account,
    public readonly stEver: Address,
  ) {}

  removeCluster = async () => {
    const { currentStrategiesCount } = await this.clusterContract.methods
      .getDetails({ answerId: 0 })
      .call()
      .then(res => res.value0);
    return locklift.tracing.trace(
      this.clusterContract.methods.dropCluster({ _isPunish: false }).send({
        from: this.clusterOwner.address,
        amount: toNanoBn(convertEverGas(0.5))
          .multipliedBy(currentStrategiesCount)

          .plus(toNanoBn(convertEverGas(0.1)))
          .toString(),
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
          amount: toNano(convertEverGas((0.2 + 0.05 * 2) * strategies.length)),
        }),
      { raise: true },
    );
  };

  deployStrategy = async ({ validator, count }: { validator: Address; count: number }): Promise<ViewTracingTree> => {
    const gasForOneController = toNanoBn(CONTROLLER_DEPLOY_VALUE).plus(toNanoBn(convertEverGas(0.1)));

    const { traceTree } = await locklift.tracing.trace(
      this.clusterContract.methods
        .deployStrategies({
          _validator: validator,
          count,
        })
        .send({
          from: this.clusterOwner.address,
          amount: gasForOneController
            .multipliedBy(count)
            .plus(toNanoBn(convertEverGas(0.1)))
            .toString(),
        }),
      { raise: false },
    );
    return traceTree!;
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
    return new Cluster(clusterContract, clusterOwner, vault.vaultContract.address);
  };
}
