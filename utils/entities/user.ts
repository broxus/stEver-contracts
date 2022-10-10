import { StEverAccountAbi, TestStEverAccountAbi, TokenRootUpgradeableAbi } from "../../build/factorySource";
import { TokenWallet } from "./tokenWallet";
import { Address, Contract, fromNano, toNano } from "locklift";
import { expect } from "chai";
import BigNumber from "bignumber.js";
import { Account } from "locklift/everscale-standalone-client";

import { Vault } from "./vault";
import { concatMap, from, lastValueFrom, timer } from "rxjs";

export class User {
  constructor(
    public readonly account: Account,
    public readonly wallet: TokenWallet,
    protected readonly vault: Vault,
    public readonly withdrawUserData: Contract<StEverAccountAbi> | Contract<TestStEverAccountAbi>,
  ) {}

  makeWithdrawRequest = async (amount: string) => {
    const vaultBalanceBefore = await this.vault.tokenWallet.getBalance();
    const nonce = locklift.utils.getRandomNonce();
    const withdrawPayload = await this.vault.vaultContract.methods
      .encodeDepositPayload({
        _nonce: nonce,
      })
      .call();
    const txWithNonce = await locklift.tracing
      .trace(
        this.wallet.walletContract.methods
          .transfer({
            remainingGasTo: this.account.address,
            deployWalletValue: 0,
            amount,
            notify: true,
            recipient: this.vault.vaultContract.address,
            payload: withdrawPayload.depositPayload,
          })
          .send({
            from: this.account.address,
            amount: toNano(3),
          }),
        { allowedCodes: { compute: [null] } },
      )
      .then(res => ({ ...res, nonce }));

    expect(await this.vault.tokenWallet.getBalance().then(res => res.toString())).to.be.equals(
      vaultBalanceBefore.plus(amount).toString(),
    );
    // const { events: withdrawRequestEvents } = await this.vault.vaultContract.getPastEvents({
    //   filter: event => event.event === "WithdrawRequest",
    // });
    const withdrawRequestEvents = await this.vault.getEventsAfterTransaction({
      eventName: "WithdrawRequest",
      parentTransaction: txWithNonce,
    });
    expect(withdrawRequestEvents[0].data.user.equals(this.account.address)).to.be.true;
    expect(withdrawRequestEvents[0].data.amount).to.be.equals(amount);
    expect(withdrawRequestEvents[0].data.nonce).to.be.equals(nonce.toString());
    return txWithNonce;
  };
  removeWithdrawRequest = async (nonce: number) => {
    return await locklift.tracing.trace(
      this.vault.vaultContract.methods.removePendingWithdraw({ _nonce: nonce }).send({
        from: this.account.address,
        amount: toNano(2),
      }),
    );
  };
  depositToVault = async (amount: string, fee: string = locklift.utils.toNano(2)) => {
    const feeBn = new BigNumber(fee);
    const amountBn = new BigNumber(amount);
    const { value0: stateBeforeWithdraw } = await this.vault.vaultContract.methods.getDetails({ answerId: 0 }).call({});
    const depositRate = new BigNumber(stateBeforeWithdraw.stEverSupply).dividedBy(stateBeforeWithdraw.totalAssets);
    const expectedStEverAmount = depositRate.isNaN() ? amountBn : depositRate.times(amountBn);

    const transaction = await locklift.tracing.trace(
      this.vault.vaultContract.methods
        .deposit({
          _amount: amountBn.toString(),
          _nonce: locklift.utils.getRandomNonce(),
        })
        .send({
          from: this.account.address,
          amount: amountBn.plus(feeBn).toString(),
        }),
    );

    const depositEvents = await this.vault.getEventsAfterTransaction({
      eventName: "Deposit",
      parentTransaction: transaction,
    });

    const {
      data: { user, depositAmount, receivedStEvers },
    } = depositEvents[0];
    expect(user.equals(this.account.address)).to.be.true;
    expect(depositAmount).to.be.equals(amountBn.toString(), "deposit amount should be equal to the amount deposited");

    expect(receivedStEvers).to.be.equals(
      expectedStEverAmount.toFixed(0, BigNumber.ROUND_DOWN).toString(),
      "user should receive the correct amount of stEvers",
    );
    return transaction;
  };
  startEmergency = async ({ attachedValue, proofNonce }: { proofNonce: number; attachedValue: string }) => {
    const transaction = await locklift.tracing.trace(
      this.vault.vaultContract.methods
        .startEmergencyProcess({
          _poofNonce: proofNonce,
        })
        .send({
          from: this.account.address,
          amount: attachedValue,
        }),
    );
    const successEvents = await this.vault.getEventsAfterTransaction({
      eventName: "EmergencyProcessStarted",
      parentTransaction: transaction,
    });
    const errorEvents = await this.vault.getEventsAfterTransaction({
      eventName: "EmergencyProcessRejectedByAccount",
      parentTransaction: transaction,
    });
    return {
      successEvents,
      errorEvents,
    };
  };
  emergencyWithdraw = () => {
    return locklift.tracing.trace(
      this.vault.vaultContract.methods.emergencyWithdrawToUser().send({
        from: this.account.address,
        amount: toNano(2),
      }),
    );
  };

