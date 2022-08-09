import { Account } from "locklift/build/factory";
import { StEverAccountAbi, TokenRootUpgradeableAbi, VaultAbi, WalletAbi } from "../../build/factorySource";
import { TokenWallet } from "./tokenWallet";
import { Contract } from "locklift";
import { assertEvent } from "../index";
import { expect } from "chai";
import BigNumber from "bignumber.js";

export class User {
  constructor(
    public readonly account: Account<WalletAbi>,
    public readonly wallet: TokenWallet,
    protected readonly vault: { contract: Contract<VaultAbi>; wallet: TokenWallet },
    public readonly withdrawUserData: Contract<StEverAccountAbi>,
  ) {}

  makeWithdrawRequest = async (amount: string) => {
    const nonce = locklift.utils.getRandomNonce();
    const withdrawPayload = await this.vault.contract.methods
      .encodeDepositPayload({
        _nonce: nonce,
        _deposit_owner: this.account.address,
      })
      .call();
    const txWithNonce = await locklift.tracing
      .trace(
        this.account.runTarget(
          {
            contract: this.wallet.walletContract,
            value: locklift.utils.toNano(3),
          },
          walletContract =>
            walletContract.methods.transfer({
              remainingGasTo: this.account.address,
              deployWalletValue: 0,
              amount,
              notify: true,
              recipient: this.vault.contract.address,
              payload: withdrawPayload.deposit_payload,
            }),
        ),
        { allowedCodes: { compute: [null] } },
      )
      .then(res => ({ ...res, nonce }));
    expect(await this.vault.wallet.getBalance().then(res => res.toString())).to.be.equals(amount);
    const { events: withdrawRequestEvents } = await this.vault.contract.getPastEvents({
      filter: event => event.event === "WithdrawRequest",
    });
    assertEvent(withdrawRequestEvents, "WithdrawRequest");
    expect(withdrawRequestEvents[0].data.user.equals(this.account.address)).to.be.true;
    expect(withdrawRequestEvents[0].data.amount).to.be.equals(amount);
    expect(withdrawRequestEvents[0].data.nonce).to.be.equals(nonce.toString());
    return txWithNonce;
  };
  removeWithdrawRequest = async (nonce: number) => {
    await locklift.tracing.trace(
      this.account.runTarget(
        {
          contract: this.vault.contract,
          value: locklift.utils.toNano(2),
        },
        vault => vault.methods.removePendingWithdraw({ _nonce: nonce }),
      ),
    );
  };
  depositToVault = async (amount: string, fee: string = locklift.utils.toNano(2)): Promise<any> => {
    const feeBn = new BigNumber(fee);
    const amountBn = new BigNumber(amount);
    const { value0: stateBeforeWithdraw } = await this.vault.contract.methods.getDetails({ answerId: 0 }).call({});
    const depositRate = new BigNumber(stateBeforeWithdraw.stEverSupply).dividedBy(stateBeforeWithdraw.totalAssets);
    const expectedStEverAmount = depositRate.isNaN() ? amountBn : depositRate.times(amountBn);
    await locklift.tracing.trace(
      this.account.runTarget(
        {
          contract: this.vault.contract,
          value: amountBn.plus(feeBn).toString(),
        },
        vaultContract =>
          vaultContract.methods.deposit({
            _amount: amountBn.toString(),
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
    expect(depositAmount).to.be.equals(amountBn.toString(), "deposit amount should be equal to the amount deposited");

    expect(receivedStEvers).to.be.equals(
      expectedStEverAmount.toFixed(0, BigNumber.ROUND_DOWN).toString(),
      "user should receive the correct amount of stEvers",
    );
  };

  getWithdrawRequests = async (): Promise<Array<{ nonce: string; amount: string }>> => {
    const { withdrawRequests } = await this.withdrawUserData.methods.withdrawRequests({}).call();
    return withdrawRequests.map(([nonce, { amount }]) => ({ nonce, amount }));
  };
}

export const createUserEntity = async (
  account: Account<WalletAbi>,
  tokenRoot: Contract<TokenRootUpgradeableAbi>,
  vaultContract: Contract<VaultAbi>,
): Promise<User> => {
  const wallet = await TokenWallet.getWallet(locklift.provider, account.address, tokenRoot);
  const vaultWallet = await TokenWallet.getWallet(locklift.provider, vaultContract.address, tokenRoot);
  const withdrawUserData = await vaultContract.methods
    .getAccountAddress({
      _user: account.address,
      answerId: 0,
    })
    .call({});
  return new User(
    account,
    wallet,
    { contract: vaultContract, wallet: vaultWallet },
    locklift.factory.getDeployedContract("StEverAccount", withdrawUserData.value0),
  );
};
