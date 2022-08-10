import { preparation } from "./preparation";
import { Contract, Signer } from "locklift";
import { User } from "../utils/entities/user";
import { Governance } from "../utils/entities/governance";
import { TokenRootUpgradeableAbi } from "../build/factorySource";

import { expect } from "chai";
import { Vault } from "../utils/entities/vault";
import { DePoolStrategyWithPool } from "../utils/entities/dePoolStrategy";
import { assertEvent, getAddressEverBalance, toNanoBn } from "../utils";
import { createAndRegisterStrategy } from "../utils/highOrderUtils";

import { StrategyFactory } from "../utils/entities/strategyFactory";
import BigNumber from "bignumber.js";

let signer: Signer;
let admin: User;
let governance: Governance;
let user1: User;
let user2: User;
let tokenRoot: Contract<TokenRootUpgradeableAbi>;
let vault: Vault;
let strategy: DePoolStrategyWithPool;
let strategyFactory: StrategyFactory;
describe.skip("Gas calculation", function () {
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
    }).then(({ strategy }) => strategy);
    const { events: strategyAddedEvents } = await vault.vaultContract.getPastEvents({
      filter: ({ event }) => event === "StrategyAdded",
    });
    assertEvent(strategyAddedEvents, "StrategyAdded");
    expect(strategyAddedEvents[0].data.strategy.equals(strategy.strategy.address)).to.be.true;
  });
  it("governance should deposit to strategies", async () => {
    const DEPOSIT_TO_STRATEGIES_AMOUNT = toNanoBn(119.4);
    const DEPOSIT_FEE = new BigNumber(locklift.utils.toNano(0.6));

    await user1.depositToVault(toNanoBn(140).toString());

    console.log(`vault balance before ${await getAddressEverBalance(vault.vaultContract.address)}`);
    await governance.depositToStrategies({
      _depositConfigs: [
        [
          locklift.utils.getRandomNonce(),
          {
            strategy: strategy.strategy.address,
            amount: DEPOSIT_TO_STRATEGIES_AMOUNT.toString(),
            fee: DEPOSIT_FEE.toString(),
          },
        ],
      ],
    });
    console.log(await getAddressEverBalance(vault.vaultContract.address));
  });
});
