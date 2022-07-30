import { Contract } from "locklift";
import { VaultAbi, WalletAbi } from "../build/factorySource";
import { Account } from "locklift/build/factory";

export class Governance {
  constructor(public readonly account: Account<WalletAbi>, private readonly vaultContract: Contract<VaultAbi>) {}
  emitWithdraw = async (...params: Parameters<Contract<VaultAbi>["methods"]["processSendToUser"]>) => {
    await locklift.tracing.trace(
      this.account.runTarget(
        {
          contract: this.vaultContract,
          value: locklift.utils.toNano(30),
        },
        vault => vault.methods.processSendToUser(...params),
      ),
    );
  };
}
