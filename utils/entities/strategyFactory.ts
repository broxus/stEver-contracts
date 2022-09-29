import { Account } from "locklift/everscale-standalone-client";

import { DepoolStrategyFactoryAbi, TestDepoolStrategyFactoryAbi } from "../../build/factorySource";
import { Address, Contract, toNano } from "locklift";
import { Vault } from "./vault";

export class StrategyFactory {
  constructor(
    protected readonly owner: Account,
    protected readonly factoryContract: Contract<DepoolStrategyFactoryAbi> | Contract<TestDepoolStrategyFactoryAbi>,
    protected readonly vault: Vault,
  ) {}

  getDetails = () => {
    return this.factoryContract.methods.getDetails({ answerId: 0 }).call();
  };
  deployStrategy = async ({ deployValue, dePool }: { deployValue: string; dePool: Address }): Promise<Address> =>
    locklift.tracing
      .trace(
        this.factoryContract.methods
          .deployStrategy({
            _dePool: dePool,
          })
          .send({
            from: this.owner.address,
            amount: deployValue,
          }),
      )
      .then(async () => {
        const events = await this.factoryContract.getPastEvents({
          filter: ({ event }) => event === "NewStrategyDeployed",
        });
        if (events.events[0].event !== "NewStrategyDeployed") {
          throw new Error("NewStrategyDeployed event not emitted");
        }
        return events.events[0].data.strategy;
      });

  upgradeStrategyFactory = async (newVersion: number): Promise<UpgradedStrategyFactory> => {
    const { abi, code } = locklift.factory.getContractArtifacts("TestDepoolStrategyFactory");
    await locklift.tracing.trace(
      this.factoryContract.methods
        .upgrade({
          _newVersion: newVersion,
          _sendGasTo: this.owner.address,
          _newCode: code,
        })
        .send({
          from: this.owner.address,
          amount: toNano(2),
        }),
    );
    return new UpgradedStrategyFactory(
      this.owner,
      locklift.factory.getDeployedContract("TestDepoolStrategyFactory", this.factoryContract.address),
      this.vault,
    );
  };

  installNewStrategyCode = () => {
    const { code } = locklift.factory.getContractArtifacts("TestStrategyDePool");
    return locklift.tracing.trace(
      this.factoryContract.methods
        .installNewStrategyCode({ _strategyCode: code, _sendGasTo: this.owner.address })
        .send({ from: this.owner.address, amount: toNano(2) }),
    );
  };
  upgradeStrategies = (strategies: Array<Address>) => {
    return locklift.tracing.trace(
      this.factoryContract.methods
        .upgradeStrategies({
          _strategies: strategies,
        })
        .send({
          from: this.owner.address,
          amount: toNano((strategies.length + 1) * 2),
        }),
    );
  };
}

export class UpgradedStrategyFactory extends StrategyFactory {
  constructor(
    protected readonly owner: Account,
    protected readonly factoryContract: Contract<TestDepoolStrategyFactoryAbi>,
    protected readonly vault: Vault,
  ) {
    super(owner, factoryContract, vault);
  }
  checkIsUpdateApplied = () => {
    return this.factoryContract.methods.checkIsUpdateApplied().call();
  };
}
