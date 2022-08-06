import { makeWithdrawToUsers } from "../utils/highOrderUtils";
import { assertEvent } from "../utils";
import { expect } from "chai";
import { preparation } from "./preparation";
import { Contract, Signer } from "locklift";
import { User } from "../utils/entities/user";
import { Governance } from "../utils/entities/governance";
import { TokenRootUpgradeableAbi } from "../build/factorySource";
import { Vault } from "../utils/entities/vault";
import { TokenWallet } from "../utils/entities/tokenWallet";
let signer: Signer;
let admin: User;
let governance: Governance;
let user1: User;
let user2: User;
let tokenRoot: Contract<TokenRootUpgradeableAbi>;
let vault: Vault;
let vaultTokenWallet: TokenWallet;

describe.skip("Deposit withdraw test", function () {
  before(async () => {
    const {
      vault: v,
      tokenRoot: tr,
      signer: s,
      users: [adminUser, _, u1, u2],
      governance: g,
    } = await preparation();
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
    const DEPOSIT_AMOUNT = 20;
    await user1.depositToVault(DEPOSIT_AMOUNT);
    const balance = await user1.wallet.getBalance();
    expect(balance).to.be.equals(locklift.utils.toNano(DEPOSIT_AMOUNT));
  });
  it("user shouldn't withdraw with bad value", async () => {
    const WITHDRAW_AMOUNT = 20;
    const tokenBalanceBeforeWithdraw = await user1.wallet.getBalance();
    const nonce = locklift.utils.getRandomNonce();
    const withdrawPayload = await vault.vaultContract.methods
      .encodeDepositPayload({
        _nonce: nonce,
        deposit_owner: user1.account.address,
      })
      .call();
    await locklift.tracing.trace(
      user1.account.runTarget(
        {
          contract: user1.wallet.walletContract,
          value: locklift.utils.toNano(1),
        },
        walletContract =>
          walletContract.methods.transfer({
            remainingGasTo: user1.account.address,
            deployWalletValue: 0,
            amount: locklift.utils.toNano(WITHDRAW_AMOUNT),
            notify: true,
            recipient: vault.vaultContract.address,
            payload: withdrawPayload.deposit_payload,
          }),
      ),
      { allowedCodes: { compute: [null] } },
    );
    const { events } = await vault.vaultContract.getPastEvents({
      filter: ({ event }) => event === "BadWithdrawRequest",
    });
    assertEvent(events, "BadWithdrawRequest");
    expect(events[0].data.user.equals(user1.account.address)).to.be.true;
    expect(events[0].data.amount).to.be.equals(locklift.utils.toNano(WITHDRAW_AMOUNT));
    expect(tokenBalanceBeforeWithdraw).to.be.equals(await user1.wallet.getBalance());
  });
  it("user should successfully withdraw", async () => {
    const WITHDRAW_AMOUNT = 20;
    const { successEvents } = await makeWithdrawToUsers({
      vaultContract: vault.vaultContract,
      users: [user1],
      governance,
      amount: locklift.utils.toNano(WITHDRAW_AMOUNT),
    });
    assertEvent(successEvents, "WithdrawSuccess");
    successEvents.forEach(event => {
      expect(event.data.user.equals(user1.account.address)).to.be.true;
      expect(event.data.amount).to.equal(locklift.utils.toNano(WITHDRAW_AMOUNT));
    });
  });
});
