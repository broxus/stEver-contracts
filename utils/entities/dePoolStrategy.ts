import { Contract, Signer } from "locklift";
import { Address } from "locklift/everscale-provider";
import { StEverVaultAbi, StrategyDePoolAbi, TestDepoolAbi } from "../../build/factorySource";
import { StrategyFactory } from "./strategyFactory";
import { getAddressEverBalance } from "../index";
import { Cluster } from "./cluster";
import { Controller } from "../controller";
import { expect } from "chai";

export class DePoolStrategyWithPool {
  constructor(
    public readonly dePoolContract: Contract<TestDepoolAbi>,
    public readonly strategy: Contract<StrategyDePoolAbi>,
    private readonly signer: Signer,
  ) {}

  emitDePoolRoundComplete = async (reward: string, withWithdraw = false, raise = true) => {
    return await locklift.tracing.trace(
      this.dePoolContract.methods
        .roundComplete({
          _reward: reward,
          includesWithdraw: withWithdraw,
        })
        .sendExternal({ publicKey: this.signer.publicKey }),
      { raise },
    );
  };

  emitWithdrawByRequests = async () => {
    const v = await locklift.tracing.trace(
      this.dePoolContract.methods
        .roundComplete({
          _reward: 0,
          includesWithdraw: true,
        })
        .sendExternal({ publicKey: this.signer.publicKey }),
      { raise: false },
    );
    return v;
  };

  setDePoolDepositsState = ({ isClosed }: { isClosed: boolean }) => {
    return locklift.tracing.trace(
      this.dePoolContract.methods.setClosed({ _closed: isClosed }).sendExternal({ publicKey: this.signer.publicKey }),
    );
  };
  setDePoolWithdrawalState = ({ isClosed }: { isClosed: boolean }) => {
    return locklift.tracing.trace(
      this.dePoolContract.methods
        .setWithdrawalsClosed({ _withdrawalsClosed: isClosed })
        .sendExternal({ publicKey: this.signer.publicKey }),
    );
  };

  terminateDePool = (remainingGasTo: Address) => {
    return this.dePoolContract.methods
      .terminator({
        _sendGasTo: remainingGasTo,
      })
      .sendExternal({
        publicKey: this.signer.publicKey,
      });
  };

  getStrategyBalance = () => locklift.provider.getBalance(this.strategy.address);
  getStrategyDetails = () =>
    this.strategy.methods
      .getDetails({ answerId: 0 })
      .call()
      .then(res => res.value0);
}

export const createControllers = async ({
  cluster,
  validator,
  count,
}: {
  validator: Address;
  cluster: Cluster;
  count: number;
}): Promise<Array<Controller>> => {
  const traceTree = await cluster.deployStrategy({
    validator,
    count,
  });
  expect(traceTree).to.emit("NewStrategyDeployed", cluster.clusterContract).count(count);
  expect(traceTree).to.emit("StrategyAdded", cluster.stEver).count(count);

  const controllers = traceTree!
    .findForContract({
      contract: cluster.clusterContract,
      name: "NewStrategyDeployed",
    })
    .map(el => el!.params!.strategy);

  await traceTree.beautyPrint();

  return controllers.map(s => new Controller(s, validator));
};
