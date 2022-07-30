import { Account, AccountFactory } from "locklift/build/factory";
import { TokenRootAbi, VaultAbi, WalletAbi } from "../build/factorySource";
import { concatMap, from, map, mergeMap, range, toArray } from "rxjs";
import { Address, Contract, Signer } from "locklift";
import { expect } from "chai";
import { createUserEntity, User } from "../utils/user";
import { TokenWallet } from "../utils/tokenWallet";
import { Governance } from "../utils/governance";

export const preparation = async (): Promise<{
  signer: Signer;
  vault: Contract<VaultAbi>;
  tokenRoot: Contract<TokenRootAbi>;
  users: Array<User>;
  governance: Governance;
}> => {
  const signer = (await locklift.keystore.getSigner("0"))!;
  const accountFactory = locklift.factory.getAccountsFactory("Wallet");
  const accounts = await deployUsers(4, accountFactory, signer);
  const [adminUser, governanceUser] = accounts;
  const tokenRoot = await deployTokenRoot({ signer, owner: adminUser.address });
  const vault = await deployVault({ owner: adminUser, signer, governance: governanceUser.address, tokenRoot });
  const users = (await from(accounts)
    .pipe(
      concatMap(account => createUserEntity(account, tokenRoot, vault)),
      toArray(),
    )
    .toPromise())!;
  return {
    signer,
    users,
    tokenRoot,
    vault,
    governance: new Governance(governanceUser, vault),
  };
};

const deployUsers = async (
  countOfUsers: number,
  accountFactory: AccountFactory<WalletAbi>,
  signer: Signer,
): Promise<Array<Account<WalletAbi>>> => {
  return (await range(0, countOfUsers)
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
    .toPromise()) as Array<Account<WalletAbi>>;
};
type DeployRootParams = { signer: Signer; owner: Address };
const deployTokenRoot = async ({ signer, owner }: DeployRootParams) => {
  const TOKEN_ROOT_NAME = "StEver";
  const TOKEN_ROOT_SYMBOL = "STE";
  const ZERO_ADDRESS = new Address("0:0000000000000000000000000000000000000000000000000000000000000000");
  const tokenWalletCode = locklift.factory.getContractArtifacts("TokenWallet");

  const { contract } = await locklift.factory.deployContract({
    contract: "TokenRoot",
    initParams: {
      name_: TOKEN_ROOT_NAME,
      symbol_: TOKEN_ROOT_SYMBOL,
      decimals_: 9,
      rootOwner_: owner,
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
      remainingGasTo: owner,
    },
  });
  return contract;
};
const deployVault = async ({
  owner,
  signer,
  governance,
  tokenRoot,
}: {
  owner: Account<WalletAbi>;
  signer: Signer;
  governance: Address;
  tokenRoot: Contract<TokenRootAbi>;
}) => {
  const { contract: vaultContract, tx } = await locklift.tracing.trace(
    locklift.factory.deployContract({
      contract: "Vault",
      value: locklift.utils.toNano(2),
      constructorParams: {
        _withdrawUserDataCode: locklift.factory.getContractArtifacts("WithdrawUserData").code,
        _owner: owner.address,
      },
      publicKey: signer.publicKey,
      initParams: {
        nonce: locklift.utils.getRandomNonce(),
        governance,
      },
    }),
  );
  console.log(`Vault contract deployed: ${vaultContract.address.toString()}`);
  expect(await locklift.provider.getBalance(vaultContract.address).then(Number)).to.be.above(0);
  await owner.runTarget(
    {
      contract: tokenRoot,
      value: locklift.utils.toNano(2),
      flags: 0,
    },
    contract =>
      contract.methods.transferOwnership({
        remainingGasTo: owner.address,
        newOwner: vaultContract.address,
        callbacks: [],
      }),
  );
  const newOwner = await tokenRoot.methods.rootOwner({ answerId: 0 }).call({});
  console.log(`New owner: ${newOwner.value0.toString()}`);
  expect(newOwner.value0.equals(vaultContract.address)).to.be.true;
  return vaultContract;
};
