import { ProviderRpcClient, Address } from "locklift/everscale-provider";
import { factorySource, TokenRootUpgradeableAbi, TokenWalletAbi } from "../../build/factorySource";
import { Contract } from "locklift";
import BigNumber from "bignumber.js";

export class TokenWallet {
  constructor(public readonly walletContract: Contract<TokenWalletAbi>) {}
  static getWallet = async (
    ever: ProviderRpcClient,
    accountAddress: Address,
    tokenRootContract: Contract<TokenRootUpgradeableAbi>,
  ): Promise<TokenWallet> => {
    const userTokenWallet = await tokenRootContract.methods
      .walletOf({ answerId: 1, walletOwner: accountAddress })
      .call()
      .then(res => res.value0 as Address);

    return new TokenWallet(new ever.Contract(factorySource.TokenWallet, userTokenWallet));
  };

  getBalance = async (): Promise<BigNumber> => {
    return this.walletContract.methods
      .balance({
        answerId: 3,
      })
      .call()
      .then(res => new BigNumber(res.value0));
  };
}
