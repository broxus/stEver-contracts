import { assertEvent } from "./index";
import { expect } from "chai";
import { User } from "./user";
import { concatMap, from, map, toArray } from "rxjs";
import { Governance } from "./governance";
import { Contract } from "locklift";
import { VaultAbi } from "../build/factorySource";

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
  assertEvent(withdrawSuccessEvents, "WithdrawSuccess");
  // withdrawSetup.forEach(({ user, nonce }, index) => {
  //   expect(withdrawSuccessEvents[index].data.user.equals(user.account.address)).to.be.true;
  //   expect(withdrawSuccessEvents[index].data.amount).to.be.equals(locklift.utils.toNano(amount));
  // });
  return withdrawSuccessEvents;
};
