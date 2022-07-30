import { User } from "./user";
import { Account } from "locklift/build/factory";
import { VaultAbi, WalletAbi } from "../build/factorySource";
import { TokenWallet } from "./tokenWallet";
import { Contract } from "locklift";

export class Admin extends User {
  constructor(
    public readonly account: Account<WalletAbi>,
    public readonly wallet: TokenWallet,
    protected readonly vaultContract: Contract<VaultAbi>,
  ) {
    super(account, wallet, vaultContract);
  }
}
