import { preparation } from "./preparation";
import { Contract, Signer } from "locklift";
import { User } from "../utils/user";
import { Governance } from "../utils/governance";
import { TokenRootUpgradeableAbi } from "../build/factorySource";

import { expect } from "chai";
import { Vault } from "../utils/vault";
import { DePoolStrategyWithPool } from "../utils/dePoolStrategy";
import { assertEvent, getAddressBalance } from "../utils";
import { createAndRegisterStrategy } from "../utils/highOrderUtils";
import { concatMap, lastValueFrom, range, toArray } from "rxjs";
import _ from "lodash";
import { StrategyFactory } from "../utils/strategyFactory";

let signer: Signer;
let admin: User;
let governance: Governance;
let user1: User;
let user2: User;
let tokenRoot: Contract<TokenRootUpgradeableAbi>;
let vault: Vault;
let strategy: DePoolStrategyWithPool;
let strategyFactory: StrategyFactory;
describe.skip("Strategy base", function () {
  before(async () => {
    const {
      vault: v,
      tokenRoot: tr,
      signer: s,
      users: [adminUser, _, u1, u2],
      governance: g,
      strategyFactory: st,
    } = await preparation();
    signer = s;
    vault = v;
    admin = adminUser;
    governance = g;
    user1 = u1;
    user2 = u2;
    tokenRoot = tr;
    strategyFactory = st;
  });
  it("Vault should be initialized", async () => {
    await vault.initialize();
  });
  it("should strategy deployed", async () => {
    strategy = await createAndRegisterStrategy({
      signer,
      vault,
      governance,
      strategyDeployValue: locklift.utils.toNano(12),
      poolDeployValue: locklift.utils.toNano(200),
      strategyFactory,
    });
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
        [
          locklift.utils.getRandomNonce(),
          {
            strategy: strategy.strategy.address,
            amount: locklift.utils.toNano(DEPOSIT_TO_STRATEGIES_AMOUNT),
            fee: locklift.utils.toNano(0.6),
          },
        ],
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
    console.log(`strategy balance before ${await getAddressBalance(strategy.strategy.address)}`);
    await governance.depositToStrategies({
      depositConfig: [
        [
          locklift.utils.getRandomNonce(),
          { fee: locklift.utils.toNano(0.6), amount: locklift.utils.toNano(0.1), strategy: strategy.strategy.address },
        ],
      ],
    });
    const { events } = await vault.vaultContract.getPastEvents({
      filter: ({ event }) => event === "StrategyDidintHandleDeposit",
    });
    assertEvent(events, "StrategyDidintHandleDeposit");
    console.log(`strategy balance after ${await getAddressBalance(strategy.strategy.address)}`);
    console.log(`vault balance after ${await getAddressBalance(vault.vaultContract.address)}`);
  });
  it("should strategy request value from vault", async () => {
    const strategyWithDePool = await createAndRegisterStrategy({
      governance,
      signer,
      vault,
      strategyDeployValue: locklift.utils.toNano(4),
      poolDeployValue: locklift.utils.toNano(200),
      strategyFactory,
    });
    console.log(`strategy balance before ${await getAddressBalance(strategyWithDePool.strategy.address)}`);
    const strategyBalanceBeforeReport = await strategyWithDePool.getStrategyBalance();
    await user1.depositToVault(100);
    await governance.depositToStrategies({
      depositConfig: [
        [
          locklift.utils.getRandomNonce(),
          {
            strategy: strategyWithDePool.strategy.address,
            amount: locklift.utils.toNano(20),
            fee: locklift.utils.toNano(0.6),
          },
        ],
      ],
    });
    await strategyWithDePool.emitDePoolRoundComplete(locklift.utils.toNano(10));
    const strategyBalanceAfterReport = await strategyWithDePool.getStrategyBalance();
    expect(Number(strategyBalanceAfterReport)).to.be.above(Number(strategyBalanceBeforeReport));
  });
  it("should created and deposited to 250 strategies", async () => {
    const strategies = await lastValueFrom(
      range(2).pipe(
        concatMap(() =>
          createAndRegisterStrategy({
            signer,
            vault,
            governance,
            strategyDeployValue: locklift.utils.toNano(12),
            poolDeployValue: locklift.utils.toNano(200),
            strategyFactory,
          }),
        ),
        toArray(),
      ),
    );
    await user1.depositToVault(3000);
    console.log(`Vaults balance before ${await getAddressBalance(vault.vaultContract.address)}`);

    await governance.depositToStrategies({
      depositConfig: _.range(0, 125)
        .reduce((acc, next) => [...acc, ...strategies], [] as DePoolStrategyWithPool[])
        .map(strategy => [
          locklift.utils.getRandomNonce(),
          {
            fee: locklift.utils.toNano(0.6),
            amount: locklift.utils.toNano(2),
            strategy: strategy.strategy.address,
          },
        ]),
    });
    console.log(`Vaults balance after ${await getAddressBalance(vault.vaultContract.address)}`);
  });
});
