import { BigNumber } from "bignumber.js";
import { getRandomNonce } from "locklift";
import prompts from "prompts";
import { isValidAddress, logger } from "../utils";

BigNumber.config({ EXPONENTIAL_AT: 256 });

async function main() {
  console.log("\x1b[1m", "\n\nSetting PoolOfChance params:");

  const response = await prompts([
    {
      type: "text",
      name: "owner",
      message: "admin(owner) wallet address",
      validate: (value: string) => (isValidAddress(value) ? true : "Invalid address"),
    },
    {
      type: "text",
      name: "stTokenRoot",
      message: "stEver token root address",
      validate: (value: string) => (isValidAddress(value) ? true : "Invalid address"),
    },
    {
      type: "text",
      name: "stVault",
      message: "stEverVault address",
      validate: (value: string) => (isValidAddress(value) ? true : "Invalid address"),
    },
  ]);
  const signer = (await locklift.keystore.getSigner("0"))!;

  const { contract } = await locklift.factory.deployContract({
    contract: "PoolOfChanceFactory",
    value: locklift.utils.toNano(5),
    constructorParams: {
      _owner: response.owner,
      _stTokenRoot: response.stTokenRoot,
      _stEverVault: response.stVault,
      _poolCode: locklift.factory.getContractArtifacts("PoolOfChance").code,
    },
    publicKey: signer.publicKey,
    initParams: {
      _randomNonce: getRandomNonce(),
    },
  });

  logger.successStep(`PoolOfChanceFactory deployed: ${contract.address.toString()}`);
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
