import { StEverVaultAbi, TestStEverVaultAbi, TokenRootUpgradeableAbi, WalletAbi } from "../../build/factorySource";
import { AbiEventName, Address, Contract, DecodedEventWithTransaction, toNano, Transaction } from "locklift";
import { TokenWallet } from "./tokenWallet";
import { expect } from "chai";
import BigNumber from "bignumber.js";
import { Account } from "locklift/everscale-standalone-client";
import { ConstructorParams } from "locklift/build/types";

type VaultEvents = DecodedEventWithTransaction<StEverVaultAbi, AbiEventName<StEverVaultAbi>>["event"];
type ExtractEvent<T extends VaultEvents> = Extract<
  DecodedEventWithTransaction<StEverVaultAbi, AbiEventName<StEverVaultAbi>>,
  { event: T }
>;
export class Vault {
  constructor(
    protected readonly adminAccount: Account,
    public readonly vaultContract: Contract<StEverVaultAbi> | Contract<TestStEverVaultAbi>,
    protected readonly tokenRootContract: Contract<TokenRootUpgradeableAbi>,
    public readonly tokenWallet: TokenWallet,
  ) {}

  setMinDepositToStrategyValue = async ({ minDepositToStrategyValue }: { minDepositToStrategyValue: string }) => {
    await locklift.tracing.trace(
      this.vaultContract.methods
        .setMinStrategyDepositValue({ _minStrategyDepositValue: minDepositToStrategyValue })
        .send({
          from: this.adminAccount.address,
          amount: toNano(2),
        }),
    );
  };

  setMinWithdrawFromStrategyValue = async ({
    minWithdrawFromStrategyValue,
  }: {
    minWithdrawFromStrategyValue: string;
  }) => {
    await locklift.tracing.trace(
      this.vaultContract.methods
        .setMinStrategyWithdrawValue({
          _minStrategyWithdrawValue: minWithdrawFromStrategyValue,
        })
        .send({
          from: this.adminAccount.address,
          amount: toNano(2),
        }),
    );
  };

  setGainFee = async ({ ginFee }: { ginFee: string }) => {
    await locklift.tracing.trace(
      this.vaultContract.methods.setGainFee({ _gainFee: ginFee }).send({
        from: this.adminAccount.address,
        amount: toNano(2),
      }),
    );
  };

  setStEverFeePercent = async ({ percentFee }: { percentFee: number }) => {
    await locklift.tracing.trace(
      this.vaultContract.methods
        .setStEverFeePercent({
          _stEverFeePercent: percentFee,
        })
        .send({
          from: this.adminAccount.address,
          amount: toNano(2),
        }),
    );
  };

  getDetails = async () =>
    this.vaultContract.methods
      .getDetails({ answerId: 0 })
      .call()
      .then(async ({ value0 }) => {
        const availableAssets = new BigNumber(value0.availableAssets);

        const contractBalance = await locklift.provider
          .getBalance(this.vaultContract.address)
          .then(res => new BigNumber(res));

        expect(contractBalance.toNumber()).to.be.gte(
          availableAssets.toNumber(),
          "Vault contract balance should always be gte available assets",
        );

        return {
          ...value0,
          stEverSupply: new BigNumber(value0.stEverSupply),
          totalAssets: new BigNumber(value0.totalAssets),
          stEverFeePercent: new BigNumber(value0.stEverFeePercent),
          totalStEverFee: new BigNumber(value0.totalStEverFee),
          availableAssets,
          contractBalance: await locklift.provider
            .getBalance(this.vaultContract.address)
            .then(res => new BigNumber(res)),
        };
      });

  getStrategiesInfo = () =>
    this.vaultContract.methods
      .strategies({})
      .call()
      .then(res =>
        res.strategies.reduce(
          (acc, strategy) => ({ ...acc, [strategy[0].toString()]: strategy[1] }),
          {} as Record<string, typeof res["strategies"][0][1]>,
        ),
      );

