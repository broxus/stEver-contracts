import { Address, toNano, WalletTypes, zeroAddress } from "locklift";
import { getVaultInfo, logger } from "./utils";
const governanceKeys = {
  publicKey: "2ada2e65ab8eeab09490e3521415f45b6e42df9c760a639bcf53957550b25a16",
  secretKey: "172af540e43a524763dd53b26a066d472a97c4de37d5498170564510608250c3",
};
const deployAndSetupStEverVault = async ({
  adminAddress,
  deployVaultValue = locklift.utils.toNano(100),
  minStrategyWithdrawValue = locklift.utils.toNano(100),
  minStrategyDepositValue = locklift.utils.toNano(100),
}: {
  adminAddress: string;
  deployVaultValue?: string;
  minStrategyDepositValue?: string;
  minStrategyWithdrawValue?: string;
}) => {
  const signer = await locklift.keystore.getSigner("0");

  if (!signer) {
    throw new Error("Admin signer not found");
  }

  const adminAccountAddress = new Address(adminAddress);
  const adminAccount = await locklift.factory.accounts.addExistingAccount({
    publicKey: signer.publicKey,
    address: adminAccountAddress,
    type: WalletTypes.MsigAccount,
  });
  const { code: platformCode } = locklift.factory.getContractArtifacts("Platform");
  const { code: accountCode } = locklift.factory.getContractArtifacts("StEverAccount");
  const { code: strategyDePoolCode } = locklift.factory.getContractArtifacts("StrategyDePool");
  const { tvc: stEverTvc, abi: stEverAbi } = locklift.factory.getContractArtifacts("StEverVault");
  logger.startStep("Obtaining StEverVault Address");
  const deployVaultParams = {
    publicKey: signer.publicKey,
    initParams: {
      nonce: locklift.utils.getRandomNonce(),
      governance: `0x${governanceKeys.publicKey}`,
      platformCode: platformCode,
      accountCode: accountCode,
    },
    tvc: stEverTvc,
  };
  const stEverVaultAddress = await locklift.provider.getExpectedAddress(
    locklift.factory.getContractArtifacts("StEverVault").abi,
    deployVaultParams,
  );
  logger.successStep(`Expected stEver address is ${stEverVaultAddress.toString()}`);
  logger.startStep("SteEverRoot is deploying...");
  const TOKEN_ROOT_NAME = "StEver";
  const TOKEN_ROOT_SYMBOL = "StEver";
  const { code: tokenWalletCode } = locklift.factory.getContractArtifacts("TokenWalletUpgradeable");
  const { code: tokenWalletPlatformCode } = locklift.factory.getContractArtifacts("TokenWalletPlatform");
  const { contract: stEverTokenRootContract } = await locklift.tracing.trace(
    locklift.factory.deployContract({
      contract: "TokenRootUpgradeable",
      value: locklift.utils.toNano(2),
      initParams: {
        name_: TOKEN_ROOT_NAME,
        symbol_: TOKEN_ROOT_SYMBOL,
        decimals_: 9,
        rootOwner_: stEverVaultAddress,
        walletCode_: tokenWalletCode,
        randomNonce_: locklift.utils.getRandomNonce(),
        deployer_: zeroAddress,
        platformCode_: tokenWalletPlatformCode,
      },
      publicKey: signer.publicKey,
      constructorParams: {
        initialSupplyTo: zeroAddress,
        initialSupply: 0,
        deployWalletValue: 0,
        mintDisabled: false,
        burnByRootDisabled: false,
        burnPaused: false,
        remainingGasTo: adminAccount.address,
      },
    }),
  );

  logger.startStep("SteEver is deploying...");
  const { contract: vaultContract } = await locklift.tracing.trace(
    locklift.factory.deployContract({
      contract: "StEverVault",
      value: deployVaultValue,
      initParams: deployVaultParams.initParams,
      publicKey: deployVaultParams.publicKey,
      constructorParams: {
        _owner: new Address(adminAddress),
        _gainFee: locklift.utils.toNano(1),
        _stTokenRoot: stEverTokenRootContract.address,
      },
    }),
  );

  await locklift.transactions.waitFinalized(
    vaultContract.methods.setMinStrategyWithdrawValue({ _minStrategyWithdrawValue: minStrategyWithdrawValue }).send({
      from: adminAccount.address,
      amount: toNano(2),
    }),
  );

  logger.info(`Vault details ${JSON.stringify(await getVaultInfo(vaultContract), null, 4)}`);
  logger.successStep(`Vault deployed: ${vaultContract.address.toString()}`);

  logger.successStep(`StEverTokenRoot deployed: ${stEverTokenRootContract.address.toString()}`);

  logger.info(`Vault details ${JSON.stringify(await getVaultInfo(vaultContract), null, 4)}`);
  logger.successStep(`Vault initialized`);

  logger.startStep("Deploying DePoolStrategyFactory");
  const { contract: dePoolStrategyFactoryContract } = await locklift.tracing.trace(
    locklift.factory.deployContract({
      contract: "DepoolStrategyFactory",
      value: locklift.utils.toNano(2),
      publicKey: signer.publicKey,
      initParams: {
        stEverVault: vaultContract.address,
        nonce: locklift.utils.getRandomNonce(),
        dePoolStrategyCode: strategyDePoolCode,
      },
      constructorParams: {
        _owner: adminAccount.address,
      },
    }),
  );
  logger.successStep(`DePoolStrategyFactory deployed ${dePoolStrategyFactoryContract.address.toString()}`);
};

deployAndSetupStEverVault({
  // adminPubKey: "",
  // governancePubKey: "",
  adminAddress: "0:a1c67f9d2fac7de14e3bfd0d454b9ecf4a10b683e532bf85585c7f96634fd160",
  minStrategyDepositValue: locklift.utils.toNano(100),
  minStrategyWithdrawValue: locklift.utils.toNano(100),
})
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
