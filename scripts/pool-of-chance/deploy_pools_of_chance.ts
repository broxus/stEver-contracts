import { Contract, getRandomNonce, toNano, WalletTypes } from "locklift";
import { isValidAddress, logger } from "../utils";
import { PoolOfChanceAbi } from "../../build/factorySource";

import pools from "./pools_of_chance.json";
import BigNumber from "bignumber.js";

export const getPoolInfo = (pool: Contract<PoolOfChanceAbi>) =>
  pool.methods
    .getPoolInfo({ answerId: 0 })
    .call()
    .then(a => a.value0);

export const getRewardInfo = (pool: Contract<PoolOfChanceAbi>) =>
  pool.methods
    .getRewardInfo({ answerId: 0 })
    .call()
    .then(a => a.value0);

async function main() {
  const signer = (await locklift.keystore.getSigner("0"))!;

  for (const pool of pools) {
    console.log("Start deploy pool of chance with id:", pool.id);

    if (
      !isValidAddress(pool.owner) ||
      !isValidAddress(pool.stTokenRoot) ||
      !isValidAddress(pool.stVault) ||
      !isValidAddress(pool.prizeTokenRoot) ||
      Number(pool.poolFee) > 1000000 ||
      Number(pool.fundFee) > 1000000 ||
      !isValidAddress(pool.poolFeeReceiver) ||
      !isValidAddress(pool.fund)
    ) {
      console.error("Wrong params");
      break;
    }

    const { contract: poolContract } = await locklift.factory.deployContract({
      contract: "PoolOfChance",
      value: locklift.utils.toNano(5),
      constructorParams: {
        _owner: pool.owner,
        _stTokenRoot: pool.stTokenRoot,
        _stEverVault: pool.stVault,
        _minDepositValue: pool.minDepositValue,
        _rewardPeriod: pool.rewardPeriod,
        _poolFeeNumerator: pool.poolFee,
        _fundFeeNumerator: pool.fundFee,
        _prizeTokenRoot: pool.prizeTokenRoot,
        _minDepositValueForReward: pool.minDepositValueForReward,
        _depositsAmountForReward: pool.depositsAmountForReward,
        _poolFeeReceiverAddress: pool.poolFeeReceiver,
        _fundAddress: pool.fund,
        _withdrawFee: pool.withdrawFee,
        _prizeTokenRewardType: pool.prizeTokenRewardType,
        _prizeTokenRewardValue: pool.prizeTokenRewardValue,
        _prizeTokenNoRewardValue: pool.prizeTokenNoRewardValue,
      },
      publicKey: signer.publicKey,
      initParams: {
        _randomNonce: getRandomNonce(),
      },
    });

    logger.successStep(`PoolOfChance deployed: ${poolContract.address.toString()}`);

    const admin = await locklift.factory.accounts.addExistingAccount({
      type: WalletTypes.EverWallet,
      address: pool.owner,
    });

    // test admin
    // const admin = (
    //   await locklift.factory.accounts.addNewAccount({
    //     type: WalletTypes.WalletV3,
    //     value: toNano(1000),
    //     publicKey: signer.publicKey,
    //   })
    // ).account;

    if (Number(pool.addEverReserves) > 0) {
      await locklift.transactions.waitFinalized(
        poolContract.methods
          .addToEverReserves({
            _amount: pool.addEverReserves,
          })
          .send({
            from: admin.address,
            amount: new BigNumber(pool.addEverReserves).plus(toNano(2)).toString(),
          }),
      );
    }

    if (Number(pool.prizeTokenRootTransfer) > 0) {
      const prizeTokenRoot = await locklift.factory.getDeployedContract("TokenRootUpgradeable", pool.prizeTokenRoot);
      const prizeWallet = await locklift.factory.getDeployedContract(
        "TokenWalletUpgradeable",
        await prizeTokenRoot.methods
          .walletOf({ answerId: 0, walletOwner: admin.address })
          .call()
          .then(a => a.value0),
      );
      await locklift.transactions.waitFinalized(
        prizeWallet.methods
          .transfer({
            amount: pool.prizeTokenRootTransfer,
            deployWalletValue: 0,
            recipient: poolContract.address,
            remainingGasTo: admin.address,
            notify: true,
            payload: "",
          })
          .send({
            from: admin.address,
            amount: toNano(1),
          }),
      );
    }

    logger.info(`Pool info: ${JSON.stringify(await getPoolInfo(poolContract), null, 4)}`);
    logger.info(`Reward info: ${JSON.stringify(await getRewardInfo(poolContract), null, 4)}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });