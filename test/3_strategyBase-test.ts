import { preparation } from "./preparation";
import { Contract, Signer } from "locklift";
import { User } from "../utils/user";
import { Governance } from "../utils/governance";
import { TokenRootUpgradeableAbi } from "../build/factorySource";
import { TokenWallet } from "../utils/tokenWallet";

import { expect } from "chai";
import { Vault } from "../utils/vault";
import { createStrategy, DePoolStrategyWithPool } from "../utils/dePoolStrategy";
import { assertEvent, getAddressBalance } from "../utils";
import { createAndRegisterStrategy } from "../utils/highOrderUtils";

let signer: Signer;
let admin: User;
let governance: Governance;
let user1: User;
let user2: User;
let tokenRoot: Contract<TokenRootUpgradeableAbi>;
let vault: Vault;
let strategy: DePoolStrategyWithPool;
describe("Strategy base", function () {
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
    strategy = await createAndRegisterStrategy({ signer, vault, governance });
    const { events: strategyAddedEvents } = await vault.vaultContract.getPastEvents({
      filter: ({ event }) => event === "StrategyAdded",
    });
    assertEvent(strategyAddedEvents, "StrategyAdded");
    expect(strategyAddedEvents[0].data.strategy.equals(strategy.strategy.address)).to.be.true;
  });
  it("governance should deposit to strategies", async () => {
    const DEPOSIT_TO_STRATEGIES_AMOUNT = 20;
    await user1.depositToVault(DEPOSIT_TO_STRATEGIES_AMOUNT);
    console.log(`vault balance before ${await getAddressBalance(vault.vaultContract.address)}`);
    await governance.depositToStrategies({
      depositConfig: [
        {
          strategy: strategy.strategy.address,
          amount: locklift.utils.toNano(DEPOSIT_TO_STRATEGIES_AMOUNT),
        },
      ],
    });
    const { events } = await vault.vaultContract.getPastEvents({
      filter: ({ event }) => event === "StrategyHandledDeposit",
    });
    assertEvent(events, "StrategyHandledDeposit");
    expect(events[0].data.strategy.equals(strategy.strategy.address)).to.be.true;
    expect(Number(events[0].data.returnedFee)).to.be.above(0);
    console.log(`Returned strategy fee is ${locklift.utils.fromNano(events[0].data.returnedFee)}`);
    console.log(`vault balance after ${await getAddressBalance(vault.vaultContract.address)}`);
  });
  it("governance shouldn't deposit to strategy with low value", async () => {
    const DEPOSIT_TO_STRATEGIES_AMOUNT = 20;
    await user1.depositToVault(DEPOSIT_TO_STRATEGIES_AMOUNT);

    console.log(`vault balance before ${await getAddressBalance(vault.vaultContract.address)}`);
    await governance.depositToStrategies({
      depositConfig: [
        {
          strategy: strategy.strategy.address,
          amount: locklift.utils.toNano(0.1),
        },
      ],
    });
    const { events } = await vault.vaultContract.getPastEvents({
      filter: ({ event }) => event === "StrategyDidintHandleDeposit",
    });
    assertEvent(events, "StrategyDidintHandleDeposit");
    console.log(`vault balance after ${await getAddressBalance(vault.vaultContract.address)}`);
  });
});
