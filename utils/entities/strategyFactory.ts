import { Account } from "locklift/build/factory";
import { DepoolStrategyFactoryAbi, WalletAbi } from "../../build/factorySource";
import { Address, Contract } from "locklift";
import { Vault } from "./vault";

export class StrategyFactory {
  constructor(
    private readonly owner: Account<WalletAbi>,
    private readonly factoryContract: Contract<DepoolStrategyFactoryAbi>,
    private readonly vault: Vault,
  ) {}
  deployStrategy = async ({ deployValue, dePool }: { deployValue: string; dePool: Address }): Promise<Address> =>
    locklift.tracing
      .trace(
        this.owner.runTarget(
          {
            contract: this.factoryContract,
            value: deployValue,
          },
          factory =>
            factory.methods.deployStrategy({
              _vault: this.vault.vaultContract.address,
              _dePool: dePool,
            }),
        ),
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