  getWithdrawRequests = async (): Promise<Array<{ nonce: string; amount: string }>> => {
    const { withdrawRequests } = await this.withdrawUserData.methods.withdrawRequests({}).call();
    return withdrawRequests.map(([nonce, { amount }]) => ({ nonce, amount }));
  };

  getUpgradedUserData = async (): Promise<UpgradedUser> => {
    await locklift.tracing.trace(
      this.vault.vaultContract.methods.upgradeStEverAccount().send({
        from: this.account.address,
        amount: toNano(2),
      }),
    );
    return new UpgradedUser(
      this.account,
      this.wallet,
      this.vault,
      locklift.factory.getDeployedContract("TestStEverAccount", this.withdrawUserData.address),
    );
  };

  upgradeAccounts = async (users: Array<Address>) => {
    const upgradeTransaction = await locklift.tracing.trace(
      this.vault.vaultContract.methods
        .upgradeStEverAccounts({
          _sendGasTo: this.account.address,
          _users: users,
        })
        .send({
          from: this.account.address,
          amount: toNano(5),
        }),
    );
    await lastValueFrom(timer(500));

    const upgradeEvents = await this.vault.getEventsAfterTransaction({
      eventName: "AccountUpgraded",
      parentTransaction: upgradeTransaction,
    });
    debugger;
    expect(upgradeEvents.length).to.be.eq(users.length);
    expect(upgradeEvents[0].data.newVersion).to.be.equals("1");
  };

  getUpgradedUser = () => {
    return new UpgradedUser(
      this.account,
      this.wallet,
      this.vault,
      locklift.factory.getDeployedContract("TestStEverAccount", this.withdrawUserData.address),
    );
  };
}

export class UpgradedUser extends User {
  constructor(
    public readonly account: Account,
    public readonly wallet: TokenWallet,
    protected readonly vault: Vault,
    public readonly withdrawUserData: Contract<TestStEverAccountAbi>,
  ) {
    super(account, wallet, vault, withdrawUserData);
  }
  checkIsUpdateApplied = async () => {
    return this.withdrawUserData.methods.checkIsUpdateApplied().call();
  };
}

export const createUserEntity = async (
  account: Account,
  tokenRoot: Contract<TokenRootUpgradeableAbi>,
  vault: Vault,
): Promise<User> => {
  const wallet = await TokenWallet.getWallet(locklift.provider, account.address, tokenRoot);
  const withdrawUserData = await vault.vaultContract.methods
    .getAccountAddress({
      _user: account.address,
      answerId: 0,
    })
    .call();
  return new User(
    account,
    wallet,
    vault,
    locklift.factory.getDeployedContract("StEverAccount", withdrawUserData.value0),
  );
};
