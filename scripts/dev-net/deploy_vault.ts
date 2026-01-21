import { getVaultInfo, logger } from "../utils";
import { getRandomNonce, toNano, WalletTypes } from "locklift";
import { Address } from "locklift/everscale-provider";
import { deployTokenRoot } from "../../test/preparation";
import { Controller } from "../../utils/controller";
import { convertEverGas, DEPLOY_WALLET_VALUE, toNanoBn } from "../../utils";
import { CONTROLLER_DEPLOY_ADDITIONAL_VALUE, CONTROLLER_DEPLOY_VALUE, MIN_CALL_MSG_VALUE } from "../../utils/constants";
import { getPublicKey } from "everscale-crypto";
import { start } from "./gas_price";

// locklift.network.insertWallet(new Address("0:6c816f2c4840bb6ad434c0ca25b4947d6159409ea5002c0066602c1c4125b83b"));
const main1 = async () => {
  console.log(`0x${getPublicKey("0x172af540e43a524763dd53b26a066d472a97c4de37d5498170564510608250c3")}`);

  const signer = (await locklift.keystore.getSigner("0"))!;

  const {
    account: { address: adminAddress },
  } = await locklift.factory.accounts.addNewAccount({
    publicKey: await locklift.keystore.getSigner("0")!.then(res => res?.publicKey!),
    type: WalletTypes.EverWallet,
    value: toNano(10),
  });

  await locklift.provider.getBalance(adminAddress).then(res => console.log(res));

  locklift.keystore.addKeyPair({
    publicKey: getPublicKey("0x172af540e43a524763dd53b26a066d472a97c4de37d5498170564510608250c3"),
    secretKey: "0x172af540e43a524763dd53b26a066d472a97c4de37d5498170564510608250c3",
  });
  //
  logger.startStep("Deploying token root...");
  const tokenRoot = await deployTokenRoot({ signer, owner: adminAddress });

  logger.successStep(`Token root deployed ${tokenRoot.address.toString()}`);

  const { code: platformCode } = locklift.factory.getContractArtifacts("Platform");
  const { code: accountCode } = locklift.factory.getContractArtifacts("StEverAccount");
  const { code: strategyDePoolCode } = locklift.factory.getContractArtifacts("StrategyDePool");
  const { code: clusterCode } = locklift.factory.getContractArtifacts("StEverCluster");
  logger.startStep("StEverVault is deploying...");
  const { contract: vaultContract, traceTree: deployVaultTraceTree } = await locklift.tracing.trace(
    locklift.factory.deployContract({
      contract: "StEverVault",
      value: locklift.utils.toNano(convertEverGas(10)),
      initParams: {
        clusterCode,
        nonce: locklift.utils.getRandomNonce(),
        governance: `0x${getPublicKey("0x172af540e43a524763dd53b26a066d472a97c4de37d5498170564510608250c3")}`,
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
        _maxValidatorRequestedStake: toNano(1_000_000),
      },
    }),
    {
      raise: false,
    },
  );

  await deployVaultTraceTree?.beautyPrint();

  logger.info(`Vault details ${JSON.stringify(await getVaultInfo(vaultContract), null, 4)}`);
  logger.successStep(`Vault deployed: ${vaultContract.address.toString()}`);

  logger.startStep("Transferring ownership of token root...");
  console.log(
    `TOKEN NAME ${await tokenRoot.methods
      .name({ answerId: 0 })
      .call()
      .then(res => res.value0)}`,
  );
  await tokenRoot.methods
    .transferOwnership({
      remainingGasTo: adminAddress,
      newOwner: vaultContract.address,
      callbacks: [],
    })
    .send({
      from: adminAddress,
      amount: toNano(10),
    });
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
        controllerStrategyInitialCode: Controller.code,
        controllerStrategyCurrentCode: Controller.code,
        elector: new Address("-1:3333333333333333333333333333333333333333333333333333333333333333"),
      },
      constructorParams: {
        _owner: adminAddress,
      },
    }),
  );
  logger.successStep(`Factory deployed: ${factoryContact.address.toString()}`);
  console.log(`ADMIN BALANCE ${await locklift.provider.getBalance(adminAddress)}`);
  // const vaultContract = VAULT;
  // const factoryContact = FACTORY;
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
        amount: (
          Number(convertEverGas(toNano(0.3 + MIN_CALL_MSG_VALUE))) +
          Number(toNano(1)) +
          DEPLOY_WALLET_VALUE * 2
        ).toString(),
      }),
    {
      raise: false,
    },
  );
  await deployClusterTraceTree?.beautyPrint();
  const clusterAddress = deployClusterTraceTree?.findEventsForContract({
    contract: vaultContract,
    name: "ClusterCreated" as const,
  })[0].cluster!;
  logger.successStep(`Cluster deployed: ${clusterAddress.toString()}`);

  logger.startStep("Deploying controller...");
  const clusterContract = locklift.factory.getDeployedContract("StEverCluster", clusterAddress);
  const gasForOneController = toNanoBn(CONTROLLER_DEPLOY_VALUE)
    .plus(toNanoBn(convertEverGas(0.1)))
    .plus(toNanoBn(convertEverGas(CONTROLLER_DEPLOY_ADDITIONAL_VALUE)));

  const { traceTree: createControllerTraceTree } = await locklift.tracing.trace(
    clusterContract.methods
      .deployStrategies({
        _validator: adminAddress,
        count: 2,
      })
      .send({
        from: adminAddress,
        amount: gasForOneController
          .multipliedBy(2)
          .plus(toNanoBn(convertEverGas(0.1)).multipliedBy(2))
          .toString(),
      }),
    {
      raise: false,
    },
  );

  const controllerAddresses = createControllerTraceTree
    ?.findEventsForContract({
      contract: clusterContract,
      name: "NewStrategyDeployed" as const,
    })
    .map(el => el.strategy);

  logger.successStep(`Controller deployed: \n${controllerAddresses?.join("\n")}`);

  logger.startStep("User depositing...");
  const { traceTree } = await locklift.tracing.trace(
    vaultContract.methods
      .deposit({
        _amount: toNano(105_000),
        _nonce: getRandomNonce(),
      })
      .send({
        from: adminAddress,
        amount: (Number(toNano(105_000)) + Number(toNano(convertEverGas(1)))).toString(),
        bounce: true,
      }),
  );
  await traceTree?.beautyPrint();
};

main1().then(
  () => process.exit(0),
  e => {
    console.error(e);
    process.exit(1);
  },
);
