import { Address, Contract, Signer } from "locklift";
import { TokenRootAbi, VaultAbi, WalletAbi } from "../build/factorySource";
import { Account, AccountFactory } from "locklift/build/factory";
import { expect } from "chai";
import { concatMap, map, range, tap, toArray } from "rxjs";
import { assertEvent } from "../utils";
import { TokenWallet } from "../utils/tokenWallet";
type UserContracts = {
  account: Account<WalletAbi>;
  wallet: TokenWallet;
};
const TOKEN_ROOT_NAME = "StEver";
const TOKEN_ROOT_SYMBOL = "STE";
const ZERO_ADDRESS = new Address("0:0000000000000000000000000000000000000000000000000000000000000000");
let signer: Signer;
const admin = {} as UserContracts;
const user1 = {} as UserContracts;
let user2 = {} as UserContracts;
let accountFactory: AccountFactory<WalletAbi>;
let tokenRoot: Contract<TokenRootAbi>;
let vaultContract: Contract<VaultAbi>;
let vaultTokenWallet: TokenWallet;

describe("Test Sample contract", async function () {
  before(async () => {
    signer = (await locklift.keystore.getSigner("0"))!;
    accountFactory = locklift.factory.getAccountsFactory("Wallet");
    const tokenWalletCode = locklift.factory.getContractArtifacts("TokenWallet");
    // @ts-ignore
    const [adminAccount, user1Account] = await range(0, 2)
      .pipe(
        concatMap(() =>
          accountFactory.deployNewAccount({
            initParams: { _randomNonce: locklift.utils.getRandomNonce() },
            publicKey: signer.publicKey,
            value: locklift.utils.toNano(200),
            constructorParams: {},
          }),
        ),
        map(({ account }) => account),
        toArray(),
      )
      .toPromise();
    admin.account = adminAccount;
    console.log("Admin account:", admin.account.address.toString());
    user1.account = user1Account;
    console.log("User1 account:", user1.account.address.toString());

    const { contract } = await locklift.factory.deployContract({
      contract: "TokenRoot",
      initParams: {
        name_: TOKEN_ROOT_NAME,
        symbol_: TOKEN_ROOT_SYMBOL,
        decimals_: 9,
        rootOwner_: adminAccount.address,
        walletCode_: tokenWalletCode.code,
        randomNonce_: locklift.utils.getRandomNonce(),
        deployer_: ZERO_ADDRESS,
      },
      publicKey: signer.publicKey,
      value: locklift.utils.toNano(2),
      constructorParams: {
        initialSupplyTo: ZERO_ADDRESS,
        initialSupply: 0,
        deployWalletValue: 0,
        mintDisabled: false,
        burnByRootDisabled: false,
        burnPaused: false,
        remainingGasTo: adminAccount.address,
      },
    });
    tokenRoot = contract;
  });
  it("should deploy Vault contract", async () => {
    const { contract, tx } = await locklift.tracing.trace(
      locklift.factory.deployContract({
        contract: "Vault",
        value: locklift.utils.toNano(50),
        constructorParams: {
          _withdrawUserDataCode: locklift.factory.getContractArtifacts("WithdrawUserData").code,
          _owner: admin.account.address,
        },
        publicKey: signer.publicKey,
        initParams: {
          nonce: locklift.utils.getRandomNonce(),
          governance: admin.account.address,
        },
      }),
    );
    vaultContract = contract;
    console.log(`Vault contract deployed: ${vaultContract.address.toString()}`);
    expect(await locklift.provider.getBalance(contract.address).then(Number)).to.be.above(0);
    await admin.account.runTarget(
      {
        contract: tokenRoot,
        value: locklift.utils.toNano(2),
        flags: 0,
      },
      contract =>
        contract.methods.transferOwnership({
          remainingGasTo: admin.account.address,
          newOwner: vaultContract.address,
          callbacks: [],
        }),
    );
    const newOwner = await tokenRoot.methods.rootOwner({ answerId: 0 }).call({});
    console.log(`New owner: ${newOwner.value0.toString()}`);
    expect(newOwner.value0.equals(vaultContract.address)).to.be.true;
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
    await locklift.tracing.trace(
      user1.account.runTarget(
        {
          contract: vaultContract,
          value: locklift.utils.toNano(DEPOSIT_AMOUNT + 1),
        },
        vaultContract =>
          vaultContract.methods.deposit({
            _amount: locklift.utils.toNano(DEPOSIT_AMOUNT),
            _nonce: locklift.utils.getRandomNonce(),
          }),
      ),
    );
    const depositEvent = await vaultContract.getPastEvents({ filter: event => event.event === "Deposit" });
    assertEvent(depositEvent.events, "Deposit");

    const {
      data: { user, depositAmount, receivedStEvers },
    } = depositEvent.events[0];
    expect(user.equals(user1.account.address)).to.be.true;
    expect(depositAmount).to.be.equals(locklift.utils.toNano(DEPOSIT_AMOUNT));
    expect(receivedStEvers).to.be.equals(locklift.utils.toNano(DEPOSIT_AMOUNT));

    user1.wallet = await TokenWallet.getWallet(locklift.provider, user1.account.address, tokenRoot);
    const balance = await user1.wallet.getBalance();
    expect(balance).to.be.equals(locklift.utils.toNano(DEPOSIT_AMOUNT));
  });
  it("user should successfully withdraw", async () => {
    const WITHDRAW_AMOUNT = 15;
    const nonceToPayload = locklift.utils.getRandomNonce();
    console.log(`nonceToPayload: ${nonceToPayload}`);
    const depositPayload = await vaultContract.methods
      .encodeDepositPayload({
        _nonce: nonceToPayload,
        deposit_owner: user1.account.address,
      })
      .call();
    await locklift.tracing.trace(
      user1.account.runTarget(
        {
          contract: user1.wallet.walletContract,
        },
        walletContract =>
          walletContract.methods.transfer({
            remainingGasTo: user1.account.address,
            deployWalletValue: 0,
            amount: locklift.utils.toNano(WITHDRAW_AMOUNT),
            notify: true,
            recipient: vaultContract.address,
            payload: depositPayload.deposit_payload,
          }),
      ),
      { allowedCodes: { compute: [null] } },
    );
    expect(await vaultTokenWallet.getBalance().then(res => res.toString())).to.be.equals(
      locklift.utils.toNano(WITHDRAW_AMOUNT),
    );
    const { events: withdrawRequestEvents } = await vaultContract.getPastEvents({
      filter: event => event.event === "WithdrawRequest",
    });
    assertEvent(withdrawRequestEvents, "WithdrawRequest");
    expect(withdrawRequestEvents[0].data.user.equals(user1.account.address)).to.be.true;
    expect(withdrawRequestEvents[0].data.amount).to.be.equals(locklift.utils.toNano(WITHDRAW_AMOUNT));
    expect(withdrawRequestEvents[0].data.nonce).to.be.equals(nonceToPayload.toString());

    await locklift.tracing.trace(
      admin.account.runTarget(
        {
          contract: vaultContract,
          value: locklift.utils.toNano(2),
        },
        vault =>
          vault.methods.processSendToUser({ sendConfig: [{ user: user1.account.address, nonces: [nonceToPayload] }] }),
      ),
    );

    const { events: withdrawSuccessEvents } = await vaultContract.getPastEvents({
      filter: event => event.event === "WithdrawSuccess",
    });
    assertEvent(withdrawSuccessEvents, "WithdrawSuccess");
    expect(withdrawSuccessEvents[0].data.user.equals(user1.account.address)).to.be.true;
    expect(withdrawSuccessEvents[0].data.amount).to.be.equals(locklift.utils.toNano(WITHDRAW_AMOUNT));
    expect(await vaultTokenWallet.getBalance().then(res => res.toString())).to.be.equals("0");
  });
});
