import { getVaultInfo, logger } from "./utils";
import { toNano, WalletTypes } from "locklift";
import { Address } from "locklift/everscale-provider";
import { deployTokenRoot } from "../test/preparation";

const main1 = async () => {
  const signer = (await locklift.keystore.getSigner("0"))!;
  const adminAddress = new Address("0:6c816f2c4840bb6ad434c0ca25b4947d6159409ea5002c0066602c1c4125b83b");
  const account = await locklift.factory.accounts.addExistingAccount({
    address: adminAddress,
    type: WalletTypes.EverWallet,
  });
  locklift.provider.;
  const CONFIG_ABI = {
    "ABI version": 2,
    version: "2.2",
    header: [],
    functions: [],
    events: [],
    fields: [
      {
        name: "paramsRoot",
        type: "cell",
      },
    ],
  } as const;
  const config = new locklift.provider.Contract(
    CONFIG_ABI,
    new Address("-1:5555555555555555555555555555555555555555555555555555555555555555"),
  );

  const { fields } = await config.getFields({ allowPartial: true });
  if (fields == null) {
    throw new Error("Config contract state not found");
  }
  console.log(fields.paramsRoot);

  const { boc: nonEmptyMap } = await locklift.provider.packIntoCell({
    abiVersion: "2.2",
    structure: [
      { name: "flag", type: "bool" },
      { name: "root", type: "cell" },
    ] as const,
    data: {
      flag: true,
      root: fields.paramsRoot,
    },
  });
  throw new Error("Not implemented");

  logger.startStep("Deploying token root...");
  const tokenRoot = await deployTokenRoot({ signer, owner: adminAddress });
  logger.successStep(`Token root deployed ${tokenRoot.address.toString()}`);

  const { code: platformCode } = locklift.factory.getContractArtifacts("Platform");
  const { code: accountCode } = locklift.factory.getContractArtifacts("StEverAccount");
  const { code: strategyDePoolCode } = locklift.factory.getContractArtifacts("StrategyDePool");
  const { code: clusterCode } = locklift.factory.getContractArtifacts("StEverCluster");
  logger.startStep("StEverVault is deploying...");
  const {
    extTransaction: { contract: vaultContract },
  } = await locklift.transactions.waitFinalized(
    locklift.factory.deployContract({
      contract: "StEverVault",
      value: locklift.utils.toNano(10),
      initParams: {
        clusterCode,
        nonce: locklift.utils.getRandomNonce(),
        governance: `0x${signer.publicKey}`,
        platformCode: platformCode,
        accountCode: accountCode,
      },
      publicKey: signer.publicKey,

      constructorParams: {
        _owner: adminAddress,
        _gainFee: toNano(1),
        _stEverFeePercent: "0",
        _stTokenRoot: tokenRoot.address,
        _minControllerBalance: toNano(0),
        _maxControllerInterest: 1000,
      },
    }),
  );

  logger.info(`Vault details ${JSON.stringify(await getVaultInfo(vaultContract), null, 4)}`);
  logger.successStep(`Vault deployed: ${vaultContract.address.toString()}`);

  logger.startStep("Transferring ownership of token root...");
  const { traceTree } = await locklift.tracing.trace(
    tokenRoot.methods
      .transferOwnership({
        remainingGasTo: adminAddress,
        newOwner: vaultContract.address,
        callbacks: [],
      })
      .send({
        from: adminAddress,
        amount: toNano(10),
      }),
  );
  logger.successStep("Ownership transferred");
};

main1().then(
  () => process.exit(0),
  e => {
    console.error(e);
    process.exit(1);
  },
);
