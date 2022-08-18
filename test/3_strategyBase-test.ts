import { preparation } from "./preparation";
import { Contract, Signer } from "locklift";
import { User } from "../utils/entities/user";
import { Governance } from "../utils/entities/governance";
import { TokenRootUpgradeableAbi } from "../build/factorySource";

import { expect } from "chai";
import { Vault } from "../utils/entities/vault";
import { DePoolStrategyWithPool } from "../utils/entities/dePoolStrategy";
import { getAddressEverBalance, toNanoBn } from "../utils";
import { createAndRegisterStrategy } from "../utils/highOrderUtils";
import { concatMap, lastValueFrom, map, range, toArray } from "rxjs";
import _ from "lodash";
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
describe("Strategy base", function () {
  before(async () => {
    const {
      vault: v,
      tokenRoot: tr,
      signer: s,
      users: [adminUser, _, u1, u2],
      governance: g,
      strategyFactory: st,
    } = await preparation({ deployUserValue: locklift.utils.toNano(2000) });
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
    const transaction = await createAndRegisterStrategy({
      signer,
      vault,
      admin: admin.account,
      strategyDeployValue: locklift.utils.toNano(12),
      poolDeployValue: locklift.utils.toNano(200),
      strategyFactory,
    }).then(({ strategy: newStrategy, transaction }) => {
      strategy = newStrategy;
      return transaction;
    });

    const strategyAddedEvents = await vault.getEventsAfterTransaction({
      eventName: "StrategyAdded",
      parentTransaction: transaction,
    });
    expect(strategyAddedEvents[0].data.strategy.equals(strategy.strategy.address)).to.be.true;
  });
  it("governance should deposit to strategies", async () => {
    const DEPOSIT_TO_STRATEGIES_AMOUNT = toNanoBn(119.4);
    const DEPOSIT_FEE = new BigNumber(locklift.utils.toNano(0.6));

    await user1.depositToVault(toNanoBn(140).toString());
    const vaultStateBefore = await vault.getDetails();

    console.log(`vault balance before ${await getAddressEverBalance(vault.vaultContract.address)}`);
    const { successEvents } = await governance.depositToStrategies({
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

    expect(successEvents.length).to.be.equal(1);
    const vaultStateAfter = await vault.getDetails();

    expect(successEvents[0].data.strategy.equals(strategy.strategy.address)).to.be.true;
    expect(Number(successEvents[0].data.depositValue)).to.be.eq(DEPOSIT_TO_STRATEGIES_AMOUNT.toNumber());
    expect(vaultStateBefore.totalAssets.toNumber()).to.be.gt(
      vaultStateAfter.totalAssets.toNumber(),
      "total assets should be reduced by fee",
    );
    expect(vaultStateAfter.totalAssets.toNumber()).to.be.gt(
      vaultStateBefore.totalAssets.minus(DEPOSIT_FEE).toNumber(),
      "some fee should be returned",
    );
    expect(vaultStateBefore.availableAssets.minus(DEPOSIT_TO_STRATEGIES_AMOUNT).toNumber()).to.be.gt(
      vaultStateAfter.availableAssets.toNumber(),
      "total assets should be reduced more than deposit amount",
    );

    expect(vaultStateAfter.availableAssets.toNumber()).to.be.gt(
      vaultStateBefore.availableAssets.minus(DEPOSIT_TO_STRATEGIES_AMOUNT).minus(DEPOSIT_FEE).toNumber(),
      "some fee should be returned",
    );
    const strategyInfo = await vault.getStrategyInfo(strategy.strategy.address);
    expect(strategyInfo.totalGain).to.be.equals("0");
    expect(strategyInfo.lastReport).to.be.equals("0");
    console.log(`vault balance after ${await getAddressEverBalance(vault.vaultContract.address)}`);
  });
  it("strategy state should be changed after report", async () => {
    const ROUND_REWARD = toNanoBn(10);
    await strategy.emitDePoolRoundComplete(ROUND_REWARD.toString());
    const strategyInfoAfter = await vault.getStrategyInfo(strategy.strategy.address);
    expect(strategyInfoAfter.totalGain).to.be.equals(toNanoBn(10).toString());
  });
  it("governance shouldn't withdraw from strategy if dePool will reject request", async () => {
    await strategy.setDePoolWithdrawalState({ isClosed: true });
    const strategyInfoBefore = await vault.getStrategyInfo(strategy.strategy.address);
    const WITHDRAW_AMOUNT = toNanoBn(100);
    const { errorEvent } = await governance.withdrawFromStrategiesRequest({
      _withdrawConfig: [
        [
          locklift.utils.getRandomNonce(),
          { strategy: strategy.strategy.address, amount: WITHDRAW_AMOUNT.toString(), fee: toNanoBn(0.6).toString() },
        ],
      ],
    });
    const strategyInfoAfter = await vault.getStrategyInfo(strategy.strategy.address);
    expect(errorEvent.length).to.be.equal(1);
    expect(errorEvent[0].data.strategy.equals(strategy.strategy.address)).to.be.true;
    await strategy.setDePoolWithdrawalState({ isClosed: false });
  });
  // it("strategy state should be changed after withdraw", async () => {
  //   const strategyInfoBefore = await vault.getStrategyInfo(strategy.strategy.address);
  //   const WITHDRAW_AMOUNT = toNanoBn(100);
  //   await governance.withdrawFromStrategies({
  //     _withdrawConfig: [
  //       [
  //         locklift.utils.getRandomNonce(),
  //         { strategy: strategy.strategy.address, amount: WITHDRAW_AMOUNT.toString(), fee: toNanoBn(0.6).toString() },
  //       ],
  //     ],
  //   });
  //   const strategyInfoAfter = await vault.getStrategyInfo(strategy.strategy.address);
  //
  //   expect(new BigNumber(strategyInfoBefore.totalAssets).minus(WITHDRAW_AMOUNT).toString()).to.be.equals(
  //     strategyInfoAfter.totalAssets.toString(),
  //   );
  // });
  it("governance shouldn't deposit to strategy if dePool is closed", async () => {
    const DEPOSIT_TO_STRATEGIES_AMOUNT = toNanoBn(110);
    const DEPOSIT_FEE = toNanoBn(0.6);
    await user1.depositToVault(DEPOSIT_TO_STRATEGIES_AMOUNT.toString());

    const vaultStateBefore = await vault.getDetails();
    await strategy.setDePoolDepositsState({ isClosed: true });
    const { errorEvents } = await governance.depositToStrategies({
      _depositConfigs: [
        [
          locklift.utils.getRandomNonce(),
          {
            fee: DEPOSIT_FEE.toString(),
            amount: DEPOSIT_TO_STRATEGIES_AMOUNT.toString(),
            strategy: strategy.strategy.address,
          },
        ],
      ],
    });

    const vaultStateAfter = await vault.getDetails();
    expect(errorEvents.length).to.be.equal(1);
    expect(vaultStateAfter.availableAssets.toNumber()).to.be.gt(
      vaultStateBefore.availableAssets.minus(DEPOSIT_FEE).toNumber(),
      "some fee should be returned to vault, also full deposit amount should be returned",
    );

    await strategy.setDePoolDepositsState({ isClosed: false });
  });
  it("should strategy request value from vault", async () => {
    const { strategy: strategyWithDePool } = await createAndRegisterStrategy({
      admin: admin.account,
      signer,
      vault,
      strategyDeployValue: locklift.utils.toNano(4),
      poolDeployValue: locklift.utils.toNano(200),
      strategyFactory,
    });
    const strategyBalanceBeforeReport = await strategyWithDePool.getStrategyBalance();
    await user1.depositToVault(locklift.utils.toNano(100));
    await governance.depositToStrategies({
      _depositConfigs: [
        [
          locklift.utils.getRandomNonce(),
          {
            strategy: strategyWithDePool.strategy.address,
            amount: locklift.utils.toNano(100),
            fee: locklift.utils.toNano(0.6),
          },
        ],
      ],
    });
    await strategyWithDePool.emitDePoolRoundComplete(locklift.utils.toNano(10));
    const strategyBalanceAfterReport = await strategyWithDePool.getStrategyBalance();
    expect(Number(strategyBalanceAfterReport)).to.be.above(
      Number(strategyBalanceBeforeReport),
      "strategy balance should be increased",
    );
  });
  it.skip("should validate deposit request", async () => {
    const result = await vault.vaultContract.methods
      .validateDepositRequest({
        _depositConfigs: _.range(0, 120).map(() => [
          locklift.utils.getRandomNonce(),
          {
            strategy: strategy.strategy.address,
            amount: locklift.utils.toNano(90),
            fee: locklift.utils.toNano(0.6),
          },
        ]),
      })
      .call();
    expect(result.value0.length).to.be.equals(120);
  });
  it.skip("should created and deposited to 110 strategies", async () => {
    const strategies = await lastValueFrom(
      range(2).pipe(
        concatMap(() =>
          createAndRegisterStrategy({
            signer,
            vault,
            admin: admin.account,
            strategyDeployValue: locklift.utils.toNano(12),
            poolDeployValue: locklift.utils.toNano(200),
            strategyFactory,
          }),
        ),
        map(({ strategy }) => strategy),
        toArray(),
      ),
    );
    await user1.depositToVault(locklift.utils.toNano(3000));
    console.log(`Vault balance before ${await getAddressEverBalance(vault.vaultContract.address)}`);

    await governance.depositToStrategies({
      _depositConfigs: _.range(0, 55)
        .reduce(acc => [...acc, ...strategies], [] as DePoolStrategyWithPool[])
        .map(strategy => [
          locklift.utils.getRandomNonce(),
          {
            fee: locklift.utils.toNano(0.6),
            amount: locklift.utils.toNano(2),
            strategy: strategy.strategy.address,
          },
        ]),
    });
    console.log(`Vault balance after ${await getAddressEverBalance(vault.vaultContract.address)}`);
  });
});
