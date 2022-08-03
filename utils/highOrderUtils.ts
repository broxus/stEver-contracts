import { assertEvent } from "./index";
import { expect } from "chai";
import { User } from "./user";
import { concatMap, from, map, toArray } from "rxjs";
import { Governance } from "./governance";
import { Contract, Signer } from "locklift";
import { VaultAbi } from "../build/factorySource";
import { createStrategy, DePoolStrategyWithPool } from "./dePoolStrategy";
import { Vault } from "./vault";

export const makeWithdrawToUsers = async ({
  amount,
  users,
  governance,
  vaultContract,
}: {
  amount: string;
  users: Array<User>;
  governance: Governance;
  vaultContract: Contract<VaultAbi>;
}) => {
  const withdrawSetup = (await from(users)
    .pipe(
      concatMap(user => from(user.makeWithdrawRequest(amount)).pipe(map(({ nonce }) => ({ user, nonce })))),
      toArray(),
    )
    .toPromise())!;

  await governance.emitWithdraw({
    sendConfig: withdrawSetup.map(({ user, nonce }) => ({ user: user.account.address, nonces: [nonce] })),
  });

  const { events: withdrawSuccessEvents } = await vaultContract.getPastEvents({
    filter: event => event.event === "WithdrawSuccess",
  });
  const { events: withdrawErrorEvents } = await vaultContract.getPastEvents({
    filter: event => event.event === "WithdrawError",
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
}: {
  governance: Governance;
  vault: Vault;
  signer: Signer;
}): Promise<DePoolStrategyWithPool> => {
  const strategy = await createStrategy({ vaultContract: vault.vaultContract, signer });

  await locklift.tracing.trace(
    vault.vaultContract.methods
      .addStrategy({ _strategy: strategy.strategy.address })
      .sendExternal({ publicKey: governance.keyPair.publicKey }),
  );
  return strategy;
};
