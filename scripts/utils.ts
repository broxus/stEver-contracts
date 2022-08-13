import { Address, Contract, Transaction } from "locklift";
import { StEverVaultAbi, TokenRootUpgradeableAbi, TokenWalletUpgradeableAbi } from "../build/factorySource";
import chalk from "chalk";

export const printEvents = async ({
  eventName,
  parentTransaction,
  contract,
}: {
  contract: Contract<any>;
  eventName: string;
  parentTransaction: Transaction;
}) => {
  const pastEvents = await contract.getPastEvents({
    filter: ({ event, transaction }) => event === eventName && transaction.createdAt >= parentTransaction.createdAt,
  });
  pastEvents.events.forEach(({ event, data }) => {
    logger.event(`Event: ${event}, data: ${JSON.stringify(data, null, 4)}`);
  });
};

export const getVaultInfo = (vaultContract: Contract<StEverVaultAbi>) =>
  vaultContract.methods
    .getDetails({ answerId: 0 })
    .call()
    .then(({ value0 }) =>
      locklift.provider.getBalance(vaultContract.address).then(vaultBalance => ({ ...value0, vaultBalance })),
    );

export const getStrategiesInfo = (vaultContract: Contract<StEverVaultAbi>) =>
  vaultContract.methods.strategies({}).call();
export const getBalanceInfo = ({
  userAddress,
  tokenRootContract,
}: {
  userAddress: Address;
  tokenRootContract: Contract<TokenRootUpgradeableAbi>;
}): Promise<{ userAddress: string; balance: string }> => {
  return getSteEverWallet({ userAddress, tokenRootContract })
    .then(wallet => wallet.methods.balance({ answerId: 0 }).call())
    .then(({ value0: balance }) => ({
      userAddress: userAddress.toString(),
      balance,
    }));
};
export const getSteEverWallet = async ({
  userAddress,
  tokenRootContract,
}: {
  userAddress: Address;
  tokenRootContract: Contract<TokenRootUpgradeableAbi>;
}): Promise<Contract<TokenWalletUpgradeableAbi>> => {
  const { value0: stTokenWalletAddress } = await tokenRootContract.methods
    .walletOf({ walletOwner: userAddress, answerId: 1 })
    .call();
  return locklift.factory.getDeployedContract("TokenWalletUpgradeable", stTokenWalletAddress);
};

class Logger {
  private stepCounter = 1;
  startStep = (message: string) => {
    console.log(chalk.blue(`Step ${this.stepCounter++}. ${message}`));
  };
  successStep = (message: string) => {
    console.log(chalk.green(`Step ${this.stepCounter - 1} success ${message}`));
  };
  info = (message: string) => {
    console.log(chalk.cyan(message));
  };
  event = (message: string) => {
    console.log(chalk.yellow(message));
  };
}

export const logger = new Logger();
