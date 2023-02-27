import { preparation } from "./preparation";
import { Contract, Signer, toNano } from "locklift";
import { User } from "../utils/entities/user";
import { Governance } from "../utils/entities/governance";
import { TokenRootUpgradeableAbi } from "../build/factorySource";

import { expect } from "chai";
import { Vault } from "../utils/entities/vault";
import { createStrategy, DePoolStrategyWithPool } from "../utils/entities/dePoolStrategy";
import { toNanoBn } from "../utils";
import { concatMap, from, lastValueFrom, map, range, toArray } from "rxjs";
import { StrategyFactory } from "../utils/entities/strategyFactory";
import BigNumber from "bignumber.js";
import { Cluster } from "../utils/entities/cluster";

let signer: Signer;
let admin: User;
let governance: Governance;
let user1: User;
let user2: User;
let tokenRoot: Contract<TokenRootUpgradeableAbi>;
let vault: Vault;
let strategyFactory: StrategyFactory;
const ST_EVER_FEE_PERCENT = 11;
let cluster: Cluster;
let strategies: Array<DePoolStrategyWithPool>;
describe("Clusters constraints", () => {
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
    console.log(`New vault ${vault.vaultContract.address.toString()}`);
  });
  it("Vault should be initialized", async () => {
    await vault.setStEverFeePercent({ percentFee: ST_EVER_FEE_PERCENT });
    await vault.setMinDepositToStrategyValue({ minDepositToStrategyValue: toNano(1) });
    await vault.setMinWithdrawFromStrategyValue({ minWithdrawFromStrategyValue: toNano(1) });
  });
  it("cluster should created and register three strategies", async () => {
    cluster = await Cluster.create({
      vault,
      clusterOwner: admin.account,
      assurance: toNano(10),
      maxStrategiesCount: 2,
    });
    strategies = await lastValueFrom(
      range(3).pipe(
        concatMap(() =>
          createStrategy({
            cluster,
            poolDeployValue: locklift.utils.toNano(200),
            signer,
          }),
        ),
        toArray(),
      ),
    );
    const { traceTree: addStrategyWithoutAssuranceTraceTree } = await cluster.addStrategies(
      strategies.map(s => s.strategy.address),
    );
    expect(addStrategyWithoutAssuranceTraceTree).to.error(5009);

    await admin.depositToVault(toNano(100));

    await admin.wallet.walletContract.methods
      .transfer({
        amount: toNano(10),
        deployWalletValue: 0,
        payload: "",
        notify: true,
        recipient: cluster.clusterContract.address,
        remainingGasTo: admin.account.address,
      })
      .send({
        from: admin.account.address,
        amount: toNano(2),
      });

    expect(
      (
        await locklift.tracing.trace(
          cluster.clusterContract.methods
            .setUnlockedAssuranceValue({
              _newUnlockAssurance: toNano(5),
            })
            .send({
              from: admin.account.address,
              amount: toNano(1),
            }),
        )
      ).traceTree,
    )
      .to.emit("NewUnlockedAssuranceAmount")
      .withNamedArgs({
        unlockedAssuranceAmount: toNano(5),
      });

    const { traceTree: withdrawAssuranceTraceTree } = await locklift.tracing.trace(
      cluster.clusterContract.methods
        .withdrawAssurance({
          _amount: toNano(5),
        })
        .send({
          from: admin.account.address,
          amount: toNano(1),
        }),
      { raise: false },
    );
    expect(withdrawAssuranceTraceTree!.tokens.getTokenBalanceChange(admin.wallet.walletContract.address)).to.be.eq(
      toNano(5),
    );

    expect(
      (
        await locklift.tracing.trace(
          cluster.clusterContract.methods
            .setUnlockedAssuranceValue({
              _newUnlockAssurance: toNano(5),
            })
            .send({
              from: admin.account.address,
              amount: toNano(1),
            }),
        )
      ).traceTree,
    )
      .to.emit("NewUnlockedAssuranceAmount")
      .withNamedArgs({
        unlockedAssuranceAmount: toNano(5),
      });
    const { traceTree: addOneStrategyTraceTree } = await cluster.addStrategies(
      strategies.slice(0, 2).map(el => el.strategy.address),
    );

    expect(addOneStrategyTraceTree).to.emit("StrategiesAdded");

    expect((await cluster.addStrategies([strategies.at(-1)?.strategy.address!])).traceTree).to.error(5010);
    expect((await cluster.removeStrategies([strategies.at(0)?.strategy.address!])).traceTree).to.emit(
      "StrategyRemoved",
    );

    expect((await cluster.addStrategies([strategies.at(-1)?.strategy.address!])).traceTree).to.emit("StrategiesAdded");
  });
});
