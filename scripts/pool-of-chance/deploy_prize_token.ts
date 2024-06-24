import { BigNumber } from "bignumber.js";
import { Address, toNano } from "locklift";
import prompts from "prompts";
import { isValidAddress, logger } from "../utils";

BigNumber.config({ EXPONENTIAL_AT: 256 });

async function main() {
  console.log("\x1b[1m", "\n\nSetting PrizeTokenRoot params:");

  const response = await prompts([
    {
      type: "text",
      name: "owner",
      message: "admin(owner) wallet address",
      validate: (value: string) => (isValidAddress(value) ? true : "Invalid address"),
    },
  ]);
  const signer = (await locklift.keystore.getSigner("0"))!;

  const TOKEN_ROOT_NAME = "PrizeToken";
  const TOKEN_ROOT_SYMBOL = "PTR-Test";
  const ZERO_ADDRESS = new Address("0:0000000000000000000000000000000000000000000000000000000000000000");
  const tokenWalletCode = locklift.factory.getContractArtifacts("TokenWalletUpgradeable");
  const platformCode = locklift.factory.getContractArtifacts("TokenWalletPlatform");

  const { contract } = await locklift.factory.deployContract({
    contract: "TokenRootUpgradeable",
    initParams: {
      name_: TOKEN_ROOT_NAME,
      symbol_: TOKEN_ROOT_SYMBOL,
      decimals_: 9,
      rootOwner_: response.owner,
      walletCode_: tokenWalletCode.code,
      randomNonce_: locklift.utils.getRandomNonce(),
      deployer_: ZERO_ADDRESS,
      platformCode_: platformCode.code,
    },
    publicKey: signer.publicKey,
    value: locklift.utils.toNano(2),
    constructorParams: {
      initialSupplyTo: response.owner,
      initialSupply: toNano(1000000),
      deployWalletValue: toNano(0.1),
      mintDisabled: false,
      burnByRootDisabled: false,
      burnPaused: false,
      remainingGasTo: response.owner,
    },
  });

  logger.successStep(`PrizeTokenRoot deployed: ${contract.address.toString()}`);
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
