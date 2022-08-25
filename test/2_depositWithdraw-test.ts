import { makeWithdrawToUsers } from "../utils/highOrderUtils";
import { toNanoBn } from "../utils";
import { expect } from "chai";
import { preparation } from "./preparation";
import { Contract, Signer } from "locklift";
import { User } from "../utils/entities/user";
import { Governance } from "../utils/entities/governance";
import { TokenRootUpgradeableAbi } from "../build/factorySource";
import { Vault } from "../utils/entities/vault";
let signer: Signer;
let admin: User;
let governance: Governance;
let user1: User;
let user2: User;
let tokenRoot: Contract<TokenRootUpgradeableAbi>;
let vault: Vault;

describe.skip("Deposit withdraw test", function () {
  before(async () => {
    const {
      vault: v,
      tokenRoot: tr,
      signer: s,
      users: [adminUser, _, u1, u2],
      governance: g,
    } = await preparation({ deployUserValue: locklift.utils.toNano(30) });
    signer = s;
    vault = v;
    admin = adminUser;
    governance = g;
    user1 = u1;
    user2 = u2;
    tokenRoot = tr;
  });
  it("Vault should be initialized", async () => {
    await vault.initialize();
  });
  it("user should successfully deposited", async () => {
    const DEPOSIT_AMOUNT = toNanoBn(20);
    await user1.depositToVault(DEPOSIT_AMOUNT.toString());
    const balance = await user1.wallet.getBalance();
    const { availableAssets } = await vault.getDetails();
    expect(balance.toString()).to.be.equals(DEPOSIT_AMOUNT.toString(), "user should receive stEvers by rate 1:1");
    expect(availableAssets.toString()).to.be.equals(DEPOSIT_AMOUNT.toString(), "vault should have availableAssets");
  });
  it("user shouldn't withdraw with bad value", async () => {
    const WITHDRAW_AMOUNT = toNanoBn(20);
    const tokenBalanceBeforeWithdraw = await user1.wallet.getBalance();
    const nonce = locklift.utils.getRandomNonce();
    const withdrawPayload = await vault.vaultContract.methods
      .encodeDepositPayload({
        _nonce: nonce,
        _deposit_owner: user1.account.address,
      })
      .call();
    const { transaction } = await locklift.tracing.trace(
      user1.account.runTarget(
        {
          contract: user1.wallet.walletContract,
          value: locklift.utils.toNano(1),
        },
        walletContract =>
          walletContract.methods.transfer({
            remainingGasTo: user1.account.address,
            deployWalletValue: 0,
            amount: WITHDRAW_AMOUNT.toString(),
            notify: true,
            recipient: vault.vaultContract.address,
            payload: withdrawPayload.depositPayload,
          }),
      ),
      { allowedCodes: { compute: [null] } },
    );

    const events = await vault.getEventsAfterTransaction({
      eventName: "BadWithdrawRequest",
      parentTransaction: transaction,
    });
    expect(events[0].data.user.equals(user1.account.address)).to.be.true;
    expect(events[0].data.amount).to.be.equals(WITHDRAW_AMOUNT.toString());
    expect(tokenBalanceBeforeWithdraw.toString()).to.be.equals(
      await user1.wallet.getBalance().then(res => res.toString()),
      "user stEver balance shouldn't change",
    );
  });
  it("user should successfully withdraw", async () => {
    const WITHDRAW_AMOUNT = toNanoBn(20);
    const { availableAssets: availableAssetsBeforeWithdraw } = await vault.getDetails();
    const userStBalanceBeforeWithdraw = await user1.wallet.getBalance();
    const { successEvents } = await makeWithdrawToUsers({
      vault: vault,
      users: [user1],
      governance,
      amount: WITHDRAW_AMOUNT.toString(),
    });
    successEvents.forEach(event => {
      expect(event.data.user.equals(user1.account.address)).to.be.true;
      expect(event.data.amount).to.equal(WITHDRAW_AMOUNT.toString(), "user should receive evers by rate 1:1");
      expect(event.data.withdrawInfo[0][1].everAmount).to.be.equals(event.data.withdrawInfo[0][1].stEverAmount);
    });
    const { availableAssets: availableAssetsAfterWithdraw } = await vault.getDetails();

    const userStBalanceAfterWithdraw = await user1.wallet.getBalance();
    expect(userStBalanceAfterWithdraw.toString()).to.be.equals(
      userStBalanceBeforeWithdraw.minus(WITHDRAW_AMOUNT).toString(),
      "user balance should be reduced by withdraw amount",
    );
    expect(availableAssetsAfterWithdraw.toString()).to.be.equals(
      availableAssetsBeforeWithdraw.minus(WITHDRAW_AMOUNT).toString(),
    );
  });
  it("user should remove withdraw request", async () => {
    const DEPOSIT_AMOUNT = toNanoBn(20);

    await user1.depositToVault(DEPOSIT_AMOUNT.toString());
    const userBalanceBeforeWithdraw = await user1.wallet.getBalance();
    const { nonce } = await user1.makeWithdrawRequest(DEPOSIT_AMOUNT.toString());
    const withdrawRequestExisted = await user1
      .getWithdrawRequests()
      .then(res => res.find(withdrawReq => Number(withdrawReq.nonce) === nonce));
    expect(withdrawRequestExisted?.amount).to.be.equals(
      DEPOSIT_AMOUNT.toString(),
      "user should have withdraw request with amount equals to requested amount",
    );
    const { transaction } = await user1.removeWithdrawRequest(nonce);

    const withdrawRequestRemoverEvents = await vault.getEventsAfterTransaction({
      eventName: "WithdrawRequestRemoved",
      parentTransaction: transaction,
    });
    expect(withdrawRequestRemoverEvents.length).to.be.equals(1);
    const withdrawRequestNotExisted = await user1
      .getWithdrawRequests()
      .then(res => res.find(withdrawReq => Number(withdrawReq.nonce) === nonce));
    expect(withdrawRequestNotExisted).to.be.equals(undefined, "user should not have withdraw request");
    const userBalanceAfterWithdraw = await user1.wallet.getBalance();

    expect(userBalanceAfterWithdraw.toString()).to.be.equals(
      userBalanceBeforeWithdraw.toString(),
      "user balance should not change",
    );
  });
});
