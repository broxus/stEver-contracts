import { Contract, Signer, toNano, zeroAddress } from "locklift";
import { User } from "../utils/entities/user";
import { Governance } from "../utils/entities/governance";
import { FactorySource, TokenRootUpgradeableAbi } from "../build/factorySource";
import { creteVault, Vault } from "../utils/entities/vault";
import { StrategyFactory } from "../utils/entities/strategyFactory";
import { deployTokenRoot, preparation } from "./preparation";
import { GetExpectedAddressParams } from "locklift/everscale-provider";
import { GAIN_FEE } from "../utils/constants";
import { DePoolStrategyWithPool } from "../utils/entities/dePoolStrategy";
import { expect } from "chai";
import { toNanoBn } from "../utils";

const STRATEGIES_COUNT = 49;
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
    const { code: accountCode } = locklift.factory.getContractArtifacts("OldStEverAccount");
    const { code: clusterCode } = locklift.factory.getContractArtifacts("StEverCluster");

    const { tvc, abi } = locklift.factory.getContractArtifacts("OldStEverVault");

    const initParams = {
      nonce: locklift.utils.getRandomNonce(),
      governance: `0x${governanceSigner.publicKey}`,
      platformCode,
      accountCode,
      clusterCode,
    } as const;
    const deployArgs: GetExpectedAddressParams<FactorySource["OldStEverVault"]> = {
      tvc,
      initParams,
      publicKey: signer.publicKey,
    };
    const vaultAddress = await locklift.provider.getExpectedAddress(abi, deployArgs);
    tokenRoot = await deployTokenRoot({ signer, owner: vaultAddress });
    const { contract: oldVaultContract } = await locklift.factory.deployContract({
      contract: "OldStEverVault",
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
    const { code: oldClusterCode } = locklift.factory.getContractArtifacts("OldStEverCluster");
    await oldVault.vaultContract.methods
      .setNewClusterCode({ _newClusterCode: oldClusterCode })
      .send({ from: admin.account.address, amount: toNano(1) });
    governance = new Governance(governanceSigner, oldVault);
    await user1.connectStEverVault(oldVault, "old");
    await user1.setWallet(tokenRoot);
  });
  it("should old vault be initialized", async () => {
    await oldVault.setStEverFeePercent({ percentFee: 11 });
    await oldVault.setMinDepositToStrategyValue({ minDepositToStrategyValue: toNano(1) });
  });

  it("user should deposit to old st-ever vault", async () => {
    const DEPOSIT_VALUE = toNano(DEPOSIT_TO_STRATEGY_VALUE);
    const { traceTree } = await user1.depositToVault(DEPOSIT_VALUE);
    const userStEverBalanceChange = traceTree?.tokens.getTokenBalanceChange(user1.wallet.walletContract.address);
    expect(userStEverBalanceChange).to.be.eq(DEPOSIT_VALUE);
  });

  it("user makes withdraw request", async () => {
    const { traceTree } = await user1.makeWithdrawRequest(toNano(DEPOSIT_TO_STRATEGY_VALUE));
    expect(traceTree).to.emit("WithdrawRequest");
    console.log(await user1.getWithdrawRequests());
  });
  it("StEverVault upgrade", async () => {
    //
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

    Object.entries(vaultStrategies).forEach(([, strategyState]) => {
      expect(strategyState.state).to.be.eq("0");
      expect(strategyState.cluster.equals(zeroAddress)).to.be.true;
    });

    const { code: newAccountCode } = locklift.factory.getContractArtifacts("StEverAccount");
    await newVault.setNewAccountCode(newAccountCode);

    const oldWithdrawRequests = await user1.getWithdrawRequests().then(res => res[0]);

    expect("unlockTime" in oldWithdrawRequests).to.be.false;
    console.log("start upgrade accounts");
    await user1.connectStEverVault(newVault, "new");

    await newVault.upgradeAccounts([user1.account.address]);
    expect(
      await user1.withdrawUserData.methods
        .withdrawRequests()
        .call()
        .then(res => "unlockTime" in res.withdrawRequests[0][1] && res.withdrawRequests[0][1].unlockTime),
    ).to.be.eq("0");
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
  it("clusters should be upgraded", async () => {
    const oldCluster = await newVault.createCluster({
      clusterOwner: user1.account.address,
      maxStrategiesCount: 1,
      assurance: "0",
      clusterVersion: "old",
    });
    const oldClusterDetails = await oldCluster.methods
      .getDetails({ answerId: 0 })
      .call()
      .then(res => res.value0);
    expect(oldClusterDetails.currentVersion).to.be.eq("1");
    expect(oldClusterDetails.isPunished).to.be.eq(undefined);

    const { code: newClusterCode } = locklift.factory.getContractArtifacts("StEverCluster");
    await newVault.setNewClusterCode(newClusterCode);
    const { traceTree } = await newVault.upgradeClusters([oldCluster.address]);

    const newCluster = locklift.factory.getDeployedContract("StEverCluster", oldCluster.address);
    const newDetails = await newCluster.methods
      .getDetails({ answerId: 0 })
      .call()
      .then(res => res.value0);

    expect(newDetails.currentVersion).to.be.eq("2");
    expect(newDetails.isPunished).to.be.eq(false);
  });
});
