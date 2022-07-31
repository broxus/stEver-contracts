import { Account } from "locklift/build/factory";
import { TokenRootAbi, VaultAbi, WalletAbi } from "../build/factorySource";
import { TokenWallet } from "./tokenWallet";
import { Contract } from "locklift";
import { assertEvent } from "./index";
import { expect } from "chai";

export class User {
  constructor(
    public readonly account: Account<WalletAbi>,
    public readonly wallet: TokenWallet,
    protected readonly vault: { contract: Contract<VaultAbi>; wallet: TokenWallet },
  ) {}

  makeWithdrawRequest = async (amount: number) => {
    const nonce = locklift.utils.getRandomNonce();
    console.log(`nonceToPayload: ${nonce}`);
    const depositPayload = await this.vault.contract.methods
      .encodeDepositPayload({
        _nonce: nonce,
        deposit_owner: this.account.address,
      })
      .call();
    const txWithNonce = await locklift.tracing
      .trace(
        this.account.runTarget(
          {
            contract: this.wallet.walletContract,
            value: locklift.utils.toNano(2),
          },
          walletContract =>
            walletContract.methods.transfer({
              remainingGasTo: this.account.address,
              deployWalletValue: 0,
              amount: locklift.utils.toNano(amount),
              notify: true,
              recipient: this.vault.contract.address,
              payload: depositPayload.deposit_payload,
            }),
        ),
        { allowedCodes: { compute: [null] } },
      )
      .then(res => ({ ...res, nonce }));
    expect(await this.vault.wallet.getBalance().then(res => res.toString())).to.be.equals(
      locklift.utils.toNano(amount),
    );
    const { events: withdrawRequestEvents } = await this.vault.contract.getPastEvents({
      filter: event => event.event === "WithdrawRequest",
    });
    assertEvent(withdrawRequestEvents, "WithdrawRequest");
    expect(withdrawRequestEvents[0].data.user.equals(this.account.address)).to.be.true;
    expect(withdrawRequestEvents[0].data.amount).to.be.equals(locklift.utils.toNano(amount));
    expect(withdrawRequestEvents[0].data.nonce).to.be.equals(nonce.toString());
    return txWithNonce;
  };

  depositToVault = async (amount: number): Promise<any> => {
    await locklift.tracing.trace(
      this.account.runTarget(
        {
          contract: this.vault.contract,
          value: locklift.utils.toNano(amount + 2),
        },
        vaultContract =>
          vaultContract.methods.deposit({
            _amount: locklift.utils.toNano(amount),
            _nonce: locklift.utils.getRandomNonce(),
          }),
      ),
    );
    const depositEvent = await this.vault.contract.getPastEvents({ filter: event => event.event === "Deposit" });
    assertEvent(depositEvent.events, "Deposit");

    const {
      data: { user, depositAmount, receivedStEvers },
    } = depositEvent.events[0];
    expect(user.equals(this.account.address)).to.be.true;
    expect(depositAmount).to.be.equals(locklift.utils.toNano(amount));
    expect(receivedStEvers).to.be.equals(locklift.utils.toNano(amount));

    const balance = await this.wallet.getBalance();
    expect(balance).to.be.equals(locklift.utils.toNano(amount));
  };
}

export const createUserEntity = async (
  account: Account<WalletAbi>,
  tokenRoot: Contract<TokenRootAbi>,
  vaultContract: Contract<VaultAbi>,
): Promise<User> => {
  const wallet = await TokenWallet.getWallet(locklift.provider, account.address, tokenRoot);
  const vaultWallet = await TokenWallet.getWallet(locklift.provider, vaultContract.address, tokenRoot);
  return new User(account, wallet, { contract: vaultContract, wallet: vaultWallet });
};
