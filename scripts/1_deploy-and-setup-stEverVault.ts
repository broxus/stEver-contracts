import { Address, fromNano, Signer, toNano, WalletTypes, zeroAddress } from "locklift";
import { getVaultInfo, isValidAddress, logger } from "./utils";
import prompts from "prompts";
import { Account } from "locklift/everscale-standalone-client";
import BigNumber from "bignumber.js";

const deployAndSetupStEverVault = async ({
  signer,
  adminAddress,
  tokenRoot,
  governancePublicKey,
  deployVaultValue,
  gainFee,
  stEverFeePercent,
}: {
  adminAddress: Address;
  signer: Signer;
  tokenRoot: Address;
  governancePublicKey: string;
  deployVaultValue: string;
  gainFee: string;
  stEverFeePercent: number;
}) => {
  if (!signer) {
    throw new Error("Signer not found");
  }
  const { code: platformCode } = locklift.factory.getContractArtifacts("Platform");
  const { code: accountCode } = locklift.factory.getContractArtifacts("StEverAccount");
  const { code: strategyDePoolCode } = locklift.factory.getContractArtifacts("StrategyDePool");

  logger.startStep("StEverVault is deploying...");
  const { contract: vaultContract } = await locklift.transactions.waitFinalized(
    locklift.factory.deployContract({
      contract: "StEverVault",
      value: deployVaultValue,
      initParams: {
        nonce: locklift.utils.getRandomNonce(),
        governance: `0x${governancePublicKey}`,
        platformCode: platformCode,
        accountCode: accountCode,
      },
      publicKey: signer.publicKey,

      constructorParams: {
        _owner: adminAddress,
        _gainFee: gainFee,
        _stEverFeePercent: stEverFeePercent,
        _stTokenRoot: tokenRoot,
      },
    }),
  );

  logger.info(`Vault details ${JSON.stringify(await getVaultInfo(vaultContract), null, 4)}`);
  logger.successStep(`Vault deployed: ${vaultContract.address.toString()}`);

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
        _owner: adminAddress,
      },
    }),
  );
  logger.successStep(`DePoolStrategyFactory deployed ${dePoolStrategyFactoryContract.address.toString()}`);

  logger.info("Summary");
  logger.info(
    `${JSON.stringify(
      {
        stEverVaultAddress: vaultContract.address.toString(),
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
      name: "tokenRoot",
      message: "TokeRoot address",
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
      message: "StEver platform fee (0..1000), 1% == 10",
      validate: (value: string) => new BigNumber(value).gte(0) && new BigNumber(value).lte(ONE_HANDED_PERCENT),
    },
  ]);

  if (!response.mSigWallet || !response.governancePK) {
    throw new Error("You need to provide required fields");
  }

  console.log("\x1b[1m", "\nSetup complete! ✔ ");

  const { deployVaultValue, gainFee, stEverFeePercent, adminAddress, tokenRoot } = {
    deployVaultValue: toNano(response.deployVaultValue),
    gainFee: toNano(response.gainFee),
    adminAddress: new Address(response.mSigWallet),
    stEverFeePercent: response.stEverPercentFee,
    tokenRoot: new Address(response.tokenRoot),
  };

  const giverBalance = await locklift.provider.getBalance(new Address(locklift.context.network.config.giver.address));
  console.log(`giver balance is ${fromNano(giverBalance)} ever`);

  if (new BigNumber(giverBalance).lt(deployVaultValue)) {
    throw new Error(`Giver balance should gt ${fromNano(deployVaultValue)} ever`);
  }

  await deployAndSetupStEverVault({
    adminAddress,
    signer,
    tokenRoot,
    deployVaultValue,
    gainFee,
    stEverFeePercent,
    governancePublicKey: response.governancePK,
  });
};
main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
