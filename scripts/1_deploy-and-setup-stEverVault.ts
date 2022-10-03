import { Address, fromNano, Signer, toNano, WalletTypes, zeroAddress } from "locklift";
import { getVaultInfo, isValidAddress, logger } from "./utils";
import prompts from "prompts";
import { Account } from "locklift/everscale-standalone-client";
import BigNumber from "bignumber.js";

const deployAndSetupStEverVault = async ({
  signer,
  adminAccount,
  governancePublicKey,
  deployVaultValue,
  gainFee,
  stEverFeePercent,
  minStrategyWithdrawValue = locklift.utils.toNano(100),
  minStrategyDepositValue = locklift.utils.toNano(100),
}: {
  adminAccount: Account;
  signer: Signer;
  governancePublicKey: string;
  deployVaultValue: string;
  gainFee: string;
  stEverFeePercent: number;
  minStrategyDepositValue?: string;
  minStrategyWithdrawValue?: string;
}) => {
  if (!signer) {
    throw new Error("Admin signer not found");
  }

  const { code: platformCode } = locklift.factory.getContractArtifacts("Platform");
  const { code: accountCode } = locklift.factory.getContractArtifacts("StEverAccount");
  const { code: strategyDePoolCode } = locklift.factory.getContractArtifacts("StrategyDePool");
  const { tvc: stEverTvc } = locklift.factory.getContractArtifacts("StEverVault");
  logger.startStep("Obtaining StEverVault Address");
  const deployVaultParams = {
    publicKey: signer.publicKey,
    initParams: {
      nonce: locklift.utils.getRandomNonce(),
      governance: `0x${governancePublicKey}`,
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
  logger.startStep("StEverRoot is deploying...");
  const TOKEN_ROOT_NAME = "StEver";
  const TOKEN_ROOT_SYMBOL = "StEver";
  const { code: tokenWalletCode } = locklift.factory.getContractArtifacts("TokenWalletUpgradeable");
  const { code: tokenWalletPlatformCode } = locklift.factory.getContractArtifacts("TokenWalletPlatform");
  const { contract: stEverTokenRootContract } = await locklift.transactions.waitFinalized(
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

  logger.startStep("StEverVault is deploying...");
  const { contract: vaultContract } = await locklift.transactions.waitFinalized(
    locklift.factory.deployContract({
      contract: "StEverVault",
      value: deployVaultValue,
      initParams: deployVaultParams.initParams,
      publicKey: deployVaultParams.publicKey,
      constructorParams: {
        _owner: adminAccount.address,
        _gainFee: gainFee,
        _stEverFeePercent: stEverFeePercent,
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
  const { contract: dePoolStrategyFactoryContract } = await locklift.transactions.waitFinalized(
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

  logger.info("Summary");
  logger.info(
    `${JSON.stringify(
      {
        stEverVaultAddress: vaultContract.address.toString(),
        stEverTokenRoot: stEverTokenRootContract.address.toString(),
        strategyFactory: dePoolStrategyFactoryContract.address.toString(),
      },
      null,
      4,
    )}`,
  );
};
const main = async () => {
  const MIN_DEPLOY_VAULT_VALUE_IN_EVER = 100;
  const ONE_HANDED_PERCENT = 1000;

  const MIN_GAIN_FEE = 1;
  const onePercentMultiplier = ONE_HANDED_PERCENT / 100;
  const signer = await locklift.keystore.getSigner("0");

  if (!process.env.SEED || !process.env.MAIN_GIVER_KEY) {
    throw new Error("SEED phrase and MAIN_GIVER_KEY should be provided as env parameters");
  }
  if (!signer) {
    throw new Error("Bad SEED phrase");
  }

  console.log("\x1b[1m", "\n\nSetting StEverVault params:");

  const response = await prompts([
    {
      type: "text",
      name: "mSigWallet",
      message: "MultiSig admin(owner) wallet address",
      validate: (value: string) => (isValidAddress(value) ? true : "Invalid Everscale address"),
    },
    {
      type: "text",
      name: "governancePK",
      message: "Governance PUBLIC key",
    },
    {
      type: "number",
      name: "deployVaultValue",
      message: "StEverVault deploy value (ever), min 100 ever",
      validate: (value: number) => value >= MIN_DEPLOY_VAULT_VALUE_IN_EVER,
    },
    {
      type: "number",
      name: "gainFee",
      message: "GainFee (ever) ,min 1 ever",
      validate: (value: number) => value >= MIN_GAIN_FEE,
    },
    {
      type: "text",
      name: "stEverPercentFee",
      message: "StEver platform fee (0..100%)",
      validate: (value: string) => new BigNumber(value).gte(0) && new BigNumber(value).lte(100),
    },
  ]);

  if (!response.mSigWallet || !response.governancePK) {
    throw new Error("You need to provide required fields");
  }

  console.log("\x1b[1m", "\nSetup complete! ✔ ");

  const { deployVaultValue, gainFee, stEverFeePercent } = {
    deployVaultValue: toNano(response.deployVaultValue),
    gainFee: toNano(response.gainFee),
    stEverFeePercent: new BigNumber(response.stEverPercentFee).multipliedBy(onePercentMultiplier).toNumber(),
  };

  const adminAccount = await locklift.factory.accounts.addExistingAccount({
    publicKey: signer.publicKey,
    address: new Address(response.mSigWallet),
    type: WalletTypes.MsigAccount,
  });
  const giverBalance = await locklift.provider.getBalance(new Address(locklift.context.network.config.giver.address));
  console.log(`giver balance is ${fromNano(giverBalance)} ever`);

  if (new BigNumber(giverBalance).lt(deployVaultValue)) {
    throw new Error(`Giver balance should gt ${fromNano(deployVaultValue)} ever`);
  }

  await deployAndSetupStEverVault({
    adminAccount,
    signer,
    deployVaultValue,
    gainFee,
    stEverFeePercent,
    governancePublicKey: response.governancePK,
    minStrategyDepositValue: locklift.utils.toNano(100),
    minStrategyWithdrawValue: locklift.utils.toNano(100),
  });
};
main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
