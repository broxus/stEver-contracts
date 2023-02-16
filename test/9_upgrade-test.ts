import { Contract, Signer, toNano } from "locklift";
import { User } from "../utils/entities/user";
import { Governance } from "../utils/entities/governance";
import { FactorySource, Old_StEverVaultAbi, TokenRootUpgradeableAbi } from "../build/factorySource";
import { creteVault, Vault } from "../utils/entities/vault";
import { StrategyFactory } from "../utils/entities/strategyFactory";
import { deployTokenRoot, preparation } from "./preparation";
import { GetExpectedAddressParams } from "../../ever-locklift/everscale-provider";
import { GAIN_FEE } from "../utils/constants";

let signer: Signer;
let admin: User;
let governance: Governance;
let user1: User;
let user2: User;
let user3: User;
let tokenRoot: Contract<TokenRootUpgradeableAbi>;
let oldStrategyFactory: StrategyFactory;
let oldVault: Vault;

let vault: Vault;
let strategyFactory: StrategyFactory;
describe.skip("Upgrade testing", function () {
  before(async () => {
    const {
      signer: s,
      users: [adminUser, _, u1, u2, u3],
      governance: g,
    } = await preparation({ deployUserValue: locklift.utils.toNano(2000) });
    signer = s;
    admin = adminUser;
    governance = g;
    user1 = u1;
    user2 = u2;
    user3 = u3;
  });

  it("should old stEverVault be deployed", async () => {
    const { code: platformCode } = locklift.factory.getContractArtifacts("Platform");
    const { code: accountCode } = locklift.factory.getContractArtifacts("StEverAccount");

    const { tvc, abi } = locklift.factory.getContractArtifacts("Old_StEverVault");

    const initParams = {
      nonce: locklift.utils.getRandomNonce(),
      governance: `0x${governance.keyPair.publicKey}`,
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

    oldStrategyFactory = new StrategyFactory(admin.account, factoryContact.contract, oldVault);
  });
});
