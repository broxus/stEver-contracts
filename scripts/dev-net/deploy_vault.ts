import { getVaultInfo, logger } from "../utils";
import { getRandomNonce, toNano, WalletTypes } from "locklift";
import { Address } from "locklift/everscale-provider";
import { deployTokenRoot } from "../../test/preparation";
import { Controller } from "../../utils/controller";
import { convertEverGas, toNanoBn } from "../../utils";
import { CONTROLLER_DEPLOY_VALUE, MIN_CALL_MSG_VALUE } from "../../utils/constants";
import { start } from "./gas_price";

const main1 = async () => {
  const signer = (await locklift.keystore.getSigner("0"))!;
  const adminAddress = new Address("0:6c816f2c4840bb6ad434c0ca25b4947d6159409ea5002c0066602c1c4125b83b");
  const account = await locklift.factory.accounts.addExistingAccount({
    address: adminAddress,
    type: WalletTypes.EverWallet,
  });

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
      value: locklift.utils.toNano(convertEverGas(1)),
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

  logger.startStep("Deploy factory...");
  const { contract: factoryContact } = await locklift.tracing.trace(
    locklift.factory.deployContract({
      contract: "ControllerStrategyFactory",
      value: locklift.utils.toNano(convertEverGas(1)),
      publicKey: signer.publicKey,
      initParams: {
        stEverVault: vaultContract.address,
        nonce: locklift.utils.getRandomNonce(),
        controllerStrategyCode: Controller.code,
        elector: new Address("-1:3333333333333333333333333333333333333333333333333333333333333333"),
      },
      constructorParams: {
        _owner: adminAddress,
      },
    }),
  );
  logger.successStep(`Factory deployed: ${factoryContact.address.toString()}`);
  logger.startStep("Set factory...");
  await locklift.tracing.trace(
    vaultContract.methods
      .setStrategyFactory({
        _strategyFactory: factoryContact.address,
      })
      .send({
        from: adminAddress,
        amount: toNano(convertEverGas(MIN_CALL_MSG_VALUE)),
      }),
  );
  logger.successStep("Factory set");

  logger.startStep("Deploy cluster...");
  // const vaultContract = locklift.factory.getDeployedContract(
  //   "StEverVault",
  //   new Address("0:3cba038ca1a42e7d2273325858f70a5cf53de2d55414c996b964a3d8a59dbf14"),
  // );
  const { traceTree: deployClusterTraceTree } = await locklift.tracing.trace(
    vaultContract.methods
      .createCluster({
        _clusterOwner: adminAddress,
        _assurance: toNano(0),
        _maxStrategiesCount: 100,
      })
      .send({
        from: adminAddress,
        amount: convertEverGas(toNano(0.3 + MIN_CALL_MSG_VALUE)),
      }),
  );
  const clusterAddress = deployClusterTraceTree?.findEventsForContract({
    contract: vaultContract,
    name: "ClusterCreated" as const,
  })[0].cluster!;
  logger.successStep(`Cluster deployed: ${clusterAddress.toString()}`);

  logger.startStep("Deploying controller...");
  const clusterContract = locklift.factory.getDeployedContract("StEverCluster", clusterAddress);
  const gasForOneController = toNanoBn(CONTROLLER_DEPLOY_VALUE).plus(toNanoBn(convertEverGas(0.1)));

  const { traceTree: createControllerTraceTree } = await locklift.tracing.trace(
    clusterContract.methods
      .deployStrategies({
        _validator: adminAddress,
        count: 1,
      })
      .send({
        from: adminAddress,
        amount: gasForOneController
          .multipliedBy(1)
          .plus(toNanoBn(convertEverGas(0.1)))
          .toString(),
      }),
  );

  const controllerAddress = createControllerTraceTree?.findEventsForContract({
    contract: clusterContract,
    name: "NewStrategyDeployed" as const,
  })[0].strategy!;
  logger.successStep(`Controller deployed: ${controllerAddress.toString()}`);

  logger.startStep("User depositing...");
  await locklift.tracing.trace(
    vaultContract.methods
      .deposit({
        _amount: toNano(60_000),
        _nonce: getRandomNonce(),
      })
      .send({
        from: adminAddress,
        amount: (Number(toNano(60_000)) + Number(toNano(convertEverGas(1)))).toString(),
        bounce: true,
      }),
  );
};

main1().then(
  () => process.exit(0),
  e => {
    console.error(e);
    process.exit(1);
  },
);
