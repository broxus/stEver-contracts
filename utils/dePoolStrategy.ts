import { Contract, Signer } from "locklift";
import { StrategyBaseAbi, TestDepoolAbi, VaultAbi } from "../build/factorySource";

export class DePoolStrategyWithPool {
  constructor(
    public readonly dePoolContract: Contract<TestDepoolAbi>,
    public readonly strategy: Contract<StrategyBaseAbi>,
    private readonly signer: Signer,
  ) {}

  emitDePoolRoundComplete = async (reward: string) => {
    await locklift.tracing.trace(
      this.dePoolContract.methods
        .roundCompelte({
          _reward: reward,
        })
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
}: {
  vaultContract: Contract<VaultAbi>;
  signer: Signer;
  poolDeployValue: string;
  strategyDeployValue: string;
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
  const strategy = await locklift.tracing.trace(
    locklift.factory.deployContract({
      contract: "StrategyBase",
      publicKey: signer.publicKey,
      initParams: {
        nonce: locklift.utils.getRandomNonce(),
      },
      constructorParams: {
        _vault: vaultContract.address,
        _dePool: dePool.contract.address,
      },
      value: strategyDeployValue,
    }),
  );
  return new DePoolStrategyWithPool(dePool.contract, strategy.contract, signer);
};
