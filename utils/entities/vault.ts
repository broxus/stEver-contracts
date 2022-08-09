import { StEverVaultAbi, TokenRootUpgradeableAbi } from "../../build/factorySource";
import { Address, Contract } from "locklift";
import { User } from "./user";
import { TokenWallet } from "./tokenWallet";
import { expect } from "chai";
import BigNumber from "bignumber.js";

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
      .call({})
      .then(({ value0 }) => ({
        ...value0,
        stEverSupply: new BigNumber(value0.stEverSupply),
        totalAssets: new BigNumber(value0.totalAssets),
        availableAssets: new BigNumber(value0.availableAssets),
      }));

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
