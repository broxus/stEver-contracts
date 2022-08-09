import { Account, AccountFactory } from "locklift/build/factory";
import { TokenRootUpgradeableAbi, WalletAbi } from "../build/factorySource";
import { concatMap, from, map, range, toArray } from "rxjs";
import { Address, Contract, Signer } from "locklift";
import { expect } from "chai";
import { createUserEntity, User } from "../utils/entities/user";
import { Governance } from "../utils/entities/governance";
import { creteVault, Vault } from "../utils/entities/vault";
import { GAIN_FEE } from "../utils/constants";
import { StrategyFactory } from "../utils/entities/strategyFactory";

export const preparation = async (): Promise<{
  signer: Signer;
  vault: Vault;
  tokenRoot: Contract<TokenRootUpgradeableAbi>;
  users: Array<User>;
  governance: Governance;
  strategyFactory: StrategyFactory;
}> => {
  const signer = (await locklift.keystore.getSigner("0"))!;
  const governanceKeyPair = (await locklift.keystore.getSigner("1"))!;
  const accountFactory = locklift.factory.getAccountsFactory("Wallet");
  const accounts = await deployUsers(6, accountFactory, signer);
  const [adminUser] = accounts;
  const tokenRoot = await deployTokenRoot({ signer, owner: adminUser.address });
  const vault = await deployVault({ owner: adminUser, signer, governance: governanceKeyPair, tokenRoot });
  const users = (await from(accounts)
    .pipe(
      concatMap(account => createUserEntity(account, tokenRoot, vault)),
      toArray(),
    )
    .toPromise())!;
  const vaultInstance = await creteVault({
    adminAccount: users[0],
    vaultContract: vault,
    tokenRootContract: tokenRoot,
  });
  const dePoolStrategyCode = locklift.factory.getContractArtifacts("StrategyBase");
  const factoryContact = await locklift.factory.deployContract({
    contract: "DepoolStrategyFactory",
    value: locklift.utils.toNano(2),
    publicKey: signer.publicKey,
    initParams: {
      nonce: locklift.utils.getRandomNonce(),
      dePoolStrategyCode: dePoolStrategyCode.code,
    },
    constructorParams: {
      _owner: adminUser.address,
    },
  });

  const strategyFactory = new StrategyFactory(adminUser, factoryContact.contract, vaultInstance);

  return {
    signer,
    users,
    tokenRoot,
    vault: vaultInstance,
    governance: new Governance(governanceKeyPair, vault),
    strategyFactory,
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
          value: locklift.utils.toNano(4000),
          constructorParams: {},
        }),
      ),
      map(({ account }) => account),
      toArray(),
    )
    .toPromise()) as Array<Account<WalletAbi>>;
};
type DeployRootParams = { signer: Signer; owner: Address };
const deployTokenRoot = async ({ signer, owner }: DeployRootParams): Promise<Contract<TokenRootUpgradeableAbi>> => {
  const TOKEN_ROOT_NAME = "StEver";
  const TOKEN_ROOT_SYMBOL = "STE";
  const ZERO_ADDRESS = new Address("0:0000000000000000000000000000000000000000000000000000000000000000");
  const tokenWalletCode = locklift.factory.getContractArtifacts("TokenWalletUpgradeable");
  const platformCode = locklift.factory.getContractArtifacts("TokenWalletPlatform");

  const { contract } = await locklift.factory.deployContract({
    contract: "TokenRootUpgradeable",
    initParams: {
      name_: TOKEN_ROOT_NAME,
      symbol_: TOKEN_ROOT_SYMBOL,
      decimals_: 9,
      rootOwner_: owner,
      walletCode_: tokenWalletCode.code,
      randomNonce_: locklift.utils.getRandomNonce(),
      deployer_: ZERO_ADDRESS,
      platformCode_: platformCode.code,
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
  governance: Signer;
  tokenRoot: Contract<TokenRootUpgradeableAbi>;
}) => {
  const { code: platformCode } = locklift.factory.getContractArtifacts("Platform");
  const { code: accountCode } = locklift.factory.getContractArtifacts("StEverAccount");

  const { contract: vaultContract, tx } = await locklift.tracing.trace(
    locklift.factory.deployContract({
      contract: "StEverVault",
      value: locklift.utils.toNano(2),
      constructorParams: {
        _owner: owner.address,
        _gainFee: GAIN_FEE,
      },
      publicKey: signer.publicKey,
      initParams: {
        nonce: locklift.utils.getRandomNonce(),
        governance: `0x${governance.publicKey}`,
        platformCode,
        accountCode,
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
  const vaultSubscriber = new locklift.provider.Subscriber();
  vaultSubscriber.transactions(vaultContract.address).on(transaction => {
    transaction.transactions.forEach(async tx => {
      const parsedEvent = await vaultContract.decodeTransactionEvents({ transaction: tx });
      parsedEvent.forEach(event => {
        console.log(`Event received: ${JSON.stringify(event)}`);
      });
    });
  });
  return vaultContract;
};
