import { Contract, Signer, toNano, zeroAddress } from "locklift";
import { User } from "../utils/entities/user";
import { Governance } from "../utils/entities/governance";
import { FactorySource, Old_StEverVaultAbi, TokenRootUpgradeableAbi } from "../build/factorySource";
import { creteVault, Vault } from "../utils/entities/vault";
import { StrategyFactory } from "../utils/entities/strategyFactory";
import { deployTokenRoot, preparation } from "./preparation";
import { GetExpectedAddressParams } from "../../ever-locklift/everscale-provider";
import { GAIN_FEE } from "../utils/constants";
import { concatMap, from, lastValueFrom, map, range, toArray } from "rxjs";
import { createStrategy, DePoolStrategyWithPool } from "../utils/entities/dePoolStrategy";
import { expect } from "chai";
import { toNanoBn } from "../utils";
import { Cluster } from "../utils/entities/cluster";

const STRATEGIES_COUNT = 2;
const DEPOSIT_TO_STRATEGY_VALUE = 120;
const DEPOSIT_FEE = toNanoBn(0.6);
let signer: Signer;
let admin: User;
let governance: Governance;
let user1: User;
let user2: User;
let user3: User;
let tokenRoot: Contract<TokenRootUpgradeableAbi>;

let strategyFactory: StrategyFactory;
let oldVault: Vault;
let governanceSigner: Signer;
let newVault: Vault;