  getRate = async () => {
    const { stEverSupply, totalAssets } = await this.getDetails();
    console.log(
      `stEverSupply ${locklift.utils.fromNano(stEverSupply.toString())},totalAssets ${locklift.utils.fromNano(
        totalAssets.toString(),
      )}`,
    );
    return this.getDetails().then(({ stEverSupply, totalAssets }) => totalAssets.dividedBy(stEverSupply));
  };

  getStrategyInfo = (address: Address) => this.getStrategiesInfo().then(strategies => strategies[address.toString()]);

  getEventsAfterTransaction = async <T extends VaultEvents>({
    eventName,
    parentTransaction,
  }: {
    eventName: T;
    parentTransaction: Transaction;
  }) => {
    return (await this.vaultContract
      .getPastEvents({
        filter: ({ event, transaction }) => {
          return event === eventName && transaction.createdAt >= parentTransaction.createdAt;
        },
      })
      .then(res => res.events)) as Array<ExtractEvent<T>>;
  };

  changeEmergencyPausedState = ({ isPaused }: { isPaused: boolean }) => {
    return locklift.tracing.trace(
      this.vaultContract.methods.changeEmergencyPauseState({ _isPaused: isPaused }).send({
        from: this.adminAccount.address,
        amount: toNano(2),
      }),
    );
  };

  stopEmergencyProcess = () => {
    return locklift.tracing.trace(
      this.vaultContract.methods.stopEmergencyProcess().send({
        from: this.adminAccount.address,
        amount: toNano(2),
      }),
    );
  };

  withdrawExtraEver = async () => {
    return locklift.tracing.trace(
      this.vaultContract.methods.withdrawExtraEver().send({
        from: this.adminAccount.address,
        amount: toNano(2),
      }),
    );
  };

  setNewAccountCode = async () => {
    const { code: testAccountCode } = locklift.factory.getContractArtifacts("TestStEverAccount");
    const transaction = await locklift.tracing.trace(
      this.vaultContract.methods.setNewAccountCode({ _newAccountCode: testAccountCode }).send({
        from: this.adminAccount.address,
        amount: toNano(2),
      }),
    );
    const installEvents = await this.getEventsAfterTransaction({
      eventName: "NewAccountCodeSet",
      parentTransaction: transaction,
    });
    expect(installEvents.length).to.be.eq(1);
    expect(installEvents[0].data.newVersion).to.be.equals("1");
    return {
      transaction,
      installEvent: installEvents[0],
    };
  };

  upgradeVault = async (newVersion: number): Promise<UpgradedVault> => {
    const { tvc, abi, code } = locklift.factory.getContractArtifacts("TestStEverVault");
    await locklift.tracing.trace(
      this.vaultContract.methods
        .upgrade({
          _newCode: code,
          _sendGasTo: this.adminAccount.address,
          _newVersion: newVersion,
        })
        .send({
          from: this.adminAccount.address,
          amount: toNano(2),
        }),
    );
    return new UpgradedVault(
      this.adminAccount,
      locklift.factory.getDeployedContract("TestStEverVault", this.vaultContract.address),
      this.tokenRootContract,
      this.tokenWallet,
    );
  };
}

export class UpgradedVault extends Vault {
  constructor(
    protected readonly adminAccount: Account,
    public readonly vaultContract: Contract<TestStEverVaultAbi>,
    protected readonly tokenRootContract: Contract<TokenRootUpgradeableAbi>,
    public readonly tokenWallet: TokenWallet,
  ) {
    super(adminAccount, vaultContract, tokenRootContract, tokenWallet);
  }

  checkIsUpdateApplied = () => {
    return this.vaultContract.methods.checkIsUpdateApplied().call();
  };
}

export const creteVault = async ({
  adminAccount,
  tokenRootContract,
  vaultContract,
}: {
  adminAccount: Account;
  vaultContract: Contract<StEverVaultAbi>;
  tokenRootContract: Contract<TokenRootUpgradeableAbi>;
}): Promise<Vault> => {
  const vaultTokenWallet = await TokenWallet.getWallet(locklift.provider, vaultContract.address, tokenRootContract);
  return new Vault(adminAccount, vaultContract, tokenRootContract, vaultTokenWallet);
};
