import { Contract, Signer, toNano } from "locklift";
import { PoolOfChanceAbi, TokenRootUpgradeableAbi } from "../build/factorySource";
import { expect } from "chai";
import { toNanoBn } from "../utils";
import { User } from "../utils/entities/user";
import { deployPoolOfChance, deployPrizeTokenRoot, preparation } from "./preparation";
import { Governance } from "../utils/entities/governance";
import { createStrategy, DePoolStrategyWithPool } from "../utils/entities/dePoolStrategy";

import { Vault } from "../utils/entities/vault";
import { Cluster } from "../utils/entities/cluster";
import BigNumber from "bignumber.js";

let signer: Signer;
let admin: User;
let governance: Governance;
let user1: User;
let poolFeeReceiver: User;
let fund: User;
let tokenRoot: Contract<TokenRootUpgradeableAbi>;
let prizeTokenRoot: Contract<TokenRootUpgradeableAbi>;
let vault: Vault;
let strategiesWithPool: Array<DePoolStrategyWithPool> = [];
let cluster: Cluster;
let rewardPool: Contract<PoolOfChanceAbi>;
let noRewardPool: Contract<PoolOfChanceAbi>;

describe("Pool of chance", async function () {
  before(async () => {
    const {
      vault: v,
      tokenRoot: tr,
      signer: s,
      users: [adminUser, _, u1, u2, u3],
      governance: g,
    } = await preparation({ deployUserValue: locklift.utils.toNano(20000) });
    signer = s;
    vault = v;
    admin = adminUser;
    governance = g;
    user1 = u1;
    poolFeeReceiver = u2;
    fund = u3;
    tokenRoot = tr;

    prizeTokenRoot = await deployPrizeTokenRoot({ signer, owner: admin.account.address });
    rewardPool = await deployPoolOfChance({
      owner: admin.account,
      stVault: vault.vaultContract.address,
      stTokenRoot: tokenRoot.address,
      prizeTokenRoot: prizeTokenRoot.address,
      participantsAmount: 1,
      poolFeeReceiver: poolFeeReceiver.account.address,
      fund: fund.account.address,
      publicKey: signer.publicKey,
    });
    console.log("RewardPool address:", rewardPool.address.toString());

    noRewardPool = await deployPoolOfChance({
      owner: admin.account,
      stVault: vault.vaultContract.address,
      stTokenRoot: tokenRoot.address,
      prizeTokenRoot: prizeTokenRoot.address,
      participantsAmount: 2,
      poolFeeReceiver: poolFeeReceiver.account.address,
      fund: fund.account.address,
      publicKey: signer.publicKey,
    });
    console.log("NoRewardPool address:", noRewardPool.address.toString());
  });
  it("Upgrade pool", async () => {
    const { traceTree } = await locklift.tracing.trace(
      rewardPool.methods
        .upgrade({ code: locklift.factory.getContractArtifacts("PoolOfChance").code })
        .send({ from: admin.account.address, amount: toNano(2) }),
    );

    expect(traceTree).to.emit("PoolUpgraded");
  });
  it("Vault should be initialized", async () => {
    await vault.setMinDepositToStrategyValue({ minDepositToStrategyValue: toNano(1) });
    await vault.setGainFee({ ginFee: toNano(1) });
    await vault.setStEverFeePercent({ percentFee: 0 });
    cluster = await Cluster.create({
      vault,
      clusterOwner: admin.account,
      assurance: toNano(0),
      maxStrategiesCount: 10,
    });
  });
  it("should strategy deployed", async () => {
    const strategy = await createStrategy({
      signer,
      cluster,
      poolDeployValue: locklift.utils.toNano(9999999),
    });
    await cluster.addStrategies([strategy.strategy.address]);
    strategiesWithPool.push(strategy);
  });

  it("add ever reserves to pool", async () => {
    const everReserves = toNano(5000);
    const { traceTree } = await locklift.tracing.trace(
      rewardPool.methods
        .addToEverReserves({
          _amount: everReserves,
        })
        .send({ from: admin.account.address, amount: new BigNumber(everReserves).plus(toNano(2)).toString() }),
    );

    expect(traceTree).to.emit("EverReservesSync").withNamedArgs({ amount: everReserves });

    const { traceTree: noRewardTraceTree } = await locklift.tracing.trace(
      noRewardPool.methods
        .addToEverReserves({
          _amount: everReserves,
        })
        .send({ from: admin.account.address, amount: new BigNumber(everReserves).plus(toNano(2)).toString() }),
    );

    expect(noRewardTraceTree).to.emit("EverReservesSync").withNamedArgs({ amount: everReserves });
  });

  it("transfer prize tokens to pool", async () => {
    const prizeTokens = toNano(1000);
    const tokenWallet = await prizeTokenRoot.methods
      .walletOf({ answerId: 0, walletOwner: admin.account.address })
      .call()
      .then(a => locklift.factory.getDeployedContract("TokenWalletUpgradeable", a.value0));
    const { traceTree } = await locklift.tracing.trace(
      tokenWallet.methods
        .transfer({
          amount: prizeTokens,
          recipient: rewardPool.address,
          deployWalletValue: 0,
          remainingGasTo: admin.account.address,
          notify: true,
          payload: "",
        })
        .send({ from: admin.account.address, amount: toNano(2) }),
    );

    expect(traceTree).to.emit("PrizeTokenReservesSync").withNamedArgs({ amount: prizeTokens });

    await tokenWallet.methods
      .transfer({
        amount: prizeTokens,
        recipient: noRewardPool.address,
        deployWalletValue: 0,
        remainingGasTo: admin.account.address,
        notify: true,
        payload: "",
      })
      .send({ from: admin.account.address, amount: toNano(2) });
  });

  it("deposit to pool", async () => {
    const deposit = toNano(50);
    const nonce = 1234;
    const { traceTree } = await locklift.tracing.trace(
      rewardPool.methods
        .deposit({
          _amount: deposit,
          _nonce: nonce,
        })
        .send({ from: user1.account.address, amount: new BigNumber(deposit).plus(toNano(2)).toString() }),
      { allowedCodes: { compute: [60, 100] } },
    );

    expect(traceTree).to.emit("Deposit").withNamedArgs({
      user: user1.account.address,
      amount: deposit,
      stAmount: deposit,
      totalSupply: deposit,
      totalStSupply: deposit,
    });

    await noRewardPool.methods
      .deposit({
        _amount: deposit,
        _nonce: nonce,
      })
      .send({ from: user1.account.address, amount: new BigNumber(deposit).plus(toNano(2)).toString() });
  });

  it("governance should deposit to strategies", async () => {
    const DEPOSIT_TO_STRATEGIES_AMOUNT = toNanoBn(90);
    const DEPOSIT_FEE = toNanoBn(0.6);
    const { successEvents } = await governance.depositToStrategies({
      _depositConfigs: [
        [
          strategiesWithPool[0].strategy.address,
          {
            amount: DEPOSIT_TO_STRATEGIES_AMOUNT.toString(),
            fee: DEPOSIT_FEE.toString(),
          },
        ],
      ],
    });

    expect(successEvents?.length).to.be.eq(1);
  });

  it("calculate reward too soon (revert)", async () => {
    const { traceTree } = await locklift.tracing.trace(
      rewardPool.methods.calculateReward({}).send({ from: admin.account.address, amount: toNano(2) }),
      { allowedCodes: { compute: [7006] } },
    );

    expect(traceTree).to.error(7006);
  });

  it("increase time", async () => {
    const DAYLE_REWARD = 101;
    const { fullUnlockSeconds } = await vault.getDetails();

    const COUNT_OF_REPORTS = 10;
    const SECONDS_BETWEEN_REPORTS = 10;
    for (let _ of Array(COUNT_OF_REPORTS)) {
      const { traceTree } = await strategiesWithPool[0].emitDePoolRoundComplete(toNano(DAYLE_REWARD));
      await locklift.testing.increaseTime(SECONDS_BETWEEN_REPORTS);
    }

    await locklift.testing.increaseTime(Number(fullUnlockSeconds));

    await user1.depositToVault(toNano("0.01"));
    const detailsAfterFullUnlock = await vault.getDetails();
    expect(detailsAfterFullUnlock.remainingSeconds).to.be.eq("0");

    expect(Number(await vault.getWithdrawRate())).to.be.closeTo(COUNT_OF_REPORTS + 1, 0.001);
  });

  it("calculate reward for RewardPool", async () => {
    const { traceTree } = await locklift.tracing.trace(
      rewardPool.methods.calculateReward({}).send({ from: admin.account.address, amount: toNano(2) }),
    );

    expect(traceTree).to.emit("AssignReward");

    const event = traceTree?.findEventsForContract({
      contract: rewardPool,
      name: "AssignReward" as const, // 'as const' is important thing for type saving
    })[0];

    const poolFeeReceiverBalChange = traceTree?.getBalanceDiff(poolFeeReceiver.account.address);
    expect(Number(poolFeeReceiverBalChange)).approximately(Number(event!.poolFee), Number(toNano(0.0015)));

    const fundBalChange = traceTree?.getBalanceDiff(fund.account.address);
    expect(Number(fundBalChange)).approximately(Number(event!.fundFee), Number(toNano(0.0015)));

    expect(
      await rewardPool.methods
        .isPoolLocked({ answerId: 0 })
        .call()
        .then(a => a.value0),
    ).to.eq(true);
  });

  it("calculate reward for NoRewardPool", async () => {
    const { traceTree } = await locklift.tracing.trace(
      noRewardPool.methods.calculateReward({}).send({ from: admin.account.address, amount: toNano(2) }),
    );

    expect(traceTree).to.emit("CancelRewardAssignment").withNamedArgs({ depositsAmount: "1" });

    expect(
      await noRewardPool.methods
        .isPoolLocked({ answerId: 0 })
        .call()
        .then(a => a.value0),
    ).to.eq(true);
  });

  it("withdraw from RewardPool", async () => {
    const depositDataOld = await rewardPool.methods
      .getDepositData({ answerId: 0, user: user1.account.address })
      .call()
      .then(a => a.value0);
    const poolInfo = await rewardPool.methods
      .getPoolInfo({ answerId: 0 })
      .call()
      .then(a => a.value0);
    const rewardInfo = await rewardPool.methods
      .getRewardInfo({ answerId: 0 })
      .call()
      .then(a => a.value0);

    const { traceTree } = await locklift.tracing.trace(
      rewardPool.methods.withdraw({}).send({ from: user1.account.address, amount: toNano(2) }),
      { allowedCodes: { compute: [60] } },
    );

    const withdrawal = BigNumber(depositDataOld!.deposit)
      .plus(depositDataOld!.reward)
      .minus(poolInfo.withdrawFee)
      .toString();
    expect(traceTree).to.emit("Withdrawal").withNamedArgs({
      withdrawal: withdrawal,
      reward: depositDataOld!.reward,
      amount: depositDataOld!.deposit,
      user: user1.account.address,
      totalSupply: "0",
    });

    const depositDataNew = await rewardPool.methods
      .getDepositData({ answerId: 0, user: user1.account.address })
      .call()
      .then(a => a.value0);
    expect(depositDataNew).to.eq(null);

    const balanceChange = traceTree?.getBalanceDiff(user1.account.address);
    expect(Number(balanceChange)).approximately(Number(withdrawal), Number(toNano(0.5)));

    const prizeTokenBalChange = traceTree?.tokens.getTokenBalanceChange(
      await prizeTokenRoot.methods
        .walletOf({ answerId: 0, walletOwner: user1.account.address })
        .call()
        .then(a => a.value0),
    );
    expect(prizeTokenBalChange).to.eq(
      rewardInfo.prizeTokenRewardType == "1" ? depositDataOld!.reward : rewardInfo.prizeTokenRewardValue,
    );
  });

  it("withdraw from NoRewardPool", async () => {
    const depositDataOld = await noRewardPool.methods
      .getDepositData({ answerId: 0, user: user1.account.address })
      .call()
      .then(a => a.value0);
    const poolInfo = await noRewardPool.methods
      .getPoolInfo({ answerId: 0 })
      .call()
      .then(a => a.value0);
    const rewardInfo = await noRewardPool.methods
      .getRewardInfo({ answerId: 0 })
      .call()
      .then(a => a.value0);

    const { traceTree } = await locklift.tracing.trace(
      noRewardPool.methods.withdraw({}).send({ from: user1.account.address, amount: toNano(2) }),
      { allowedCodes: { compute: [60] } },
    );

    const withdrawal = BigNumber(depositDataOld!.deposit).minus(poolInfo.withdrawFee).toString();
    expect(traceTree).to.emit("Withdrawal").withNamedArgs({
      withdrawal: withdrawal,
      reward: "0",
      amount: depositDataOld!.deposit,
      user: user1.account.address,
      totalSupply: "0",
    });

    const depositDataNew = await noRewardPool.methods
      .getDepositData({ answerId: 0, user: user1.account.address })
      .call()
      .then(a => a.value0);
    expect(depositDataNew).to.eq(null);

    const balanceChange = traceTree?.getBalanceDiff(user1.account.address);
    expect(Number(balanceChange)).approximately(Number(withdrawal), Number(toNano(0.5)));

    const prizeTokenBalChange = traceTree?.tokens.getTokenBalanceChange(
      await prizeTokenRoot.methods
        .walletOf({ answerId: 0, walletOwner: user1.account.address })
        .call()
        .then(a => a.value0),
    );
    expect(prizeTokenBalChange).to.eq(rewardInfo.prizeTokenNoRewardValue);
  });

  it("withdraw stAssets", async () => {
    const poolInfo = await rewardPool.methods
      .getPoolInfo({ answerId: 0 })
      .call()
      .then(a => a.value0);

    const { traceTree } = await locklift.tracing.trace(
      rewardPool.methods.withdrawRemainingStAssets({}).send({ from: admin.account.address, amount: toNano(2) }),
      { allowedCodes: { compute: [60] } },
    );

    const stBalChange = traceTree?.tokens.getTokenBalanceChange(
      await tokenRoot.methods
        .walletOf({ answerId: 0, walletOwner: admin.account.address })
        .call()
        .then(a => a.value0),
    );
    expect(stBalChange).to.eq(poolInfo.totalStSupply);

    expect(
      await rewardPool.methods
        .getPoolInfo({ answerId: 0 })
        .call()
        .then(a => a.value0.totalStSupply),
    ).to.eq("0");
  });

  it("withdraw prizeTokenAssets", async () => {
    const poolInfo = await rewardPool.methods
      .getPoolInfo({ answerId: 0 })
      .call()
      .then(a => a.value0);

    const { traceTree } = await locklift.tracing.trace(
      rewardPool.methods.withdrawPrizeTokenAssets({}).send({ from: admin.account.address, amount: toNano(2) }),
      { allowedCodes: { compute: [60] } },
    );

    const prizeTokenBalChange = traceTree?.tokens.getTokenBalanceChange(
      await prizeTokenRoot.methods
        .walletOf({ answerId: 0, walletOwner: admin.account.address })
        .call()
        .then(a => a.value0),
    );
    expect(prizeTokenBalChange).to.eq(poolInfo.prizeTokenSupply);
    expect(traceTree).to.emit("PrizeTokenReservesSync").withNamedArgs({ amount: "0" });
  });

  it("withdraw everAssets", async () => {
    const poolInfo = await rewardPool.methods
      .getPoolInfo({ answerId: 0 })
      .call()
      .then(a => a.value0);

    const { traceTree } = await locklift.tracing.trace(
      rewardPool.methods.withdrawRemainingAssets({}).send({ from: admin.account.address, amount: toNano(2) }),
    );

    const balanceChange = traceTree?.getBalanceDiff(admin.account.address);
    expect(Number(balanceChange)).to.greaterThanOrEqual(Number(poolInfo.everReserves));
    expect(traceTree).to.emit("EverReservesSync").withNamedArgs({ amount: "0" });
  });
});