let strategies: Array<DePoolStrategyWithPool>;
describe("Upgrade testing", function () {
  before(async () => {
    const {
      signer: s,
      governanceSigner: g,
      users: [adminUser, _, u1, u2, u3],
    } = await preparation({
      deployUserValue: locklift.utils.toNano(STRATEGIES_COUNT * DEPOSIT_TO_STRATEGY_VALUE + 500),
    });
    signer = s;
    admin = adminUser;
    user1 = u1;
    user2 = u2;
    user3 = u3;
    governanceSigner = g;
  });

  it("should old stEverVault be deployed", async () => {
    const { code: platformCode } = locklift.factory.getContractArtifacts("Platform");
    const { code: accountCode } = locklift.factory.getContractArtifacts("StEverAccount");

    const { tvc, abi } = locklift.factory.getContractArtifacts("Old_StEverVault");

    const initParams = {
      nonce: locklift.utils.getRandomNonce(),
      governance: `0x${governanceSigner.publicKey}`,
      platformCode,
      accountCode,
    };
    const deployArgs: GetExpectedAddressParams<FactorySource["Old_StEverVault"]> = {
      tvc,
      initParams,
      publicKey: signer.publicKey,
    };
    const vaultAddress = await locklift.provider.getExpectedAddress(abi, deployArgs);
    tokenRoot = await deployTokenRoot({ signer, owner: vaultAddress });
    const { contract: oldVaultContract } = await locklift.factory.deployContract({
      contract: "Old_StEverVault",
      value: toNano(10),
      constructorParams: {
        _owner: admin.account.address,
        _gainFee: GAIN_FEE,
        _stTokenRoot: tokenRoot.address,
        _stEverFeePercent: 100,
      },
      initParams,
      publicKey: signer.publicKey,
    });

    oldVault = await creteVault({
      adminAccount: admin.account,
      tokenRootContract: tokenRoot,
      // @ts-ignore
      vaultContract: oldVaultContract,
    });

    const dePoolStrategyCode = locklift.factory.getContractArtifacts("StrategyDePool");
    const factoryContact = await locklift.factory.deployContract({
      contract: "Old_DepoolStrategyFactory",
      value: locklift.utils.toNano(2),
      publicKey: signer.publicKey,
      initParams: {
        stEverVault: vaultAddress,
        nonce: locklift.utils.getRandomNonce(),
        dePoolStrategyCode: dePoolStrategyCode.code,
      },
      constructorParams: {
        _owner: admin.account.address,
      },
    });
    governance = new Governance(governanceSigner, oldVault);
    strategyFactory = new StrategyFactory(admin.account, factoryContact.contract, oldVault);
    await user1.connectStEverVault(oldVault);
    await user1.setWallet(tokenRoot);
  });
  it("should old vault be initialized", async () => {
    await oldVault.setStEverFeePercent({ percentFee: 11 });
    await oldVault.setMinDepositToStrategyValue({ minDepositToStrategyValue: toNano(1) });
  });
  it("should deployed and register 40 strategies", async () => {
    const POLL_DEPLOY_VALUE = toNano(100);
    strategies = await lastValueFrom(
      range(STRATEGIES_COUNT).pipe(
        concatMap(() =>
          locklift.factory.deployContract({
            contract: "TestDepool",
            value: POLL_DEPLOY_VALUE,
            constructorParams: {},
            publicKey: signer.publicKey,
            initParams: {
              nonce: locklift.utils.getRandomNonce(),
            },
          }),
        ),
        concatMap(({ contract: dePool }) =>
          from(strategyFactory.deployStrategy({ dePool: dePool.address, deployValue: toNano(21) })).pipe(
            map(
              strategy =>
                new DePoolStrategyWithPool(
                  dePool,
                  locklift.factory.getDeployedContract("StrategyDePool", strategy),
                  signer,
                ),
            ),
          ),
        ),
        toArray(),
      ),
    );
    const { traceTree } = await locklift.tracing.trace(
      oldVault.vaultContract.methods
        // @ts-ignore
        .addStrategies({
          _strategies: strategies.map(el => el.strategy.address),
        })
        .send({
          from: admin.account.address,
          amount: toNano(40),
        }),
    );
    expect(traceTree).to.emit("StrategiesAdded");
  });
  it("user should deposit to old st-ever vault", async () => {
    const DEPOSIT_VALUE = toNano(strategies.length * (DEPOSIT_TO_STRATEGY_VALUE + 10));
    const { traceTree } = await user1.depositToVault(DEPOSIT_VALUE);
    const userStEverBalanceChange = traceTree?.tokens.getTokenBalanceChange(user1.wallet.walletContract.address);
    expect(userStEverBalanceChange).to.be.eq(DEPOSIT_VALUE);
  });
  it("governance going to deposit to strategies", async () => {
    const { traceTree: depositToStrategyTraceTree } = await governance.depositToStrategies({
      _depositConfigs: strategies.map(({ strategy }) => [
        strategy.address,
        {
          fee: DEPOSIT_FEE.toString(),
          amount: toNano(DEPOSIT_TO_STRATEGY_VALUE),
        },
      ]),
    });
    expect(depositToStrategyTraceTree).to.emit("StrategyHandledDeposit").count(strategies.length);
  });
  it("user makes withdraw request", async () => {
    const { traceTree } = await user1.makeWithdrawRequest(toNano(strategies.length * DEPOSIT_TO_STRATEGY_VALUE));
    expect(traceTree).to.emit("WithdrawRequest");
    console.log(await user1.getWithdrawRequests());
  });
  it("StEverVault upgrade", async () => {
    const { stEverVaultVersion } = await oldVault.getDetails();
    expect(stEverVaultVersion).to.be.eq("0");
    const { code: newStEverCode } = locklift.factory.getContractArtifacts("StEverVault");

    await locklift.tracing.trace(
      oldVault.vaultContract.methods
        .upgrade({
          _newVersion: 1,
          _newCode: newStEverCode,
          _sendGasTo: admin.account.address,
        })
        .send({
          from: admin.account.address,
          amount: toNano(2),
        }),
    );
    newVault = await creteVault({
      adminAccount: admin.account,
      vaultContract: locklift.factory.getDeployedContract("StEverVault", oldVault.vaultContract.address),
      tokenRootContract: tokenRoot,
    });
    const { stEverVaultVersion: newVaultVersion } = await newVault.getDetails();

    expect(newVaultVersion).to.be.eq("1");

    const vaultStrategies = await newVault.getStrategiesInfo();

    strategies.forEach(({ strategy }) => {
      const strategyInfo = vaultStrategies[strategy.address.toString()];
      expect(strategyInfo.state).to.be.eq("0");
      expect(strategyInfo.cluster.equals(zeroAddress)).to.be.true;
    });
    await newVault.vaultContract.methods
      .setStrategyFactory({
        _strategyFactory: strategyFactory.factoryContract.address,
      })
      .send({
        from: admin.account.address,
        amount: toNano(1),
      });
    const { code: clusterCode } = locklift.factory.getContractArtifacts("StEverCluster");
    await newVault.vaultContract.methods
      .setNewClusterCode({
        _newClusterCode: clusterCode,
      })
      .send({
        from: admin.account.address,
        amount: toNano(1),
      });
    await user1.connectStEverVault(newVault);
  });
  it("strategy factory upgrade", async () => {
    describe("strategy factory upgrade", () => {
      it("factory should be upgraded", async () => {
        const { code: newStrategyFactoryCode } = locklift.factory.getContractArtifacts("DepoolStrategyFactory");
        await strategyFactory.factoryContract.methods
          .upgrade({
            _newVersion: 1,
            _newCode: newStrategyFactoryCode,
            _sendGasTo: admin.account.address,
          })
          .send({
            from: admin.account.address,
            amount: toNano(1),
          });
      });
      it("All existed strategies should be upgraded", async () => {
        const { code: newStrategyCode } = locklift.factory.getContractArtifacts("StrategyDePool");
        const { traceTree } = await strategyFactory.installNewStrategyCode(newStrategyCode);
        expect(traceTree).to.emit("StrategyCodeUpdated").withNamedArgs({
          prevStrategyVersion: "0",
          newStrategyVersion: "1",
        });
        const { traceTree: upgradeStrategiesTraceTree } = await strategyFactory.upgradeStrategies(
          strategies.map(el => el.strategy.address),
        );
        expect(upgradeStrategiesTraceTree).to.call("upgrade").count(strategies.length);
      });
    });
  });
  it("Migrate strategies", async () => {
    describe("Migration to clusters", () => {
      let cluster: Cluster;
      it("admin deploys cluster", async () => {
        cluster = await Cluster.create({
          vault: newVault,
          assurance: toNano(0),
          maxStrategiesCount: STRATEGIES_COUNT,
          clusterOwner: admin.account,
        });
      });
      it("admin shouldn't delegate strategies to the new cluster with bad msg.value", async () => {
        const { traceTree: badDelegationTraceTree } = await newVault.delegateStrategies(
          strategies.map(el => el.strategy.address),
          cluster.clusterContract.address,
          toNano(1),
        );
        expect(badDelegationTraceTree).to.error(1004);
      });
      it("admin should delegate all strategies to the new cluster", async () => {
        const { traceTree } = await newVault.delegateStrategies(
          strategies.map(el => el.strategy.address),
          cluster.clusterContract.address,
          toNano(strategies.length * 2),
        );
        expect(traceTree).to.emit("ClusterHandledStrategiesDelegation").withNamedArgs({
          cluster: cluster.clusterContract.address,
          clusterOwner: admin.account.address,
          clusterNonce: "0",
        });
      });
    });
  });
  it("governance withdraws from strategies", async () => {
    const { traceTree } = await governance.withdrawFromStrategiesRequest({
      _withdrawConfig: strategies.map(({ strategy }) => [
        strategy.address,
        {
          fee: DEPOSIT_FEE.toString(),
          amount: toNano(DEPOSIT_TO_STRATEGY_VALUE),
        },
      ]),
    });
    expect(traceTree).to.emit("StrategyHandledWithdrawRequest").count(strategies.length);
    const roundsCompletesTransactions = await lastValueFrom(
      from(strategies).pipe(
        concatMap(strategy =>
          from(strategy.emitDePoolRoundComplete(toNano(1), true)).pipe(
            map(({ traceTree }) => ({ traceTree, strategy })),
          ),
        ),
        toArray(),
      ),
    );
    roundsCompletesTransactions.forEach(({ traceTree, strategy }) => {
      expect(traceTree).to.emit("StrategyWithdrawSuccess").withNamedArgs({
        strategy: strategy.strategy.address,
      });
    });
  });
  it("Governance emits withdraw to user", async () => {
    const withdrawRequests = await user1.getWithdrawRequests();
    const { traceTree } = await governance.emitWithdraw({
      sendConfig: [[user1.account.address, { nonces: [withdrawRequests[0].nonce] }]],
    });
    expect(traceTree).to.emit("WithdrawSuccess").withNamedArgs({
      user: user1.account.address,
    });
  });
  it("Create new Cluster", () => {
    describe("Create new Cluster", () => {
      let cluster: Cluster;
      let strategy: DePoolStrategyWithPool;

      it("Admin creates new clusters", async () => {
        cluster = await Cluster.create({
          vault: newVault,
          clusterOwner: user1.account,
          assurance: toNano(0),
          maxStrategiesCount: 10,
        });
        strategy = await createStrategy({
          signer,
          cluster,
          poolDeployValue: toNano(40),
        });
      });
      it("user1 register strategy", async () => {
        const { traceTree } = await cluster.addStrategies([strategy.strategy.address]);
        expect(traceTree)
          .to.emit("StrategiesAdded")
          .withNamedArgs({
            strategy: [strategy.strategy.address],
          });
      });
      it("cluster should be upgraded", async () => {
        const { code } = locklift.factory.getContractArtifacts("StEverCluster");
        const { traceTree } = await locklift.tracing.trace(
          newVault.vaultContract.methods
            .setNewClusterCode({
              _newClusterCode: code,
            })
            .send({
              from: admin.account.address,
              amount: toNano(2),
            }),
        );
        expect(traceTree).to.emit("NewClusterCodeSet").withNamedArgs({
          newVersion: "2",
        });
        const { traceTree: upgradeClusterTraceTree } = await locklift.tracing.trace(
          newVault.vaultContract.methods
            .upgradeStEverCluster({
              _clusterNonce: "0",
            })
            .send({
              from: user1.account.address,
              amount: toNano(2),
            }),
        );
      });
    });
  });
});
