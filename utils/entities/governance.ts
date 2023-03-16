import { Contract, Signer } from "locklift";
import { StEverVaultAbi } from "../../build/factorySource";

import { UpgradedVault, Vault } from "./vault";

export class Governance {
  constructor(public readonly keyPair: Signer, private vault: Vault) {}
  emitWithdraw = async (...params: Parameters<Contract<StEverVaultAbi>["methods"]["processSendToUsers"]>) => {
    return await locklift.tracing.trace(
      this.vault.vaultContract.methods
        .processSendToUsers(...params)
        .sendExternal({ publicKey: this.keyPair.publicKey }),
    );
  };

  setUpgradedVault = (upgradedVault: UpgradedVault) => {
    this.vault = upgradedVault;
  };

  depositToStrategies = async (
    ...params: [...Parameters<Contract<StEverVaultAbi>["methods"]["depositToStrategies"]>, boolean?]
  ) => {
    const { transaction, traceTree } = await locklift.tracing.trace(
      this.vault.vaultContract.methods
        .depositToStrategies(params[0])
        .sendExternal({ publicKey: this.keyPair.publicKey }),
      { raise: params[1] },
    );

    const depositSuccessEvents = traceTree?.findEventsForContract({
      contract: this.vault.vaultContract,
      name: "StrategyHandledDeposit" as const,
    });
    const depositToStrategyErrorEvents = traceTree?.findEventsForContract({
      name: "StrategyDidntHandleDeposit" as const,
      contract: this.vault.vaultContract,
    });
    const processingErrorEvent = traceTree?.findEventsForContract({
      name: "ProcessDepositToStrategyError" as const,
      contract: this.vault.vaultContract,
    });
    return {
      successEvents: depositSuccessEvents,
      errorEvents: depositToStrategyErrorEvents,
      processingErrorEvent,
      transaction,
      traceTree,
    };
  };

  withdrawFromStrategiesRequest = async (
    ...params: [...Parameters<Contract<StEverVaultAbi>["methods"]["processWithdrawFromStrategies"]>, boolean?]
  ) => {
    const { transaction, traceTree } = await locklift.tracing.trace(
      this.vault.vaultContract.methods
        .processWithdrawFromStrategies(params[0])
        .sendExternal({ publicKey: this.keyPair.publicKey }),
      { raise: params[1] },
    );

    const successEvents = traceTree!.findEventsForContract({
      contract: this.vault.vaultContract,
      name: "StrategyHandledWithdrawRequest" as const,
    });
    const errorEvent = traceTree!.findEventsForContract({
      contract: this.vault.vaultContract,
      name: "StrategyWithdrawError" as const,
    });
    const processingErrorEvent = traceTree!.findEventsForContract({
      contract: this.vault.vaultContract,
      name: "ProcessWithdrawFromStrategyError" as const,
    });
    return {
      successEvents,
      errorEvent,
      transaction,
      processingErrorEvent,
      traceTree,
    };
  };

  forceWithdrawFromStrategies = async (
    ...params: [...Parameters<Contract<StEverVaultAbi>["methods"]["forceWithdrawFromStrategies"]>, boolean?]
  ) => {
    const { transaction, traceTree } = await locklift.tracing.trace(
      this.vault.vaultContract.methods
        .forceWithdrawFromStrategies(params[0])
        .sendExternal({ publicKey: this.keyPair.publicKey }),
      { raise: params[1] },
    );
    const successEvents = await this.vault.getEventsAfterTransaction({
      eventName: "StrategyWithdrawSuccess",
      parentTransaction: transaction,
    });
    const errorEvent = await this.vault.getEventsAfterTransaction({
      eventName: "StrategyWithdrawError",
      parentTransaction: transaction,
    });
    const processingErrorEvent = await this.vault.getEventsAfterTransaction({
      eventName: "ProcessWithdrawFromStrategyError",
      parentTransaction: transaction,
    });
    return {
      successEvents,
      errorEvent,
      transaction,
      processingErrorEvent,
      traceTree,
    };
  };

  withdrawFee = ({ amount }: { amount: number }) => {
    return locklift.tracing.trace(
      this.vault.vaultContract.methods
        .withdrawStEverFee({
          _amount: amount,
        })
        .sendExternal({
          publicKey: this.keyPair.publicKey,
        }),
    );
  };

  withdrawExtraMoneyFromStrategy = async (
    ...params: Parameters<Contract<StEverVaultAbi>["methods"]["processWithdrawExtraMoneyFromStrategies"]>
  ) => {
    const { transaction, traceTree } = await locklift.tracing.trace(
      this.vault.vaultContract.methods.processWithdrawExtraMoneyFromStrategies(...params).sendExternal({
        publicKey: this.keyPair.publicKey,
      }),
    );
    // const successEvents = await this.vault.getEventsAfterTransaction({
    //   eventName: "ReceiveExtraMoneyFromStrategy",
    //   parentTransaction: transaction,
    // });
    const successEvents = traceTree!.findEventsForContract({
      contract: this.vault.vaultContract,
      name: "ReceiveExtraMoneyFromStrategy" as const,
    });
    return {
      successEvents,
      traceTree,
    };
  };
}
