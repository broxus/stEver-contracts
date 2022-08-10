import { Contract, Signer } from "locklift";
import { StEverVaultAbi, StrategyBaseAbi, TestDepoolAbi } from "../../build/factorySource";
import { StrategyFactory } from "./strategyFactory";
import { getAddressEverBalance } from "../index";

export class DePoolStrategyWithPool {
  constructor(
    public readonly dePoolContract: Contract<TestDepoolAbi>,
    public readonly strategy: Contract<StrategyBaseAbi>,
    private readonly signer: Signer,
  ) {}

  emitDePoolRoundComplete = async (reward: string) => {
    return await locklift.tracing.trace(
      this.dePoolContract.methods
        .roundCompelte({
          _reward: reward,
        })
        .sendExternal({ publicKey: this.signer.publicKey }),
    );
  };

  setDePoolDepositsState = ({ isClosed }: { isClosed: boolean }) => {
    return locklift.tracing.trace(
      this.dePoolContract.methods.setClosed({ _closed: isClosed }).sendExternal({ publicKey: this.signer.publicKey }),
    );
  };
  setDePoolWithdrawalState = ({ isClosed }: { isClosed: boolean }) => {
    return locklift.tracing.trace(
      this.dePoolContract.methods
        .setWithdrawalsClosed({ _withdrawalsClosed: isClosed })
        .sendExternal({ publicKey: this.signer.publicKey }),
    );
  };

  getStrategyBalance = () => locklift.provider.getBalance(this.strategy.address);
}

export const createStrategy = async ({
  vaultContract,
  signer,
  poolDeployValue,
  strategyDeployValue,
  strategyFactory,
}: {
  vaultContract: Contract<StEverVaultAbi>;
  signer: Signer;
  poolDeployValue: string;
  strategyDeployValue: string;
  strategyFactory: StrategyFactory;
}): Promise<DePoolStrategyWithPool> => {
  const dePool = await locklift.tracing.trace(
    locklift.factory.deployContract({
      contract: "TestDepool",
      value: poolDeployValue,
      constructorParams: {},
      publicKey: signer.publicKey,
      initParams: {
        nonce: locklift.utils.getRandomNonce(),
      },
    }),
  );
  const strategyAddress = await strategyFactory.deployStrategy({
    deployValue: strategyDeployValue,
    dePool: dePool.contract.address,
  });
  console.log(`strategy balance: ${await getAddressEverBalance(strategyAddress)}`);

  return new DePoolStrategyWithPool(
    dePool.contract,
    locklift.factory.getDeployedContract("StrategyBase", strategyAddress),
    signer,
  );
};
