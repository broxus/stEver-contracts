import { Address, Contract, Signer } from "locklift";
import { factorySource, StrategyBaseAbi, TokenRootAbi, VaultAbi, WalletAbi } from "../build/factorySource";
import { expect } from "chai";
import { assertEvent, getAddressBalance } from "../utils";
import { TokenWallet } from "../utils/tokenWallet";
import { User } from "../utils/user";
import { preparation } from "./preparation";
import { Governance } from "../utils/governance";
import { createStrategy, DePoolStrategyWithPool } from "../utils/dePoolStrategy";
import { makeWithdrawToUsers } from "../utils/highOrderUtils";

const TOKEN_ROOT_NAME = "StEver";
const TOKEN_ROOT_SYMBOL = "STE";
const ZERO_ADDRESS = new Address("0:0000000000000000000000000000000000000000000000000000000000000000");
let signer: Signer;
let admin: User;
let governance: Governance;
let user1: User;
let user2: User;
let tokenRoot: Contract<TokenRootAbi>;
let vaultContract: Contract<VaultAbi>;
let vaultTokenWallet: TokenWallet;
let strategiesWithPool: Array<DePoolStrategyWithPool> = [];

describe("Test Sample contract", async function () {
  before(async () => {
    const {
      vault,
      tokenRoot: tr,
      signer: s,
      users: [adminUser, _, u1, u2],
      governance: g,
    } = await preparation();
    signer = s;
    vaultContract = vault;
    admin = adminUser;
    governance = g;
    user1 = u1;
    user2 = u2;
    tokenRoot = tr;
  });

  it("Vault should be initialized", async () => {
    await locklift.tracing.trace(
      admin.account.runTarget(
        {
          contract: vaultContract,
        },
        vault =>
          vault.methods.initVault({
            _stTokenRoot: tokenRoot.address,
          }),
      ),
    );
    const details = await vaultContract.methods.getDetails({ answerId: 0 }).call({});
    vaultTokenWallet = await TokenWallet.getWallet(locklift.provider, vaultContract.address, tokenRoot);
    expect(details.value0.stEverRoot.equals(tokenRoot.address)).to.be.true;
  });
  it.skip("user should successfully deposited", async () => {
    const DEPOSIT_AMOUNT = 20;
    await user1.depositToVault(DEPOSIT_AMOUNT);
  });
  it.skip("user should successfully withdraw", async () => {
    const WITHDRAW_AMOUNT = 20;
    const withdrawEvents = await makeWithdrawToUsers({
      vaultContract,
      users: [user1],
      governance,
      amount: locklift.utils.toNano(WITHDRAW_AMOUNT),
    });
    withdrawEvents.forEach(event => {
      expect(event.data.user.equals(user1.account.address)).to.be.true;
      expect(event.data.amount).to.equal(locklift.utils.toNano(WITHDRAW_AMOUNT));
    });
  });
  it("should strategy deployed", async () => {
    const strategy = await createStrategy({ vaultContract, signer });
    strategiesWithPool.push(strategy);

    await locklift.tracing.trace(
      vaultContract.methods
        .addStrategy({ _strategy: strategy.strategy.address })
        .sendExternal({ publicKey: governance.keyPair.publicKey }),
    );
    const { events: strategyAddedEvents } = await vaultContract.getPastEvents({
      filter: ({ event }) => event === "StrategyAdded",
    });
    assertEvent(strategyAddedEvents, "StrategyAdded");
    expect(strategyAddedEvents[0].data.strategy.equals(strategy.strategy.address)).to.be.true;
  });
  it("governance should deposit to strategies", async () => {
    const DEPOSIT_TO_STRATEGIES_AMOUNT = 20;
    await user1.depositToVault(DEPOSIT_TO_STRATEGIES_AMOUNT);
    console.log(`vault balance before ${await getAddressBalance(vaultContract.address)}`);
    await governance.depositToStrategies({
      depositConfig: [
        {
          strategy: strategiesWithPool[0].strategy.address,
          amount: locklift.utils.toNano(DEPOSIT_TO_STRATEGIES_AMOUNT),
        },
      ],
    });
    console.log(`vault balance after ${await getAddressBalance(vaultContract.address)}`);
  });
  it("round should completed", async () => {
    const ROUND_REWARD = locklift.utils.toNano(2);
    await strategiesWithPool[0].emitDePoolRoundComplete(ROUND_REWARD);
    const { events } = await vaultContract.getPastEvents({ filter: ({ event }) => event === "StrategyReported" });
    assertEvent(events, "StrategyReported");

    expect(events[0].data.strategy.equals(strategiesWithPool[0].strategy.address)).to.be.true;
    expect(events[0].data.report.gain).to.be.equals(ROUND_REWARD);

    const details = await vaultContract.methods.getDetails({ answerId: 0 }).call({});
    expect(details.value0.everBalance).equals(locklift.utils.toNano(22));
    expect(details.value0.stEverSupply).equals(locklift.utils.toNano(20));
  });
  it("user should receive full deposited amount + reward", async () => {
    const res = await vaultContract.methods.getWithdrawEverAmount({ _amount: locklift.utils.toNano(20) }).call({});
    debugger;
    const WITHDRAW_AMOUNT = 20;
    const events = await makeWithdrawToUsers({
      vaultContract,
      users: [user1],
      governance,
      amount: locklift.utils.toNano(WITHDRAW_AMOUNT),
    });
    debugger;
  });
});
