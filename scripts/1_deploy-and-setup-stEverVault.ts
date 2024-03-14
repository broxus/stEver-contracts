import { Address, fromNano, Signer, toNano, WalletTypes } from "locklift";
import { getVaultInfo, isValidAddress, logger } from "./utils";
import prompts from "prompts";
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
  const { code: clusterCode } = locklift.factory.getContractArtifacts("StEverCluster");

  const tempAdmin = await locklift.factory.accounts.addNewAccount({
    type: WalletTypes.EverWallet,
    value: toNano(1.5),
    publicKey: signer.publicKey,
    nonce: locklift.utils.getRandomNonce(),
  });

  logger.startStep("StEverVault is deploying...");
  const {
    extTransaction: { contract: vaultContract },
  } = await locklift.transactions.waitFinalized(
    locklift.factory.deployContract({
      contract: "StEverVault",
      value: deployVaultValue.toString(),
      initParams: {
        clusterCode,
        nonce: locklift.utils.getRandomNonce(),
        governance: `0x${governancePublicKey}`,
        platformCode: platformCode,
        accountCode: accountCode,
      },
      publicKey: signer.publicKey,

      constructorParams: {
        _owner: tempAdmin.account.address,
        _gainFee: gainFee,
        _stEverFeePercent: stEverFeePercent,
        _stTokenRoot: tokenRoot,
      },
    }),
  );

  logger.info(`Vault details ${JSON.stringify(await getVaultInfo(vaultContract), null, 4)}`);
  logger.successStep(`Vault deployed: ${vaultContract.address.toString()}`);

  logger.startStep("Deploying DePoolStrategyFactory");
  const {
    extTransaction: { contract: dePoolStrategyFactoryContract },
  } = await locklift.transactions.waitFinalized(
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

  const { extTransaction } = await locklift.transactions.waitFinalized(
    vaultContract.methods
      .setStrategyFactory({
        _strategyFactory: dePoolStrategyFactoryContract.address,
      })
      .send({
        from: tempAdmin.account.address,
        amount: toNano(1),
      }),
  );
  logger.successStep(`StrategyFactory added to the vault, tx: ${extTransaction.id.hash}`);

  {
    const { extTransaction } = await locklift.transactions.waitFinalized(
      vaultContract.methods
        .transferOwnership({
          _sendGasTo: adminAddress,
          _newOwner: adminAddress,
        })
        .send({
          from: tempAdmin.account.address,
          amount: toNano(1),
        }),
    );
    logger.successStep(`Ownership transferred to ${adminAddress.toString()}, tx: ${extTransaction.id.hash}`);
  }

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
  const MIN_DEPLOY_VAULT_VALUE_IN_EVER = toNano(1);
  const ONE_HANDED_PERCENT = 1000;

  const MIN_GAIN_FEE = toNano(1);
  const signer = (await locklift.keystore.getSigner("0"))!;

  if (!process.env.MAIN_GIVER_KEY) {
    throw new Error("SEED phrase and MAIN_GIVER_KEY should be provided as env parameters");
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
      message: "StEverVault deploy value (nano ever), min 100 ever",
      validate: (value: number) => value >= Number(MIN_DEPLOY_VAULT_VALUE_IN_EVER),
    },
    {
      type: "number",
      name: "gainFee",
      message: "GainFee (nano ever), min 1 ever",
      validate: (value: number) => value >= Number(MIN_GAIN_FEE),
    },
    {
      type: "number",
      name: "stEverPercentFee",
      message: `StEver platform fee (0..${ONE_HANDED_PERCENT}), 1% == ${ONE_HANDED_PERCENT / 100}`,
      validate: (value: number) => value >= 0 && value <= ONE_HANDED_PERCENT,
    },
  ]);

  if (!response.mSigWallet || !response.governancePK) {
    throw new Error("You need to provide required fields");
  }

  console.log("\x1b[1m", "\nSetup complete! ✔ ");

  const { deployVaultValue, gainFee, stEverFeePercent, adminAddress, tokenRoot } = {
    deployVaultValue: response.deployVaultValue,
    gainFee: response.gainFee,
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
    tokenRoot,
    signer,
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
