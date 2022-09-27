import { Account } from "locklift/everscale-standalone-client";

import { DepoolStrategyFactoryAbi } from "../../build/factorySource";
import { Address, Contract } from "locklift";
import { Vault } from "./vault";

export class StrategyFactory {
  constructor(
    private readonly owner: Account,
    private readonly factoryContract: Contract<DepoolStrategyFactoryAbi>,
    private readonly vault: Vault,
  ) {}
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
}
