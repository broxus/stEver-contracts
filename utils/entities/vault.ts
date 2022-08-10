import { StEverVaultAbi, TokenRootUpgradeableAbi } from "../../build/factorySource";
import { AbiEventName, Address, Contract, DecodedEventWithTransaction, Transaction } from "locklift";
import { User } from "./user";
import { TokenWallet } from "./tokenWallet";
import { expect } from "chai";
import BigNumber from "bignumber.js";
import { assertEvent } from "../index";
type VaultEvents = DecodedEventWithTransaction<StEverVaultAbi, AbiEventName<StEverVaultAbi>>["event"];
type ExtractEvent<T extends VaultEvents> = Extract<
  DecodedEventWithTransaction<StEverVaultAbi, AbiEventName<StEverVaultAbi>>,
  { event: T }
>;
export class Vault {
  constructor(
    private readonly adminAccount: User,
    public readonly vaultContract: Contract<StEverVaultAbi>,
    private readonly tokenRootContract: Contract<TokenRootUpgradeableAbi>,
    public readonly tokenWallet: TokenWallet,
  ) {}

  initialize = async () => {
    await locklift.tracing.trace(
      this.adminAccount.account.runTarget(
        {
          contract: this.vaultContract,
        },
        vault =>
          vault.methods.initVault({
            _stTokenRoot: this.tokenRootContract.address,
          }),
      ),
    );
    const details = await this.vaultContract.methods.getDetails({ answerId: 0 }).call({});
    expect(details.value0.stEverRoot.equals(this.tokenRootContract.address)).to.be.true;
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
        filter: ({ event, transaction }) =>
          event === eventName && transaction.prevTransactionId?.lt === parentTransaction.id.lt,
      })
      .then(res => res.events)) as Array<ExtractEvent<T>>;
  };
}

export const creteVault = async ({
  adminAccount,
  tokenRootContract,
  vaultContract,
}: {
  adminAccount: User;
  vaultContract: Contract<StEverVaultAbi>;
  tokenRootContract: Contract<TokenRootUpgradeableAbi>;
}): Promise<Vault> => {
  const vaultTokenWallet = await TokenWallet.getWallet(locklift.provider, vaultContract.address, tokenRootContract);
  return new Vault(adminAccount, vaultContract, tokenRootContract, vaultTokenWallet);
};
