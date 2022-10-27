import { Address, fromNano, Signer, toNano, WalletTypes } from "locklift";
import { isValidAddress, logger } from "./utils";
import prompts from "prompts";
import { Account } from "everscale-standalone-client";

const upgradeVault = async ({
  signer,
  account,
  vaultAddress,
}: {
  signer: Signer;
  account: Account;
  vaultAddress: Address;
}) => {
  if (!signer) {
    throw new Error("Signer not found");
  }
  const { code } = locklift.factory.getContractArtifacts("StEverVault");
  const vaultContract = locklift.factory.getDeployedContract("StEverVault", vaultAddress);
  logger.startStep("StEverVault is upgrading...");
  const transaction = await locklift.transactions.waitFinalized(
    vaultContract.methods.upgrade({ _sendGasTo: account.address, _newVersion: 1, _newCode: code }).send({
      from: account.address,
      bounce: true,
      amount: toNano(1),
    }),
  );
  logger.successStep(`StEverVault upgraded with tx ${transaction.id.hash}`);
};

const main = async () => {
  const signer = await locklift.keystore.getSigner("0");

  if (!process.env.SEED || !process.env.MAIN_GIVER_KEY) {
    throw new Error("SEED phrase and MAIN_GIVER_KEY should be provided as env parameters");
  }
  if (!signer) {
    throw new Error("Bad SEED phrase");
  }
  const response = await prompts([
    {
      type: "text",
      name: "mSigAddress",
      message: "Owner multisig address",
      validate: (value: string) => (isValidAddress(value) ? true : "Invalid Everscale address"),
    },
    {
      type: "text",
      name: "vaultAddress",
      message: "StEverVault address",
      validate: (value: string) => (isValidAddress(value) ? true : "Invalid Everscale address"),
    },
  ]);
  const account = await locklift.factory.accounts.addExistingAccount({
    type: WalletTypes.MsigAccount,
    address: new Address(response.mSigAddress),
    publicKey: signer.publicKey,
  });
  console.log(`Wallet balance is ${fromNano(await locklift.provider.getBalance(account.address))}`);
  await upgradeVault({
    account,
    signer,
    vaultAddress: new Address(response.vaultAddress),
  });
};

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
