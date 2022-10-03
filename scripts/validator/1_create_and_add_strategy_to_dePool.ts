import { Address, fromNano, toNano, WalletTypes } from "locklift";
import { Account } from "locklift/everscale-standalone-client";
import { isValidAddress, logger } from "../utils";
import { DE_POOL_ABI } from "./misc/DePool";
import prompts from "prompts";
import BigNumber from "bignumber.js";
import _ from "lodash";

const createAndAddStrategyToDePool = async ({
  strategyFactoryAddress,
  validatorMSigAccount,
  dePoolAddress,
}: {
  strategyFactoryAddress: Address;
  validatorMSigAccount: Account;
  dePoolAddress: Address;
}) => {
  const strategyFactoryContract = locklift.factory.getDeployedContract("DepoolStrategyFactory", strategyFactoryAddress);
  const dePoolContract = new locklift.provider.Contract(DE_POOL_ABI, dePoolAddress);

  logger.startStep("Sending create strategy transaction");
  const transaction = await locklift.transactions.waitFinalized(
    strategyFactoryContract.methods
      .deployStrategy({
        _dePool: dePoolAddress,
      })
      .send({
        from: validatorMSigAccount.address,
        amount: toNano(22),
      }),
  );
  logger.successStep(`Transaction successfully sent, tx: ${transaction.id.hash}`);
  logger.startStep("Waiting strategy address");
  const deployStrategyEvent = (
    await strategyFactoryContract.getPastEvents({
      filter: "NewStrategyDeployed",
    })
  ).events.find(({ data: { dePool } }) => dePool.equals(dePoolAddress));
  if (!deployStrategyEvent) {
    throw new Error("Transaction filed, please check explorer");
  }
  const strategyAddress = deployStrategyEvent.data.strategy;

  logger.successStep(`Strategy successfully created with address ${strategyAddress.toString()}`);

  logger.startStep(`Adding strategy to the DePool`);
  const addAllowedParticipantTransaction = await locklift.transactions.waitFinalized(
    dePoolContract.methods
      .setAllowedParticipant({
        _allowedParticipant: strategyAddress,
      })
      .send({
        from: validatorMSigAccount.address,
        amount: toNano(1),
      }),
  );
  logger.successStep(
    `Strategy added as allowed participant to the DePool, tx: ${addAllowedParticipantTransaction.id.hash}`,
  );
  logger.info("Summary");
  logger.info(`Strategy with address ${strategyAddress.toString()} created and added to the DePool`);
};

const main = async () => {
  const REQUIRED_BALANCE = toNano(23);

  const signer = await locklift.keystore.getSigner("15");

  if (!process.env.SEED) {
    throw new Error("SEED phrase should be provided as env parameters");
  }
  if (!signer) {
    throw new Error("Bad SEED phrase");
  }

  console.log("\x1b[1m", "\n\nSetting strategy params:");

  const response = await prompts([
    {
      type: "text",
      name: "strategyFactoryAddress",
      message: "StEverStrategyFactory address",
      validate: (value: string) => (isValidAddress(value) ? true : "Invalid Everscale address"),
    },
    {
      type: "text",
      name: "validatorMSigWalletAddress",
      message: "Validator Multi Sig wallet address",
      validate: (value: string) => (isValidAddress(value) ? true : "Invalid Everscale address"),
    },
    {
      type: "text",
      name: "dePoolAddress",
      message: "DePool address",
      validate: (value: string) => (isValidAddress(value) ? true : "Invalid Everscale address"),
    },
  ]);
  const { strategyFactoryAddress, validatorMSigWalletAddress, dePoolAddress } = _(response)
    .mapValues(address => new Address(address))
    .value();
  const validatorMSigAccount = await locklift.factory.accounts.addExistingAccount({
    publicKey: signer.publicKey,
    type: WalletTypes.MsigAccount,
    address: validatorMSigWalletAddress,
  });
  const mSigWalletBalance = await locklift.provider.getBalance(validatorMSigWalletAddress);
  logger.info(`Wallet balance is ${fromNano(mSigWalletBalance)} ever`);
  if (new BigNumber(mSigWalletBalance).lt(REQUIRED_BALANCE)) {
    throw new Error(`Wallet balance should greater than ${fromNano(REQUIRED_BALANCE)} ever`);
  }
  await createAndAddStrategyToDePool({
    validatorMSigAccount,
    dePoolAddress,
    strategyFactoryAddress,
  });
};
main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
