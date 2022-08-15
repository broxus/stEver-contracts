import { logger } from "./utils";
import { concatMap, defer, lastValueFrom, range, toArray } from "rxjs";
import { Address } from "locklift";

const deployMockDePoolAndStrategies = async ({
  count,
  adminAddress,
  adminPubKey,
  dePoolStrategyFactoryAddress,
  vaultAddress: vault,
  dePoolValue = locklift.utils.toNano(100),
}: {
  count: number;
  adminAddress: string;

  adminPubKey: string;
  dePoolStrategyFactoryAddress: string;
  vaultAddress: string;
  dePoolValue: string;
}) => {
  const accountFactory = locklift.factory.getAccountsFactory("Wallet");
  const vaultAddress = new Address(vault);
  //admin account
  const adminAccount = accountFactory.getAccount(new Address(adminAddress), adminPubKey);
  //dePoolStrategyFactoryFactory
  const dePoolStrategyFactoryContract = locklift.factory.getDeployedContract(
    "DepoolStrategyFactory",
    new Address(dePoolStrategyFactoryAddress),
  );

  logger.startStep(`Deploying ${count} DePools and strategies`);
  const strategiesWithDePools = await lastValueFrom(
    range(count).pipe(
      concatMap(() =>
        defer(async () => {
          const { contract: dePoolContract } = await locklift.tracing.trace(
            locklift.factory.deployContract({
              contract: "TestDepool",
              // value for rewards
              value: dePoolValue,
              constructorParams: {},
              publicKey: adminAccount.publicKey,
              initParams: {
                nonce: locklift.utils.getRandomNonce(),
              },
            }),
          );
          await locklift.tracing.trace(
            adminAccount.runTarget(
              {
                contract: dePoolStrategyFactoryContract,
                value: locklift.utils.toNano(6),
              },
              factory => factory.methods.deployStrategy({ _vault: vaultAddress, _dePool: dePoolContract.address }),
            ),
          );
          const { events } = await dePoolStrategyFactoryContract.getPastEvents({
            filter: ({ event }) => event === "NewStrategyDeployed",
          });
          if (events[0].event !== "NewStrategyDeployed") {
            throw new Error("NewStrategyDeployed event not emitted");
          }
          return {
            dePoolContract: dePoolContract,
            strategyContract: locklift.factory.getDeployedContract("StrategyDePool", events[0].data.strategy),
          };
        }),
      ),
      toArray(),
    ),
  );
  strategiesWithDePools.forEach(({ strategyContract, dePoolContract }) =>
    logger.successStep(
      `Deployed new dePool: ${dePoolContract.address.toString()} and related strategy: ${strategyContract.address.toString()}`,
    ),
  );
};

deployMockDePoolAndStrategies({
  dePoolValue: locklift.utils.toNano(100),
  vaultAddress: "",
  count: 3,
  dePoolStrategyFactoryAddress: "",
  adminPubKey: "",
  adminAddress: "",
})
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
