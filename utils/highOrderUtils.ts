import { User } from "./entities/user";
import { concatMap, from, lastValueFrom, map, toArray } from "rxjs";
import { Governance } from "./entities/governance";
import { Signer, Transaction, zeroAddress } from "locklift";
import { createStrategy, DePoolStrategyWithPool } from "./entities/dePoolStrategy";
import { Vault } from "./entities/vault";
import { StrategyFactory } from "./entities/strategyFactory";

export const makeWithdrawToUsers = async ({
  amount,
  users,
  governance,
  vault,
}: {
  amount: string;
  users: Array<User>;
  governance: Governance;
  vault: Vault;
}) => {
  const withdrawSetup = await lastValueFrom(
    from(users).pipe(
      concatMap(user => from(user.makeWithdrawRequest(amount)).pipe(map(({ nonce }) => ({ user, nonce })))),
      toArray(),
    ),
  );

  const { transaction } = await governance.emitWithdraw({
    sendConfig: withdrawSetup.map(({ user, nonce }) => [
      locklift.utils.getRandomNonce(),
      { user: user.account.address, nonces: [nonce] },
    ]),
  });

  const withdrawSuccessEvents = await vault.getEventsAfterTransaction({
    eventName: "WithdrawSuccess",
    parentTransaction: transaction,
  });
  const withdrawErrorEvents = await vault.getEventsAfterTransaction({
    eventName: "WithdrawError",
    parentTransaction: transaction,
  });

  return {
    successEvents: withdrawSuccessEvents,
    errorEvents: withdrawErrorEvents,
  };
};

export const createAndRegisterStrategy = async ({
  governance,
  vault,
  signer,
  poolDeployValue,
  strategyDeployValue,
  strategyFactory,
}: {
  governance: Governance;
  vault: Vault;
  signer: Signer;
  poolDeployValue: string;
  strategyDeployValue: string;
  strategyFactory: StrategyFactory;
}): Promise<{ strategy: DePoolStrategyWithPool; transaction: Transaction }> => {
  zeroAddress;
  const strategy = await createStrategy({
    vaultContract: vault.vaultContract,
    signer,
    strategyDeployValue,
    poolDeployValue,
    strategyFactory,
  });

  const { transaction } = await locklift.tracing.trace(
    vault.vaultContract.methods
      .addStrategy({ _strategy: strategy.strategy.address })
      .sendExternal({ publicKey: governance.keyPair.publicKey }),
  );
  return { strategy, transaction };
};
