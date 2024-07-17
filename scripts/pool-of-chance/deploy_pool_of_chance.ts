import { BigNumber } from "bignumber.js";
import { Contract, getRandomNonce, toNano, WalletTypes } from "locklift";
import prompts from "prompts";
import { isValidAddress, logger } from "../utils";
import { PoolOfChanceAbi } from "../../build/factorySource";

BigNumber.config({ EXPONENTIAL_AT: 256 });

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
  console.log("\x1b[1m", "\n\nSetting PoolOfChance params:");

  const response = await prompts([
    {
      type: "text",
      name: "poolFactory",
      message: "poolFactory address",
      validate: (value: string) => (isValidAddress(value) ? true : "Invalid address"),
    },
    {
      type: "text",
      name: "prizeTokenRoot",
      message: "prize token root address",
      validate: (value: string) => (isValidAddress(value) ? true : "Invalid address"),
    },
    {
      type: "number",
      name: "minDepositValue",
      message: "min deposit value (in ever), below which a deposit will be declined",
    },
    {
      type: "number",
      name: "rewardPeriod",
      message: "reward period (seconds)",
    },
    {
      type: "number",
      name: "poolFee",
      message: "pool fee numerator, denominator = 1 000 000",
      validate: (value: number) => value <= Number(1000000),
    },
    {
      type: "text",
      name: "poolFeeReceiver",
      message: "pool fee receiver address",
      validate: (value: string) => (isValidAddress(value) ? true : "Invalid address"),
    },
    {
      type: "number",
      name: "fundFee",
      message: "fund fee numerator, denominator = 1 000 000",
      validate: (value: number) => value <= Number(1000000),
    },
    {
      type: "text",
      name: "fund",
      message: "fund address",
      validate: (value: string) => (isValidAddress(value) ? true : "Invalid address"),
    },
    {
      type: "number",
      name: "minDepositValueForReward",
      message: "min deposit value for reward (in ever)",
    },
    {
      type: "number",
      name: "depositsAmountForReward",
      message: "number of users who must deposit for the reward to be assigned",
    },
    {
      type: "text",
      name: "withdrawFee",
      message: "withdraw fee (ever)",
    },
    {
      type: "number",
      name: "prizeTokenRewardType",
      message:
        "if prizeTokenRewardType = 1, then reward = ever reward\n" +
        "if prizeTokenRewardType = 2, then reward = prizeTokenRewardValue (next field)",
      validate: (value: number) => value == 1 || value == 2,
    },
    {
      type: prev => (prev == 2 ? "text" : null),
      name: "prizeTokenRewardValue",
      message: "prize token reward value (in smallest units of tokens)",
    },
    {
      type: "text",
      name: "prizeTokenNoRewardValue",
      message: "prize token value transfer for non-winners (in smallest units of tokens)",
    },
  ]);

  const poolFactory = await locklift.factory.getDeployedContract("PoolOfChanceFactory", response.poolFactory);
  const ownerAddress = await poolFactory.methods
    .owner()
    .call()
    .then(a => a.owner);

  const admin = await locklift.factory.accounts.addExistingAccount({
    type: WalletTypes.EverWallet,
    address: ownerAddress,
  });

  const { traceTree } = await locklift.tracing.trace(
    poolFactory.methods
      .createPool({
        _poolNonce: getRandomNonce(),
        _minDepositValue: toNano(response.minDepositValue),
        _rewardPeriod: response.rewardPeriod,
        _poolFeeNumerator: response.poolFee,
        _fundFeeNumerator: response.fundFee,
        _prizeTokenRoot: response.prizeTokenRoot,
        _minDepositValueForReward: toNano(response.minDepositValueForReward),
        _depositsAmountForReward: response.depositsAmountForReward,
        _poolFeeReceiverAddress: response.poolFeeReceiver,
        _fundAddress: response.fund,
        _withdrawFee: toNano(Number(response.withdrawFee)),
        _prizeTokenRewardType: response.prizeTokenRewardType,
        _prizeTokenRewardValue: response.prizeTokenRewardValue,
        _prizeTokenNoRewardValue: response.prizeTokenNoRewardValue,
      })
      .send({
        from: admin.address,
        amount: toNano(6),
      }),
  );

  const poolAddress = traceTree?.findEventsForContract({
    contract: poolFactory,
    name: "PoolOfChanceCreated" as const,
  })[0].poolOfChance!;

  logger.successStep(`PoolOfChance deployed: ${poolAddress.toString()}`);

  const pool = await locklift.factory.getDeployedContract("PoolOfChance", poolAddress);

  logger.info(`Pool info: ${JSON.stringify(await getPoolInfo(pool), null, 4)}`);
  logger.info(`Reward info: ${JSON.stringify(await getRewardInfo(pool), null, 4)}`);
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
