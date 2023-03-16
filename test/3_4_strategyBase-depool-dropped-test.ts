import { preparation } from "./preparation";
import { Contract, fromNano, Signer, toNano } from "locklift";
import { User } from "../utils/entities/user";
import { Governance } from "../utils/entities/governance";
import { TokenRootUpgradeableAbi } from "../build/factorySource";

import { expect } from "chai";
import { Vault } from "../utils/entities/vault";
import { createStrategy, DePoolStrategyWithPool } from "../utils/entities/dePoolStrategy";
import { getAddressEverBalance, toNanoBn } from "../utils";
import { createAndRegisterStrategy } from "../utils/highOrderUtils";
import { concatMap, from, lastValueFrom, map, mergeMap, range, switchMap, tap, timer, toArray } from "rxjs";
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
let strategy: DePoolStrategyWithPool;
let strategyFactory: StrategyFactory;
let cluster: Cluster;
const ST_EVER_FEE_PERCENT = 11;
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
    await vault.setStEverFeePercent({ percentFee: ST_EVER_FEE_PERCENT });
    await vault.setMinDepositToStrategyValue({ minDepositToStrategyValue: toNano(1) });
    await vault.setMinWithdrawFromStrategyValue({ minWithdrawFromStrategyValue: toNano(1) });
  });
  it("should cluster created", async () => {
    cluster = await Cluster.create({
      vault,
      clusterOwner: admin.account,
      assurance: toNano(0),
      maxStrategiesCount: 10,
    });
  });
  it("should strategy deployed", async () => {
    strategy = await createStrategy({
      signer,
      poolDeployValue: locklift.utils.toNano(200),
      cluster,
    });

    const { traceTree: firstTraceTree } = await cluster.addStrategies([strategy.strategy.address]);
    expect(firstTraceTree)
      .to.emit("StrategiesAdded", vault.vaultContract)
      .withNamedArgs({
        strategy: [strategy.strategy.address],
      });

    await cluster.addStrategies([strategy.strategy.address]);
    await strategy.terminateDePool(admin.account.address);
  });
  it("governance should deposit to strategies", async () => {
    const DEPOSIT_TO_STRATEGIES_AMOUNT = toNanoBn(20);
    const DEPOSIT_FEE = new BigNumber(locklift.utils.toNano(0.6));

    await user1.depositToVault(toNanoBn(140).toString());

    expect(
      (
        await governance.depositToStrategies(
          {
            _depositConfigs: [
              [
                strategy.strategy.address,
                {
                  amount: DEPOSIT_TO_STRATEGIES_AMOUNT.toString(),
                  fee: DEPOSIT_FEE.toString(),
                },
              ],
            ],
          },
          false,
        )
      ).traceTree,
    )
      .to.emit("StrategyDidntHandleDeposit")
      .withNamedArgs({
        errcode: "1",
      });

    expect(
      (
        await governance.withdrawFromStrategiesRequest(
          {
            _withdrawConfig: [
              [
                strategy.strategy.address,
                {
                  amount: DEPOSIT_TO_STRATEGIES_AMOUNT.toString(),
                  fee: DEPOSIT_FEE.toString(),
                },
              ],
            ],
          },
          false,
        )
      ).traceTree,
    )
      .to.emit("StrategyWithdrawError")
      .withNamedArgs({
        errcode: "1",
      });
    expect(
      (
        await governance.forceWithdrawFromStrategies(
          {
            _withdrawConfig: [
              [
                strategy.strategy.address,
                {
                  amount: DEPOSIT_TO_STRATEGIES_AMOUNT.toString(),
                  fee: DEPOSIT_FEE.toString(),
                },
              ],
            ],
          },
          false,
        )
      ).traceTree,
    )
      .to.emit("StrategyWithdrawError")
      .withNamedArgs({
        errcode: "1",
      });
  });
});
