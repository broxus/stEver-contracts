import { preparation } from "./preparation";
import { Contract, fromNano, lockliftChai, Signer, toNano } from "locklift";
import { User } from "../utils/entities/user";
import { Governance } from "../utils/entities/governance";
import { TokenRootUpgradeableAbi } from "../build/factorySource";

import { expect } from "chai";
import { Vault } from "../utils/entities/vault";
import { concatMap, filter, from, lastValueFrom, map, mergeMap, range, toArray } from "rxjs";
import { createAndRegisterStrategy } from "../utils/highOrderUtils";
import { StrategyFactory } from "../utils/entities/strategyFactory";
import { DePoolStrategyWithPool } from "../utils/entities/dePoolStrategy";
import BigNumber from "bignumber.js";
import { isT, toNanoBn } from "../utils";
import chai from "chai";
chai.use(lockliftChai);

let signer: Signer;
let admin: User;
let governance: Governance;
let user1: User;
let user2: User;
let tokenRoot: Contract<TokenRootUpgradeableAbi>;
let vault: Vault;
let strategyFactory: StrategyFactory;
let strategies: DePoolStrategyWithPool[] = [];
describe("Emergency testing", function () {
  before(async () => {
    const {
      vault: v,
      tokenRoot: tr,
      signer: s,
      users: [adminUser, _, u1, u2],
      governance: g,
      strategyFactory: sf,
    } = await preparation({ deployUserValue: locklift.utils.toNano(2000) });
    signer = s;
    vault = v;
    admin = adminUser;
    governance = g;
    user1 = u1;
    user2 = u2;
    tokenRoot = tr;
    strategyFactory = sf;
  });
  it("Vault should be initialized", async () => {
    expect((await vault.getDetails()).stTokenRoot.equals(tokenRoot.address)).to.be.true;
    await user1.depositToVault(toNano(1100));
    const DEPOSIT_TO_STRATEGIES_AMOUNT = toNano(101);
    strategies = await lastValueFrom(
      range(3).pipe(
        mergeMap(
          () =>
            createAndRegisterStrategy({
              signer,
              vault,
              admin: admin.account,
              strategyDeployValue: locklift.utils.toNano(22),
              poolDeployValue: locklift.utils.toNano(200),
              strategyFactory,
            }),
          1,
        ),
        map(({ strategy }) => strategy),
        toArray(),
      ),
    );
    await governance.depositToStrategies({
      _depositConfigs: strategies.map(({ strategy }) => [
        strategy.address,
        {
          amount: DEPOSIT_TO_STRATEGIES_AMOUNT.toString(),
          fee: toNano(1),
        },
      ]),
    });
  });
  it("user should activate emergency", async () => {
    await lastValueFrom(
      range(3).pipe(
        concatMap(() => user1.makeWithdrawRequest(toNano(15))),
        toArray(),
      ),
    );

    const { emergencyState: emergencyBefore } = await vault.getDetails();
    const { nonce } = await user1.getWithdrawRequests().then(requests => requests[0]);
    const ATTACHED_VALUE = new BigNumber(toNano(1.3)).multipliedBy(strategies.length);

    expect(emergencyBefore.isEmergency).to.be.equals(false, "by default vault should be in initial state");
    const { traceTree } = await user1.startEmergency({
      proofNonce: Number(nonce),
      attachedValue: ATTACHED_VALUE.toString(),
    });
    expect(traceTree).to.emit("EmergencyProcessRejectedByAccount").count(1).withNamedArgs({
      emitter: user1.account.address,
      errcode: "2004",
    });

    await locklift.testing.increaseTime(60 * 60 * 169);

    const userBalanceBeforeActivatingEmergency = await locklift.provider.getBalance(user1.account.address);

    const { traceTree: successTraceTree } = await user1.startEmergency({
      proofNonce: Number(nonce),
      attachedValue: ATTACHED_VALUE.toString(),
    });
    expect(successTraceTree).to.emit("EmergencyProcessStarted").count(1).withNamedArgs({
      emitter: user1.account.address,
    });
    const balanceChange = successTraceTree!.getBalanceDiff(user1.account.address);
    const userBalanceAfterActivatingEmergency = await locklift.provider.getBalance(user1.account.address);

    const MAX_WASTED_FEE_PER_STRATEGY = toNanoBn(0.2);
    const maxWastedFee = MAX_WASTED_FEE_PER_STRATEGY.multipliedBy(strategies.length);
    // expect(new BigNumber(balanceChange)).to.be.lt(maxWastedFee.toNumber(), "user should spent less than max fee");

    console.log(await traceTree?.beautyPrint());
    console.log(balanceChange);
    console.log(`user balance ${userBalanceBeforeActivatingEmergency} -> ${userBalanceAfterActivatingEmergency}`);
    const { emergencyState: emergencyAfter } = await vault.getDetails();

    expect(emergencyAfter.isEmergency).to.be.equals(true, "state should be switched to the emergency state");
    expect(
      await vault.vaultContract.methods
        .isEmergencyProcess()
        .call()
        .then(({ value0 }) => value0),
    ).to.be.true;
    expect(emergencyAfter.emitter.equals(user1.account.address)).to.be.equals(
      true,
      "emergency state should includes correct emitter address",
    );

    const [{ transaction: roundCompleteTransaction }] = await lastValueFrom(
      from(strategies).pipe(
        concatMap(strategyWithDePool => strategyWithDePool.emitDePoolRoundComplete(toNano(10), true)),
        filter(isT),
        toArray(),
      ),
    );

    const strategyWithdrawEvents = await vault.getEventsAfterTransaction({
      eventName: "StrategyWithdrawSuccess",
      parentTransaction: roundCompleteTransaction,
    });

    expect(strategyWithdrawEvents.length).to.be.equals(
      strategies.length,
      "all strategies should received value from their dePools",
    );
  });
  it("admin should paused emergency state", async () => {
    const turnEmergencyPausedOnTx = await vault.changeEmergencyPausedState({ isPaused: true });
    const turnEmergencyPausedOnEvents = await vault.getEventsAfterTransaction({
      eventName: "EmergencyStatePaused",
      parentTransaction: turnEmergencyPausedOnTx,
    });
    expect(turnEmergencyPausedOnEvents.length).to.be.equals(1);
    const { emergencyState } = await vault.getDetails();
    expect(emergencyState.isEmergency).to.be.equals(true);
    expect(emergencyState.isPaused).to.be.equals(true);
  });
  it("user shouldn't make emergency withdraw request when emergency is paused", async () => {
    const result = await user1.emergencyWithdraw();

    expect(result.traceTree).to.have.error(1025);
  });
  it("admin should remove paused state from emergency", async () => {
    const turnEmergencyPausedOffTx = await vault.changeEmergencyPausedState({ isPaused: false });
    const turnEmergencyPausedOffEvents = await vault.getEventsAfterTransaction({
      eventName: "EmergencyStateContinued",
      parentTransaction: turnEmergencyPausedOffTx,
    });
    expect(turnEmergencyPausedOffEvents.length).to.be.equals(1);
    const { emergencyState } = await vault.getDetails();
    expect(emergencyState.isEmergency).to.be.equals(true);
    expect(emergencyState.isPaused).to.be.equals(false);
  });
  it("user should emergency withdraw his pending withdrawals", async () => {
    const emergencyWithdrawTransaction = await user1.emergencyWithdraw();
    const successWithdrawEvents = await vault.getEventsAfterTransaction({
      eventName: "WithdrawSuccess",
      parentTransaction: emergencyWithdrawTransaction,
    });
    const pendingWithdrawRequests = await user1.getWithdrawRequests();
    expect(pendingWithdrawRequests.length).to.be.equals(0, "all withdraw requests should resolved");
    expect(successWithdrawEvents.length).to.be.equals(1);
  });
  it("admin should stop emergency", async () => {
    const stopEmergencyProcessTx = await vault.stopEmergencyProcess();
    const stopEmergencyEvent = await vault.getEventsAfterTransaction({
      eventName: "EmergencyStopped",
      parentTransaction: stopEmergencyProcessTx,
    });
    expect(stopEmergencyEvent.length).to.be.equals(1);
    const { emergencyState } = await vault.getDetails();
    expect(emergencyState.isEmergency).to.be.equals(false);
  });
});
