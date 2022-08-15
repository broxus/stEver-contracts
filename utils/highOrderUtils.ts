import { User } from "./entities/user";
import { concatMap, from, lastValueFrom, map, toArray } from "rxjs";
import { Governance } from "./entities/governance";
import { Signer, Transaction } from "locklift";
import { createStrategy, DePoolStrategyWithPool } from "./entities/dePoolStrategy";
import { Vault } from "./entities/vault";
import { StrategyFactory } from "./entities/strategyFactory";
import { Account } from "locklift/build/factory";
import { WalletAbi } from "../build/factorySource";

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
  admin,
  vault,
  signer,
  poolDeployValue,
  strategyDeployValue,
  strategyFactory,
}: {
  admin: Account<WalletAbi>;
  vault: Vault;
  signer: Signer;
  poolDeployValue: string;
  strategyDeployValue: string;
  strategyFactory: StrategyFactory;
}): Promise<{ strategy: DePoolStrategyWithPool; transaction: Transaction }> => {
  const strategy = await createStrategy({
    vaultContract: vault.vaultContract,
    signer,
    strategyDeployValue,
    poolDeployValue,
    strategyFactory,
  });
  const { transaction } = await locklift.tracing.trace(
    admin.runTarget(
      {
        contract: vault.vaultContract,
        value: locklift.utils.toNano(2),
      },
      vault => vault.methods.addStrategy({ _strategy: strategy.strategy.address }),
    ),
  );

  return { strategy, transaction };
};
