import { TokenRootUpgradeableAbi, WalletAbi } from "../build/factorySource";
import { concatMap, filter, from, lastValueFrom, map, mergeMap, range, toArray } from "rxjs";
import { Address, Contract, getRandomNonce, Signer, toNano, WalletTypes } from "locklift";
import { expect } from "chai";
import { createUserEntity, User } from "../utils/entities/user";
import { Governance } from "../utils/entities/governance";
import { creteVault, Vault } from "../utils/entities/vault";
import { GAIN_FEE } from "../utils/constants";
import { StrategyFactory } from "../utils/entities/strategyFactory";
import { Account } from "everscale-standalone-client/nodejs";

export const preparation = async ({
  deployUserValue,
  countOfUsers = 6,
}: {
  deployUserValue: string;
  countOfUsers?: number;
}): Promise<{
  signer: Signer;
  vault: Vault;
  tokenRoot: Contract<TokenRootUpgradeableAbi>;
  users: Array<User>;
  governance: Governance;
  strategyFactory: StrategyFactory;
}> => {
  const [adminSigner, governanceSigner, ...signers] = await lastValueFrom(
    range(countOfUsers).pipe(
      mergeMap(idx => locklift.keystore.getSigner(idx.toString())),
      filter(<T>(signer: T): signer is T & {} => !!signer),
      toArray(),
    ),
  );
  const accounts = await deployAccounts([adminSigner, ...signers], deployUserValue);
  const [adminUser] = accounts;
  const tokenRoot = await deployTokenRoot({ signer: adminSigner, owner: adminUser.address });
  const vault = await deployVault({ owner: adminUser, signer: adminSigner, governance: governanceSigner, tokenRoot });

  const vaultInstance = await creteVault({
    adminAccount: accounts[0],
    vaultContract: vault,
    tokenRootContract: tokenRoot,
  });
  const users = (await from(accounts)
    .pipe(
      concatMap(account => createUserEntity(account, tokenRoot, vaultInstance)),
      toArray(),
    )
    .toPromise())!;
  const dePoolStrategyCode = locklift.factory.getContractArtifacts("StrategyDePool");
  const factoryContact = await locklift.factory.deployContract({
    contract: "DepoolStrategyFactory",
    value: locklift.utils.toNano(2),
    publicKey: adminSigner.publicKey,
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
    signer: adminSigner,
    users,
    tokenRoot,
    vault: vaultInstance,
    governance: new Governance(governanceSigner, vaultInstance),
    strategyFactory,
  };
};

const deployAccounts = async (signers: Array<Signer>, deployAccountValue: string): Promise<Array<Account>> => {
  return lastValueFrom(
    from(signers).pipe(
      concatMap(signer =>
        locklift.factory.accounts.addNewAccount({
          type: WalletTypes.Custom,
          contract: "Wallet",
          initParams: { _randomNonce: getRandomNonce() },
          publicKey: signer.publicKey,
          value: deployAccountValue,
          constructorParams: {},
        }),
      ),
      map(({ account }) => account),
      toArray(),
    ),
  );
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
  owner: Account;
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

  await tokenRoot.methods
    .transferOwnership({
      remainingGasTo: owner.address,
      newOwner: vaultContract.address,
      callbacks: [],
    })
    .send({
      from: owner.address,
      amount: toNano(2),
    });
  const newOwner = await tokenRoot.methods.rootOwner({ answerId: 0 }).call({});
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
