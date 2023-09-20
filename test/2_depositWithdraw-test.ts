import { isT, toNanoBn } from "../utils";
import { expect } from "chai";
import { preparation } from "./preparation";
import { Contract, fromNano, Signer, toNano, TraceType } from "locklift";
import { User } from "../utils/entities/user";
import { Governance } from "../utils/entities/governance";
import { TokenRootUpgradeableAbi } from "../build/factorySource";
import { Vault } from "../utils/entities/vault";
import { concatMap, lastValueFrom, map, range, timer, toArray } from "rxjs";
import { ITERATION_FEE } from "../utils/constants";

describe("Deposit withdraw test without lock time", function () {
  let signer: Signer;
  let admin: User;
  let governance: Governance;
  let user1: User;
  let user2: User;
  let tokenRoot: Contract<TokenRootUpgradeableAbi>;
  let vault: Vault;
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

  it("user should successfully deposited", async () => {
    const valurBalanceBefore = await vault.getDetails();
    const DEPOSIT_AMOUNT = toNanoBn(20);
    const { traceTree } = await user1.depositToVault(DEPOSIT_AMOUNT.toString());
    const balance = await user1.wallet.getBalance();
    const { availableAssets } = await vault.getDetails();
    expect(balance.toString()).to.be.equals(DEPOSIT_AMOUNT.toString(), "user should receive stEvers by rate 1:1");
    expect(availableAssets.toString()).to.be.equals(DEPOSIT_AMOUNT.toString(), "vault should have availableAssets");
    console.log(`Token Balance change ${traceTree?.tokens.getTokenBalanceChange(user1.wallet.walletContract.address)}`);
  });

  it("user shouldn't withdraw with bad value", async () => {
    const WITHDRAW_AMOUNT = toNanoBn(20);
    const nonce = locklift.utils.getRandomNonce();

    const { state } = await vault.vaultContract.getFullState();
    const withdrawPayload = await vault.vaultContract.methods
      .encodeDepositPayload({
        _nonce: nonce,
      })
      .call({
        cachedState: state,
      });

    const transaction = await locklift.tracing.trace(
      user1.wallet.walletContract.methods
        .transfer({
          remainingGasTo: user1.account.address,
          deployWalletValue: 0,
          amount: WITHDRAW_AMOUNT.toString(),
          notify: true,
          recipient: vault.vaultContract.address,
          payload: withdrawPayload.depositPayload,
        })
        .send({
          from: user1.account.address,
          amount: toNano(1.1),
        }),
      { allowedCodes: { compute: [null] } },
    );
    expect(transaction.traceTree)
      .to.emit("BadWithdrawRequest")
      .and.to.call("acceptTransfer")
      .count(2)
      .withNamedArgs({})
      .and.to.call("onAcceptTokensTransfer")
      .and.to.call("transfer");
    debugger;
    transaction.traceTree?.findEventsForContract({
      contract: vault.vaultContract,
      name: "StrategiesAdded",
    });
    transaction.traceTree?.findCallsForContract({
      contract: vault.vaultContract,
      name: "deposit",
    });
    expect(transaction.traceTree).to.emit("BadWithdrawRequest").withNamedArgs({
      user: user1.account.address,
      amount: WITHDRAW_AMOUNT.toString(),
    });
    expect(transaction.traceTree?.tokens.getTokenBalanceChange(user1.wallet.walletContract)).to.be.equals("0");
  });
  it("user shouldn't withdraw with bad payload", async () => {
    const WITHDRAW_AMOUNT = toNanoBn(20);

    const transaction = await locklift.tracing.trace(
      user1.wallet.walletContract.methods
        .transfer({
          remainingGasTo: user1.account.address,
          deployWalletValue: 0,
          amount: WITHDRAW_AMOUNT.toString(),
          notify: true,
          recipient: vault.vaultContract.address,
          payload: "",
        })
        .send({
          from: user1.account.address,
          amount: toNano(1.1),
        }),
      { allowedCodes: { compute: [null] } },
    );

    console.log(transaction.traceTree?.tokens.getTokenBalanceChange(user1.wallet.walletContract));

    expect(transaction.traceTree?.tokens.getTokenBalanceChange(user1.wallet.walletContract)).to.be.equals("0");
  });
  it("user shouldn't withdraw when vault is paused", async () => {
    await lastValueFrom(timer(1000));
    await vault.setPaused(true);
    const WITHDRAW_AMOUNT = toNanoBn(20);
    const nonce = locklift.utils.getRandomNonce();
    const withdrawPayload = await vault.vaultContract.methods
      .encodeDepositPayload({
        _nonce: nonce,
      })
      .call();

    const transaction = await locklift.tracing.trace(
      user1.wallet.walletContract.methods
        .transfer({
          remainingGasTo: user1.account.address,
          deployWalletValue: 0,
          amount: WITHDRAW_AMOUNT.toString(),
          notify: true,
          recipient: vault.vaultContract.address,
          payload: withdrawPayload.depositPayload,
        })
        .send({
          from: user1.account.address,
          amount: toNano(1.1),
          bounce: true,
        }),
      { allowedCodes: { compute: [null] } },
    );

    expect(transaction.traceTree).to.emit("BadWithdrawRequest").withNamedArgs({
      user: user1.account.address,
      amount: WITHDRAW_AMOUNT.toString(),
    });
    expect(transaction.traceTree?.tokens.getTokenBalanceChange(user1.wallet.walletContract)).to.be.equals("0");
    debugger;
    await vault.setPaused(false);
  });
  it("user should successfully withdraw", async () => {
    const WITHDRAW_AMOUNT = toNanoBn(20);
    const vaultBalanceBefore = await vault.getDetails();

    const { availableAssets: availableAssetsBeforeWithdraw } = await vault.getDetails();
    const userStBalanceBeforeWithdraw = await user1.wallet.getBalance();
    const { withdrawToUserConfig, traceTree: withdrawTraceTree } = await lastValueFrom(
      range(2).pipe(
        concatMap(() => user1.makeWithdrawRequest(WITHDRAW_AMOUNT.dividedBy(2).toString())),
        toArray(),
        map(requests => ({
          withdrawToUserConfig: [user1.account.address, { nonces: requests.map(({ nonce }) => nonce) }] as const,
          traceTree: requests.map(el => el.traceTree),
        })),
      ),
    );

    const { traceTree } = await governance.emitWithdraw({
      sendConfig: [withdrawToUserConfig],
    });
    traceTree?.totalGasUsed();
    expect(traceTree).to.emit("WithdrawSuccess");
    const vaultBalanceAfter = await vault.getDetails();
    const additionalBalanceAfterWithdraw = vaultBalanceAfter.contractBalance.minus(
      vaultBalanceBefore.contractBalance.minus(WITHDRAW_AMOUNT),
    );
    expect(Number(additionalBalanceAfterWithdraw))
      .to.be.gt(0, "vault balance should raise")
      .and.lt(Number(ITERATION_FEE), "raise should be lt iteration FEE");

    console.log(
      `${fromNano(vaultBalanceBefore.contractBalance.toNumber())} -> ${fromNano(
        vaultBalanceAfter.contractBalance.toNumber(),
      )}`,
    );
    const successEvents = traceTree!.findEventsForContract({
      contract: vault.vaultContract,
      name: "WithdrawSuccess" as const,
    });

    successEvents.filter(isT).forEach(event => {
      expect(event.user.equals(user1.account.address)).to.be.true;
      expect(event.amount).to.equal(WITHDRAW_AMOUNT.toString(), "user should receive evers by rate 1:1");
      expect(event.withdrawInfo[0][1].everAmount).to.be.equals(event.withdrawInfo[0][1].stEverAmount);
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

    const { traceTree: depositTraceTree } = await user1.depositToVault(DEPOSIT_AMOUNT.toString());
    expect(depositTraceTree?.tokens.getTokenBalanceChange(user1.wallet.walletContract)).to.be.equals(
      DEPOSIT_AMOUNT.toString(),
    );
    const { nonce, traceTree: withdrawRequestTraceTree } = await user1.makeWithdrawRequest(DEPOSIT_AMOUNT.toString());
    expect(withdrawRequestTraceTree?.tokens.getTokenBalanceChange(user1.wallet.walletContract)).to.be.equals(
      DEPOSIT_AMOUNT.negated().toString(),
    );
    const withdrawRequestExisted = await user1
      .getWithdrawRequests()
      .then(res => res.find(withdrawReq => Number(withdrawReq.nonce) === nonce));
    expect(withdrawRequestExisted?.amount).to.be.equals(
      DEPOSIT_AMOUNT.toString(),
      "user should have withdraw request with amount equals to requested amount",
    );
    const transaction = await user1.removeWithdrawRequest(nonce);
    expect(transaction.traceTree).to.emit("WithdrawRequestRemoved");
    expect(transaction.traceTree?.tokens.getTokenBalanceChange(user1.wallet.walletContract)).to.be.equals(
      DEPOSIT_AMOUNT.toString(),
    );

    const withdrawRequestNotExisted = await user1
      .getWithdrawRequests()
      .then(res => res.find(withdrawReq => Number(withdrawReq.nonce) === nonce));
    expect(withdrawRequestNotExisted).to.be.equals(undefined, "user should not have withdraw request");
  });
});
describe("Deposit withdraw test with lock time", function () {
  let signer: Signer;
  let admin: User;
  let governance: Governance;
  let user1: User;
  let user2: User;
  let tokenRoot: Contract<TokenRootUpgradeableAbi>;
  let vault: Vault;
  const HOLD_TIME = (60).toString();
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
    const { traceTree } = await vault.setHoldTime({ holdTime: HOLD_TIME });
    expect(traceTree).to.emit("WithdrawHoldTimeUpdated").withNamedArgs({
      withdrawHoldTimeSeconds: HOLD_TIME,
    });
  });

  it("user should successfully deposited", async () => {
    const DEPOSIT_AMOUNT = toNanoBn(20);
    const { traceTree } = await user1.depositToVault(DEPOSIT_AMOUNT.toString());
    const balance = await user1.wallet.getBalance();
    const { availableAssets } = await vault.getDetails();
    expect(balance.toString()).to.be.equals(DEPOSIT_AMOUNT.toString(), "user should receive stEvers by rate 1:1");
    expect(availableAssets.toString()).to.be.equals(DEPOSIT_AMOUNT.toString(), "vault should have availableAssets");
    console.log(`Token Balance change ${traceTree?.tokens.getTokenBalanceChange(user1.wallet.walletContract.address)}`);
  });

  it("user should create withdraw request", async () => {
    const WITHDRAW_AMOUNT = toNanoBn(20);

    const { withdrawToUserConfig } = await lastValueFrom(
      range(1).pipe(
        concatMap(() => user1.makeWithdrawRequest(WITHDRAW_AMOUNT.dividedBy(2).toString())),
        toArray(),
        map(requests => ({
          withdrawToUserConfig: [user1.account.address, { nonces: requests.map(({ nonce }) => nonce) }] as const,
          traceTree: requests.map(el => el.traceTree),
        })),
      ),
    );

    {
      const { traceTree } = await governance.emitWithdraw({
        sendConfig: [withdrawToUserConfig],
      });
      expect(traceTree).to.emit("WithdrawError").withNamedArgs({
        user: user1.account.address,
      });
    }

    await locklift.testing.increaseTime(Number(HOLD_TIME)); // shift time to make withdraw available
    const { traceTree } = await governance.emitWithdraw({
      sendConfig: [withdrawToUserConfig],
    });

    console.log(locklift.testing.getCurrentTime());
    expect(traceTree).to.emit("WithdrawSuccess").withNamedArgs({
      user: user1.account.address,
    });
  });
});
