import { Contract, Signer } from "locklift";
import { VaultAbi } from "../build/factorySource";
import { assertEvent } from "./index";
import { expect } from "chai";

export class Governance {
  constructor(public readonly keyPair: Signer, private readonly vaultContract: Contract<VaultAbi>) {}
  emitWithdraw = async (...params: Parameters<Contract<VaultAbi>["methods"]["processSendToUser"]>) => {
    await locklift.tracing.trace(
      this.vaultContract.methods.processSendToUser(...params).sendExternal({ publicKey: this.keyPair.publicKey }),
    );
  };

  depositToStrategies = async (...params: Parameters<Contract<VaultAbi>["methods"]["depositToStrategies"]>) => {
    await locklift.tracing.trace(
      this.vaultContract.methods.depositToStrategies(...params).sendExternal({ publicKey: this.keyPair.publicKey }),
    );
    const { events } = await this.vaultContract.getPastEvents({
      filter: ({ event }) => event === "StrategyHandledDeposit",
    });

    assertEvent(events, "StrategyHandledDeposit");
    console.log(`Returned strategy fee is ${locklift.utils.fromNano(events[0].data.returnedFee)}`);
  };
}
