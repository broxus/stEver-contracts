import { TokenRootUpgradeableAbi, VaultAbi } from "../build/factorySource";
import { Contract } from "locklift";
import { User } from "./user";
import { TokenWallet } from "./tokenWallet";
import { expect } from "chai";

export class Vault {
  constructor(
    private readonly adminAccount: User,
    public readonly vaultContract: Contract<VaultAbi>,
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
}

export const creteVault = async ({
  adminAccount,
  tokenRootContract,
  vaultContract,
}: {
  adminAccount: User;
  vaultContract: Contract<VaultAbi>;
  tokenRootContract: Contract<TokenRootUpgradeableAbi>;
}): Promise<Vault> => {
  const vaultTokenWallet = await TokenWallet.getWallet(locklift.provider, vaultContract.address, tokenRootContract);
  return new Vault(adminAccount, vaultContract, tokenRootContract, vaultTokenWallet);
};
