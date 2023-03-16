import { Account } from "locklift/everscale-client";

import { DepoolStrategyFactoryAbi } from "../../build/factorySource";
import { Address, Contract, toNano } from "locklift";
import { Vault } from "./vault";
import { lastValueFrom, timer } from "rxjs";

export class StrategyFactory {
  constructor(
    protected readonly owner: Account,
    readonly factoryContract: Contract<DepoolStrategyFactoryAbi>,
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
        await lastValueFrom(timer(500));
        const events = await this.factoryContract.getPastEvents({
          filter: ({ event }) => event === "NewStrategyDeployed",
        });
        if (events.events[0].event !== "NewStrategyDeployed") {
          throw new Error("NewStrategyDeployed event not emitted");
        }
        return events.events[0].data.strategy;
      });

  installNewStrategyCode = (newCode: string) => {
    return locklift.tracing.trace(
      this.factoryContract.methods
        .installNewStrategyCode({ _strategyCode: newCode, _sendGasTo: this.owner.address })
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
