import { Address, Contract, Signer } from "locklift";
import { TokenRootAbi, VaultAbi, WalletAbi } from "../build/factorySource";
import { expect } from "chai";
import { assertEvent, getAddressBalance } from "../utils";
import { TokenWallet } from "../utils/tokenWallet";
import { User } from "../utils/user";
import { preparation } from "./preparation";
import { Governance } from "../utils/governance";

const TOKEN_ROOT_NAME = "StEver";
const TOKEN_ROOT_SYMBOL = "STE";
const ZERO_ADDRESS = new Address("0:0000000000000000000000000000000000000000000000000000000000000000");
let signer: Signer;
let admin: User;
let governance: Governance;
let user1: User;
let user2: User;
let tokenRoot: Contract<TokenRootAbi>;
let vaultContract: Contract<VaultAbi>;
let vaultTokenWallet: TokenWallet;

describe("Test Sample contract", async function () {
  before(async () => {
    const {
      vault,
      tokenRoot: tr,
      signer: s,
      users: [adminUser, _, u1, u2],
      governance: g,
    } = await preparation();
    signer = s;
    vaultContract = vault;
    admin = adminUser;
    governance = g;
    user1 = u1;
    user2 = u2;
    tokenRoot = tr;
  });

  it("Vault should be initialized", async () => {
    await locklift.tracing.trace(
      admin.account.runTarget(
        {
          contract: vaultContract,
        },
        vault =>
          vault.methods.initVault({
            _stTokenRoot: tokenRoot.address,
          }),
      ),
    );
    const details = await vaultContract.methods.getDetails({ answerId: 0 }).call({});
    vaultTokenWallet = await TokenWallet.getWallet(locklift.provider, vaultContract.address, tokenRoot);
    expect(details.value0.stEverRoot.equals(tokenRoot.address)).to.be.true;
  });
  it("user should successfully deposited", async () => {
    const DEPOSIT_AMOUNT = 20;
    await user1.depositToVault(DEPOSIT_AMOUNT);
  });
  it("user should successfully withdraw", async () => {
    const WITHDRAW_AMOUNT = 15;
    const { nonce } = await user1.makeWithdrawRequest(WITHDRAW_AMOUNT);
    console.log(`governance balance before ${await getAddressBalance(governance.account.address)}`);
    console.log(`vault balance before ${await getAddressBalance(vaultContract.address)}`);

    await governance.emitWithdraw({ sendConfig: [{ user: user1.account.address, nonces: [nonce] }] });
    console.log(`governance balance after ${await getAddressBalance(governance.account.address)}`);
    console.log(`vault balance after ${await getAddressBalance(vaultContract.address)}`);

    const { events: withdrawSuccessEvents } = await vaultContract.getPastEvents({
      filter: event => event.event === "WithdrawSuccess",
    });
    assertEvent(withdrawSuccessEvents, "WithdrawSuccess");
    expect(withdrawSuccessEvents[0].data.user.equals(user1.account.address)).to.be.true;
    expect(withdrawSuccessEvents[0].data.amount).to.be.equals(locklift.utils.toNano(WITHDRAW_AMOUNT));
    expect(await vaultTokenWallet.getBalance().then(res => res.toString())).to.be.equals("0");
  });
});
