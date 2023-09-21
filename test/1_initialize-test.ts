import { preparation } from "./preparation";
import { Contract, Signer, toNano, zeroAddress } from "locklift";
import { User } from "../utils/entities/user";
import { Governance } from "../utils/entities/governance";
import { TokenRootUpgradeableAbi } from "../build/factorySource";

import { expect } from "chai";
import { Vault } from "../utils/entities/vault";
import { Cluster } from "../utils/entities/cluster";
import BigNumber from "bignumber.js";
import { concatMap, from, lastValueFrom, mergeMap, range, toArray } from "rxjs";

let signer: Signer;
let admin: User;
let governance: Governance;
let user1: User;
let user2: User;
let tokenRoot: Contract<TokenRootUpgradeableAbi>;
let vault: Vault;
let clusters: Array<Cluster>;

describe("Initialize testing", function () {
  before(async () => {
    const s1 = await locklift.keystore.getSigner("0");
    const {
      vault: v,
      tokenRoot: tr,
      signer: s,
      users: [adminUser, _, u1, u2],
      governance: g,
    } = await preparation({ deployUserValue: locklift.utils.toNano(1_000_000) });
    signer = s;
    vault = v;
    admin = adminUser;
    governance = g;
    user1 = u1;
    user2 = u2;
    tokenRoot = tr;
  });
  it("create a cluster", async () => {
    clusters = await lastValueFrom(
      from([admin, user1, user2]).pipe(
        concatMap(user =>
          range(10).pipe(
            concatMap(() =>
              Cluster.create({
                vault,
                clusterOwner: user.account,
                assurance: toNano(0),
                maxStrategiesCount: 10,
              }),
            ),
          ),
        ),
        toArray(),
      ),
    );
  });
  it("negative test transfer governance", async () => {
    const { traceTree } = await locklift.tracing.trace(
      vault.vaultContract.methods
        .transferGovernance({
          _sendGasTo: admin.account.address,
          _newGovernance: "0",
        })
        .send({
          from: admin.account.address,
          amount: toNano(1),
        }),
      {
        allowedCodes: {
          compute: [1005],
        },
      },
    );
    expect(traceTree).to.have.error(1005);
  });
  it("test transfer governance", async () => {
    await locklift.tracing.trace(
      vault.vaultContract.methods
        .transferGovernance({
          _sendGasTo: admin.account.address,
          _newGovernance: `0x${signer.publicKey}`,
        })
        .send({
          from: admin.account.address,
          amount: toNano(1),
        }),
    );
    const governancePubKey = await vault.getDetails().then(res => res.governance);
    expect(governancePubKey).to.be.equal(new BigNumber(`0x${signer.publicKey}`).toFixed());
  });
  it("negative test transfer ownership case", async () => {
    const { traceTree } = await locklift.tracing.trace(
      vault.vaultContract.methods
        .transferOwnership({
          _sendGasTo: admin.account.address,
          _newOwner: zeroAddress,
        })
        .send({
          from: admin.account.address,
          amount: toNano(2.01),
        }),
      {
        allowedCodes: {
          compute: [1005],
        },
      },
    );
    expect(traceTree).to.have.error(1005);
  });
  it("test transfer ownership", async () => {
    const clustersInfo = await Promise.all(clusters.map(cluster => cluster.getDetails()));

    clustersInfo.forEach(clusterInfo => {
      expect(clusterInfo.stEverOwner.toString()).to.be.equal(admin.account.address.toString());
    });

    const { traceTree } = await locklift.tracing.trace(
      vault.vaultContract.methods
        .transferOwnership({
          _sendGasTo: admin.account.address,
          _newOwner: user1.account.address,
        })
        .send({
          from: admin.account.address,
          amount: toNano(2.01 * clustersInfo.length),
        }),
    );

    expect(traceTree)
      .to.call("self_setStEverOwnerForClusters")
      .count(Math.ceil(clusters.length / 25))
      .withNamedArgs({
        _sendGasTo: admin.account.address,
      });

    clusters.reduce((assertion, cluster) => {
      return assertion.and.call("setStEverOwner", cluster.clusterContract.address).withNamedArgs({
        _newStEverOwner: user1.account.address,
      });
    }, expect(traceTree));

    {
      const clustersInfo = await Promise.all(clusters.map(cluster => cluster.getDetails()));

      const vaultDetails = await vault.getDetails();
      clustersInfo.forEach(clusterInfo => {
        expect(clusterInfo.stEverOwner.toString()).to.be.equal(user1.account.address.toString());
      });
      expect(vaultDetails.owner.toString()).to.be.equal(user1.account.address.toString());
    }
    // move owner back
    await locklift.tracing.trace(
      vault.vaultContract.methods
        .transferOwnership({
          _sendGasTo: admin.account.address,
          _newOwner: admin.account.address,
        })
        .send({
          from: user1.account.address,
          amount: toNano(2.01 * 70),
        }),
    );
  });
  it("negative test set gainFee", async () => {
    const { traceTree } = await locklift.tracing.trace(
      vault.vaultContract.methods
        .setGainFee({
          _gainFee: toNano(0.1),
        })
        .send({
          from: admin.account.address,
          amount: toNano(2.01),
        }),
      {
        allowedCodes: {
          compute: [1005],
        },
      },
    );
    expect(traceTree).to.have.error(1005);
  });
  it("test set gainFee", async () => {
    const NEW_GAIN_FEES = toNano(2);
    await locklift.tracing.trace(
      vault.vaultContract.methods
        .setGainFee({
          _gainFee: NEW_GAIN_FEES,
        })
        .send({
          from: admin.account.address,
          amount: toNano(2.01),
        }),
    );
    const vaultDetails = await vault.getDetails();
    expect(vaultDetails.gainFee.toString()).to.be.equal(NEW_GAIN_FEES);
  });
  it("test setMinStrategyDepositValue", async () => {
    const NEW_MIN_STRATEGY_DEPOSIT_VALUE = toNano(28);
    await locklift.tracing.trace(
      vault.vaultContract.methods
        .setMinStrategyDepositValue({
          _minStrategyDepositValue: NEW_MIN_STRATEGY_DEPOSIT_VALUE,
        })
        .send({
          from: admin.account.address,
          amount: toNano(2.01),
        }),
    );
    const vaultDetails = await vault.getDetails();
    expect(vaultDetails.minStrategyDepositValue.toString()).to.be.equal(NEW_MIN_STRATEGY_DEPOSIT_VALUE);
  });
  it("test setMinStrategyWithdrawValue", async () => {
    const NEW_MIN_STRATEGY_WITHDRAW_VALUE = toNano(28);
    await locklift.tracing.trace(
      vault.vaultContract.methods
        .setMinStrategyWithdrawValue({
          _minStrategyWithdrawValue: NEW_MIN_STRATEGY_WITHDRAW_VALUE,
        })
        .send({
          from: admin.account.address,
          amount: toNano(2.01),
        }),
    );
    const vaultDetails = await vault.getDetails();
    expect(vaultDetails.minStrategyWithdrawValue.toString()).to.be.equal(NEW_MIN_STRATEGY_WITHDRAW_VALUE);
  });
  it("negative test setStEverFeePercent", async () => {
    const { traceTree } = await locklift.tracing.trace(
      vault.vaultContract.methods
        .setStEverFeePercent({
          _stEverFeePercent: 2000,
        })
        .send({
          from: admin.account.address,
          amount: toNano(2.01),
        }),
      {
        allowedCodes: {
          compute: [1021],
        },
      },
    );
    expect(traceTree).to.have.error(1021);
  });
  it("test setStEverFeePercent", async () => {
    const { traceTree } = await locklift.tracing.trace(
      vault.vaultContract.methods
        .setStEverFeePercent({
          _stEverFeePercent: 999,
        })
        .send({
          from: admin.account.address,
          amount: toNano(2.01),
        }),
    );

    // check new state
    const vaultDetails = await vault.getDetails();
    expect(vaultDetails.stEverFeePercent.toString()).to.be.equal("999");
  });
  it("set is paused", async () => {
    const { traceTree } = await locklift.tracing.trace(
      vault.vaultContract.methods
        .setIsPaused({
          _isPaused: true,
        })
        .send({
          from: admin.account.address,
          amount: toNano(2.01),
        }),
    );
    expect(traceTree).to.emit("PausedStateChanged").withNamedArgs({
      pauseState: true,
    });
    const details = await vault.getDetails();
    expect(details.isPaused).to.be.true;
    {
      const { traceTree } = await locklift.tracing.trace(
        vault.vaultContract.methods
          .setIsPaused({
            _isPaused: true,
          })
          .send({
            from: admin.account.address,
            amount: toNano(2.01),
          }),
      );
      expect(traceTree).not.to.emit("PausedStateChanged");
    }
  });
  it("negative test setStrategyFactory", async () => {
    const { traceTree } = await locklift.tracing.trace(
      vault.vaultContract.methods
        .setStrategyFactory({
          _strategyFactory: zeroAddress,
        })
        .send({
          from: admin.account.address,
          amount: toNano(2.01),
        }),
      {
        allowedCodes: {
          compute: [1005],
        },
      },
    );
    expect(traceTree).to.have.error(1005);
  });
  it("test setStrategyFactory", async () => {
    const { traceTree } = await locklift.tracing.trace(
      vault.vaultContract.methods
        .setStrategyFactory({
          _strategyFactory: user1.account.address,
        })
        .send({
          from: admin.account.address,
          amount: toNano(2.01),
        }),
    );
    const details = await vault.getDetails();
    expect(details.strategyFactory.equals(user1.account.address)).to.be.true;
  });

  it("test setWithdrawHoldTimeInSeconds", async () => {
    const vaultDetails = await vault.getDetails();
    const oneDay = 60 * 60 * 24;
    const newHoldTime = oneDay * 7;
    const { traceTree } = await locklift.tracing.trace(
      vault.vaultContract.methods
        .setWithdrawHoldTimeInSeconds({
          _holdTime: newHoldTime,
        })
        .send({
          from: admin.account.address,
          amount: toNano(2.01),
        }),
    );
    const newVaultDetails = await vault.getDetails();
    expect(newVaultDetails.withdrawHoldTime).to.be.equal(newHoldTime.toString());
  });

  it("negative test setFullUnlockRewardSeconds", async () => {
    const { traceTree } = await locklift.tracing.trace(
      vault.vaultContract.methods
        .setFullUnlockRewardSeconds({
          _fullUnlockSeconds: 0,
        })
        .send({
          from: admin.account.address,
          amount: toNano(2.01),
        }),
      {
        allowedCodes: {
          compute: [1005],
        },
      },
    );
    expect(traceTree).to.have.error(1005);
  });
  it("test setFullUnlockRewardSeconds", async () => {
    const newFullUnlockTime = "10";
    const { traceTree } = await locklift.tracing.trace(
      vault.vaultContract.methods
        .setFullUnlockRewardSeconds({
          _fullUnlockSeconds: newFullUnlockTime,
        })
        .send({
          from: admin.account.address,
          amount: toNano(2.01),
        }),
    );
    const details = await vault.getDetails();
    expect(details.fullUnlockSeconds).to.be.equal(newFullUnlockTime);
  });
  it("negative test setTimeAfterEmergencyCanBeActivated try to set less then 7 days", async () => {
    const oneDay = 60 * 60 * 24;

    const { traceTree } = await locklift.tracing.trace(
      vault.vaultContract.methods
        .setTimeAfterEmergencyCanBeActivated({
          _newTimeAfterEmergencyCanBeActivated: oneDay,
        })
        .send({
          from: admin.account.address,
          amount: toNano(2.01),
        }),
      {
        allowedCodes: {
          compute: [1005],
        },
      },
    );
    expect(traceTree).to.have.error(1005);
  });
  it("test setTimeAfterEmergencyCanBeActivated", async () => {
    const oneDay = 60 * 60 * 24;
    const newTimeAfterEmergencyCanBeActivated = oneDay * 7;
    const { traceTree } = await locklift.tracing.trace(
      vault.vaultContract.methods
        .setTimeAfterEmergencyCanBeActivated({
          _newTimeAfterEmergencyCanBeActivated: newTimeAfterEmergencyCanBeActivated,
        })
        .send({
          from: admin.account.address,
          amount: toNano(2.01),
        }),
    );
    const details = await vault.getDetails();
    expect(details.timeAfterEmergencyCanBeActivated).to.be.equal(newTimeAfterEmergencyCanBeActivated.toString());
  });
});
