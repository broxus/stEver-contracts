import { User } from "./entities/user";
import { concatMap, from, lastValueFrom, map, toArray } from "rxjs";
import { Governance } from "./entities/governance";
import { getRandomNonce, Signer, toNano, WalletTypes } from "locklift";
import { createStrategy } from "./entities/dePoolStrategy";
import { Vault } from "./entities/vault";
import { StrategyFactory } from "./entities/strategyFactory";
import { Account } from "locklift/everscale-client";

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
  debugger;
  const { transaction, traceTree } = await governance.emitWithdraw({
    sendConfig: withdrawSetup.map(({ user, nonce }) => [user.account.address, { nonces: [nonce] }]),
  });

  const withdrawSuccessEvents = traceTree?.findEventsForContract({
    contract: vault.vaultContract,
    name: "WithdrawSuccess" as const,
  });
  const withdrawErrorEvents = traceTree?.findEventsForContract({
    contract: vault.vaultContract,
    name: "WithdrawError" as const,
  })!;

  return {
    successEvents: withdrawSuccessEvents,
    errorEvents: withdrawErrorEvents,
  };
};
export const createCluster = async ({ vault }: { vault: Vault }) => {};
export const createAndRegisterStrategy = async ({
  admin,
  vault,
  signer,
  poolDeployValue,
  strategyDeployValue,
  strategyFactory,
}: {
  admin: Account;
  vault: Vault;
  signer: Signer;
  poolDeployValue: string;
  strategyDeployValue: string;
  strategyFactory: StrategyFactory;
}) => {
  const strategy = await createStrategy({
    signer,
    strategyDeployValue,
    poolDeployValue,
    strategyFactory,
  });
  const transaction = await locklift.tracing.trace(
    vault.vaultContract.methods.addStrategies({ _strategies: [strategy.strategy.address] }).send({
      from: admin.address,
      amount: toNano(2),
    }),
  );

  return { strategy, transaction };
};

export class SignerWithAccount {
  constructor(public readonly signer: Signer, public readonly account: Account) {}
  static from = ({ account, signer }: { signer: Signer; account: Account }): SignerWithAccount =>
    new SignerWithAccount(signer, account);

  static create = async ({
    signer,
    initialBalance,
  }: {
    signer: Signer;
    initialBalance: string;
  }): Promise<SignerWithAccount> => {
    return locklift.factory.accounts
      .addNewAccount({
        type: WalletTypes.EverWallet,
        nonce: getRandomNonce(),
        value: initialBalance,
        publicKey: signer.publicKey,
      })
      .then(({ account }) => new SignerWithAccount(signer, account));
  };
}
