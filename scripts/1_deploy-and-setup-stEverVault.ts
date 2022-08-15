import { Address, zeroAddress } from "locklift";
import { getVaultInfo, logger } from "./utils";

const deployAndSetupStEverVault = async ({
  adminAddress,
  deployVaultValue = locklift.utils.toNano(10),
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

  const accountFactory = locklift.factory.getAccountsFactory("Wallet");
  const adminAccountAddress = new Address(adminAddress);
  const adminAccount = accountFactory.getAccount(adminAccountAddress, signer.publicKey);

  const { code: platformCode } = locklift.factory.getContractArtifacts("Platform");
  const { code: accountCode } = locklift.factory.getContractArtifacts("StEverAccount");
  const { code: strategyDePoolCode } = locklift.factory.getContractArtifacts("StrategyDePool");

  logger.startStep("SteEver are deploying...");
  const { contract: vaultContract } = await locklift.tracing.trace(
    locklift.factory.deployContract({
      contract: "StEverVault",
      value: deployVaultValue,
      initParams: {
        nonce: locklift.utils.getRandomNonce(),
        governance: `0x${signer.publicKey}`,
        platformCode: platformCode,
        accountCode: accountCode,
      },
      publicKey: signer.publicKey,
      constructorParams: {
        _owner: new Address(adminAddress),
        _gainFee: locklift.utils.toNano(1),
      },
    }),
  );
  await locklift.tracing.trace(
    adminAccount.runTarget(
      {
        contract: vaultContract,
        value: locklift.utils.toNano(2),
      },
      vault => vault.methods.setMinStrategyDepositValue({ _minStrategyDepositValue: minStrategyDepositValue }),
    ),
  );
  await locklift.tracing.trace(
    adminAccount.runTarget(
      {
        contract: vaultContract,
        value: locklift.utils.toNano(2),
      },
      vault => vault.methods.setMinStrategyWithdrawValue({ _minStrategyWithdrawValue: minStrategyWithdrawValue }),
    ),
  );
  logger.info(`Vault details ${JSON.stringify(await getVaultInfo(vaultContract), null, 4)}`);
  logger.successStep(`Vault deployed: ${vaultContract.address.toString()}`);

  logger.startStep("SteEverRoot are deploying...");
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
        rootOwner_: vaultContract.address,
        walletCode_: tokenWalletCode,
        randomNonce_: locklift.utils.getRandomNonce(),
        deployer_: new Address(zeroAddress),
        platformCode_: tokenWalletPlatformCode,
      },
      publicKey: signer.publicKey,
      constructorParams: {
        initialSupplyTo: new Address(zeroAddress),
        initialSupply: 0,
        deployWalletValue: 0,
        mintDisabled: false,
        burnByRootDisabled: false,
        burnPaused: false,
        remainingGasTo: adminAccount.address,
      },
    }),
  );

  logger.successStep(`StEverTokenRoot deployed: ${stEverTokenRootContract.address.toString()}`);

  logger.startStep("Initializing StEverVault...");
  await locklift.tracing.trace(
    adminAccount.runTarget(
      {
        contract: vaultContract,
        value: locklift.utils.toNano(2),
      },
      vaultContract => vaultContract.methods.initVault({ _stTokenRoot: stEverTokenRootContract.address }),
    ),
  );
  logger.info(`Vault details ${JSON.stringify(await getVaultInfo(vaultContract), null, 4)}`);
  logger.successStep(`Vault initialized`);

  logger.startStep("Deploying DePoolStrategyFactory");
  const { contract: dePoolStrategyFactoryContract } = await locklift.tracing.trace(
    locklift.factory.deployContract({
      contract: "DepoolStrategyFactory",
      value: locklift.utils.toNano(2),
      publicKey: adminAccount.publicKey,
      initParams: {
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
  adminAddress: "0:ebdfb5fbb1615240d72ada4cdba95759c7ac721eeefc31137859dd7eda2f56c7",
  minStrategyDepositValue: locklift.utils.toNano(100),
  minStrategyWithdrawValue: locklift.utils.toNano(100),
})
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
