import { Address, Contract, Signer } from "locklift";
import { TokenRootUpgradeableAbi } from "../build/factorySource";
import { expect } from "chai";
import { assertEvent, getAddressBalance } from "../utils";
import { User } from "../utils/user";
import { preparation } from "./preparation";
import { Governance } from "../utils/governance";
import { createStrategy, DePoolStrategyWithPool } from "../utils/dePoolStrategy";
import { createAndRegisterStrategy, makeWithdrawToUsers } from "../utils/highOrderUtils";
import { Vault } from "../utils/vault";
import BigNumber from "bignumber.js";

const TOKEN_ROOT_NAME = "StEver";
const TOKEN_ROOT_SYMBOL = "STE";
const ZERO_ADDRESS = new Address("0:0000000000000000000000000000000000000000000000000000000000000000");
let signer: Signer;
let admin: User;
let governance: Governance;
let user1: User;
let user2: User;
let tokenRoot: Contract<TokenRootUpgradeableAbi>;
let vault: Vault;
let strategiesWithPool: Array<DePoolStrategyWithPool> = [];

describe("Single flow", async function () {
  before(async () => {
    const {
      vault: v,
      tokenRoot: tr,
      signer: s,
      users: [adminUser, _, u1, u2],
      governance: g,
    } = await preparation();
    signer = s;
    vault = v;
    admin = adminUser;
    governance = g;
    user1 = u1;
    user2 = u2;
    tokenRoot = tr;
  });
  it("Vault should be initialized", async () => {
    await vault.initialize();
  });
  it("should strategy deployed", async () => {
    strategiesWithPool.push(await createAndRegisterStrategy({ governance, vault, signer }));
  });
  it("user should deposit to vault", async () => {
    const DEPOSIT_TO_STRATEGIES_AMOUNT = 20;
    await user1.depositToVault(DEPOSIT_TO_STRATEGIES_AMOUNT);
  });
  it("governance should deposit to strategies", async () => {
    const DEPOSIT_TO_STRATEGIES_AMOUNT = 20;
    console.log(`vault balance before ${await getAddressBalance(vault.vaultContract.address)}`);
    await governance.depositToStrategies({
      depositConfig: [
        {
          strategy: strategiesWithPool[0].strategy.address,
          amount: locklift.utils.toNano(DEPOSIT_TO_STRATEGIES_AMOUNT),
        },
      ],
    });
    console.log(`vault balance after ${await getAddressBalance(vault.vaultContract.address)}`);
  });
  it("round should completed", async () => {
    const ROUND_REWARD = locklift.utils.toNano(2);
    await strategiesWithPool[0].emitDePoolRoundComplete(ROUND_REWARD);
    const { events } = await vault.vaultContract.getPastEvents({ filter: ({ event }) => event === "StrategyReported" });
    assertEvent(events, "StrategyReported");

    expect(events[0].data.strategy.equals(strategiesWithPool[0].strategy.address)).to.be.true;
    expect(events[0].data.report.gain).to.be.equals(ROUND_REWARD);

    const details = await vault.vaultContract.methods.getDetails({ answerId: 0 }).call({});
    expect(details.value0.everBalance).equals(locklift.utils.toNano(22));
    expect(details.value0.stEverSupply).equals(locklift.utils.toNano(20));
  });
  it("user shouldn't receive because harvest from strategy have not evaluated yet, so reset pending withdraw request to the user", async () => {
    const WITHDRAW_AMOUNT = 10;

    const { errorEvents } = await makeWithdrawToUsers({
      vaultContract: vault.vaultContract,
      users: [user1],
      governance,
      amount: locklift.utils.toNano(WITHDRAW_AMOUNT),
    });
    assertEvent(errorEvents, "WithdrawError");
    expect(errorEvents[0].data.user.equals(user1.account.address)).to.be.true;
    expect(errorEvents[0].data.amount).to.equal(locklift.utils.toNano(WITHDRAW_AMOUNT));

    const { amount, nonce } = (await user1.getWithdrawRequests())[0];
    expect(nonce).to.be.equals(errorEvents[0].data.nonce);
    expect(amount).to.be.equals(locklift.utils.toNano(WITHDRAW_AMOUNT));
  });
  it("should successfully withdraw from strategy", async () => {
    const WITHDRAW_AMOUNT = 15;
    const {
      value0: { availableEverBalance: availableBalanceBefore },
    } = await vault.vaultContract.methods.getDetails({ answerId: 0 }).call({});
    expect(availableBalanceBefore).to.be.equals(locklift.utils.toNano(0));
    const withdrawSuccessEvents = await governance.withdrawFromStrategies({
      withdrawConfig: [
        {
          strategy: strategiesWithPool[0].strategy.address,
          amount: locklift.utils.toNano(WITHDRAW_AMOUNT),
          fee: locklift.utils.toNano(0.1),
        },
      ],
    });
    const {
      value0: { availableEverBalance: availableBalanceAfter },
    } = await vault.vaultContract.methods.getDetails({ answerId: 0 }).call({});
    expect(Number(availableBalanceAfter)).to.be.gt(Number(availableBalanceBefore));
  });
  it("user should receive requested amount + reward", async () => {
    const userBalanceBefore = await getAddressBalance(user1.account.address);
    console.log(`user balance before ${userBalanceBefore}`);
    const { value0: stateBeforeWithdraw } = await vault.vaultContract.methods.getDetails({ answerId: 0 }).call({});
    const withdrawalRate = new BigNumber(stateBeforeWithdraw.everBalance).dividedBy(stateBeforeWithdraw.stEverSupply);

    const { nonce, amount: withdrawAmount } = (await user1.getWithdrawRequests())[0];
    await governance.emitWithdraw({
      sendConfig: [{ user: user1.account.address, nonces: [nonce] }],
    });
    const { events: success } = await vault.vaultContract.getPastEvents({
      filter: ({ event }) => event === "WithdrawSuccess",
    });
    assertEvent(success, "WithdrawSuccess");
    const { value0: stateAfterWithdraw } = await vault.vaultContract.methods.getDetails({ answerId: 0 }).call({});
    expect(success[0].data.user.equals(user1.account.address)).to.be.true;
    expect(success[0].data.amount).to.equal(withdrawalRate.multipliedBy(withdrawAmount).toString());

    expect(
      new BigNumber(stateBeforeWithdraw.everBalance).minus(withdrawalRate.multipliedBy(withdrawAmount)).toString(),
    ).to.be.equals(stateAfterWithdraw.everBalance);

    expect(new BigNumber(stateBeforeWithdraw.everBalance).minus(success[0].data.amount).toString()).to.be.equals(
      stateAfterWithdraw.everBalance,
    );

    expect(new BigNumber(stateBeforeWithdraw.stEverSupply).minus(withdrawAmount).toString()).to.be.equals(
      stateAfterWithdraw.stEverSupply,
    );

    const userBalanceAfter = await getAddressBalance(user1.account.address);
    console.log(`user balance after ${userBalanceAfter}`);
  });
});
