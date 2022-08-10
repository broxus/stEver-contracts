import { Contract, Signer } from "locklift";
import { StEverVaultAbi } from "../../build/factorySource";

import { Vault } from "./vault";

export class Governance {
  constructor(public readonly keyPair: Signer, private readonly vault: Vault) {}
  emitWithdraw = async (...params: Parameters<Contract<StEverVaultAbi>["methods"]["processSendToUsers"]>) => {
    await locklift.tracing.trace(
      this.vault.vaultContract.methods
        .processSendToUsers(...params)
        .sendExternal({ publicKey: this.keyPair.publicKey }),
    );
  };

  depositToStrategies = async (...params: Parameters<Contract<StEverVaultAbi>["methods"]["depositToStrategies"]>) => {
    await locklift.tracing.trace(
      this.vault.vaultContract.methods
        .depositToStrategies(...params)
        .sendExternal({ publicKey: this.keyPair.publicKey }),
    );
  };

  withdrawFromStrategies = async (
    ...params: Parameters<Contract<StEverVaultAbi>["methods"]["processWithdrawFromStrategies"]>
  ) => {
    const { transaction } = await locklift.tracing.trace(
      this.vault.vaultContract.methods
        .processWithdrawFromStrategies(...params)
        .sendExternal({ publicKey: this.keyPair.publicKey }),
    );
    const successEvents = await this.vault.getEventsAfterTransaction({
      eventName: "StrategyWithdrawSuccess",
      parentTransaction: transaction,
    });
    const errorEvent = await this.vault.getEventsAfterTransaction({
      eventName: "StrategyWithdrawError",
      parentTransaction: transaction,
    });
    return {
      successEvents,
      errorEvent,
      transaction,
    };
  };
}
