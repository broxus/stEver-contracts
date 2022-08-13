import { concatMap, defer, filter, from, lastValueFrom, map, mergeMap, range, switchMap, toArray } from "rxjs";
import { Address, Contract, Signer, Transaction, zeroAddress } from "locklift";
import { StEverVaultAbi, TokenRootUpgradeableAbi } from "../build/factorySource";
import { forEach } from "lodash";
import chalk from "chalk";
import { getBalanceInfo, getSteEverWallet, getStrategiesInfo, getVaultInfo, logger, printEvents } from "./utils";

async function main() {
  const TOKEN_ROOT_NAME = "StEver";
  const TOKEN_ROOT_SYMBOL = "StEver";
  //create account factory
  const accountFactory = locklift.factory.getAccountsFactory("Wallet");
  const { code: platformCode } = locklift.factory.getContractArtifacts("Platform");
  const { code: accountCode } = locklift.factory.getContractArtifacts("StEverAccount");
  const { code: tokenWalletCode } = locklift.factory.getContractArtifacts("TokenWalletUpgradeable");
  const { code: tokenWalletPlatformCode } = locklift.factory.getContractArtifacts("TokenWalletPlatform");
  const { code: strategyDePoolCode } = locklift.factory.getContractArtifacts("StrategyDePool");
  //get signers
  const signers = await lastValueFrom(
    range(4).pipe(
      mergeMap(() =>
        from(locklift.keystore.getSigner("0")).pipe(filter(<T>(signer: T): signer is NonNullable<T> => !!signer)),
      ),
      toArray(),
    ),
  );
  //set governance signer
  const governanceSigner = signers[1];

  //create accounts for signers
  logger.startStep("Accounts are deploying...");
  const [adminAccount, _, user1Account, user2Account] = await lastValueFrom(
    from(signers).pipe(
      concatMap(signer =>
        accountFactory.deployNewAccount({
          initParams: { _randomNonce: locklift.utils.getRandomNonce() },
          publicKey: signer.publicKey,
          value: locklift.utils.toNano(100),
          constructorParams: {},
        }),
      ),
      map(({ account }) => account),
      toArray(),
    ),
  );
  logger.successStep("Accounts deployed");

  //  admin is deploying vault
  logger.startStep("Vault is deploying...");
  const { contract: vaultContract } = await locklift.tracing.trace(
    locklift.factory.deployContract({
      contract: "StEverVault",
      value: locklift.utils.toNano(10),
      initParams: {
        nonce: locklift.utils.getRandomNonce(),
        governance: `0x${governanceSigner.publicKey}`,
        platformCode: platformCode,
        accountCode: accountCode,
      },
      publicKey: adminAccount.publicKey,
      constructorParams: {
        _owner: adminAccount.address,
        _gainFee: locklift.utils.toNano(1),
      },
    }),
  );
  await locklift.tracing.trace(
    adminAccount.runTarget(
      {
        contract: vaultContract,
        value: locklift.utils.toNano(2),
      },
      vault => vault.methods.setMinStrategyDepositValue({ _minStrategyDepositValue: locklift.utils.toNano(1) }),
    ),
  );
  await locklift.tracing.trace(
    adminAccount.runTarget(
      {
        contract: vaultContract,
        value: locklift.utils.toNano(2),
      },
      vault => vault.methods.setMinStrategyWithdrawValue({ _minStrategyWithdrawValue: locklift.utils.toNano(1) }),
    ),
  );
  logger.successStep(`Vault deployed ${vaultContract.address.toString()}`);

  // admin is deploying tokenRoot contract and setting vault as owner
  logger.startStep("StEverTokenRoot is deploying...");

  const { contract: stEverTokenRootContract } = await locklift.tracing.trace(
    locklift.factory.deployContract({
      contract: "TokenRootUpgradeable",
      value: locklift.utils.toNano(2),
      initParams: {
        name_: TOKEN_ROOT_NAME,
        symbol_: TOKEN_ROOT_SYMBOL,
        decimals_: 9,
        rootOwner_: vaultContract.address,
        walletCode_: tokenWalletCode,
        randomNonce_: locklift.utils.getRandomNonce(),
        deployer_: new Address(zeroAddress),
        platformCode_: tokenWalletPlatformCode,
      },
      publicKey: adminAccount.publicKey,
      constructorParams: {
        initialSupplyTo: new Address(zeroAddress),
        initialSupply: 0,
        deployWalletValue: 0,
        mintDisabled: false,
        burnByRootDisabled: false,
        burnPaused: false,
        remainingGasTo: adminAccount.address,
      },
    }),
  );
  logger.successStep(`StEverTokenRoot deployed ${stEverTokenRootContract.address}`);

  //  admin is initializing vault
  logger.startStep("Vault is initializing...");
  await locklift.tracing.trace(
    adminAccount.runTarget(
      {
        contract: vaultContract,
        value: locklift.utils.toNano(2),
      },
      vaultContract => vaultContract.methods.initVault({ _stTokenRoot: stEverTokenRootContract.address }),
    ),
  );
  logger.successStep(`Vault initialized`);

  //  admin is deploying dePoolStrategyFactory
  logger.startStep("DePoolStrategyFactory is deploying...");
  const { contract: dePoolStrategyFactoryContract } = await locklift.tracing.trace(
    locklift.factory.deployContract({
      contract: "DepoolStrategyFactory",
      value: locklift.utils.toNano(2),
      publicKey: adminAccount.publicKey,
      initParams: {
        nonce: locklift.utils.getRandomNonce(),
        dePoolStrategyCode: strategyDePoolCode,
      },
      constructorParams: {
        _owner: adminAccount.address,
      },
    }),
  );
  logger.successStep(`DePoolStrategyFactory deployed ${dePoolStrategyFactoryContract.address}`);

  //  deploy 3 mock DePools and strategies
  const COUNT_OF_STRATEGIES_AND_POOLS = 3;
  logger.startStep(`Deploying ${COUNT_OF_STRATEGIES_AND_POOLS} DePools and strategies`);
  const strategiesWithDePools = await lastValueFrom(
    range(COUNT_OF_STRATEGIES_AND_POOLS).pipe(
      concatMap(() =>
        defer(async () => {
          const { contract: dePoolContract } = await locklift.tracing.trace(
            locklift.factory.deployContract({
              contract: "TestDepool",
              // value for rewards
              value: locklift.utils.toNano(100),
              constructorParams: {},
              publicKey: adminAccount.publicKey,
              initParams: {
                nonce: locklift.utils.getRandomNonce(),
              },
            }),
          );
          await locklift.tracing.trace(
            adminAccount.runTarget(
              {
                contract: dePoolStrategyFactoryContract,
                value: locklift.utils.toNano(6),
              },
              factory =>
                factory.methods.deployStrategy({ _vault: vaultContract.address, _dePool: dePoolContract.address }),
            ),
          );
          const { events } = await dePoolStrategyFactoryContract.getPastEvents({
            filter: ({ event }) => event === "NewStrategyDeployed",
          });
          if (events[0].event !== "NewStrategyDeployed") {
            throw new Error("NewStrategyDeployed event not emitted");
          }
          return {
            dePoolContract: dePoolContract,
            strategyContract: locklift.factory.getDeployedContract("StrategyDePool", events[0].data.strategy),
          };
        }),
      ),
      toArray(),
    ),
  );
  strategiesWithDePools.forEach(({ strategyContract, dePoolContract }) =>
    logger.successStep(
      `Deployed new dePool: ${dePoolContract.address.toString()} and related strategy: ${strategyContract.address.toString()}`,
    ),
  );

  //  user1 and user2 are depositing to vault
  const DEPOSIT_AMOUNT = 20;
  logger.startStep(`User1 and User2 are depositing to vault with value ${DEPOSIT_AMOUNT} ever...`);
  const users = [user1Account, user2Account];
  const [{ transaction: depositTransaction }] = await lastValueFrom(
    from(users).pipe(
      concatMap(user =>
        locklift.tracing.trace(
          user.runTarget(
            {
              contract: vaultContract,
              value: locklift.utils.toNano(DEPOSIT_AMOUNT + 2),
            },
            vault =>
              vault.methods.deposit({
                _amount: locklift.utils.toNano(DEPOSIT_AMOUNT),
                _nonce: locklift.utils.getRandomNonce(),
              }),
          ),
        ),
      ),
      toArray(),
    ),
  );
  await printEvents({ contract: vaultContract, eventName: "Deposit", parentTransaction: depositTransaction });
  const userBalancesInfoAfterFirstDeposit = await lastValueFrom(
    from(users).pipe(
      mergeMap(user => getBalanceInfo({ userAddress: user.address, tokenRootContract: stEverTokenRootContract })),
      toArray(),
    ),
  );
  logger.successStep(`Deposit success`);
  userBalancesInfoAfterFirstDeposit.forEach(({ balance, userAddress }) =>
    logger.info(`User ${userAddress} has ${locklift.utils.fromNano(balance)} stEver`),
  );
  logger.info(`Vault details ${JSON.stringify(await getVaultInfo(vaultContract), null, 4)}`);

  //  add strategies to the vault
  logger.startStep("Governance is adding strategies to the vault...");
  const [{ transaction: addStrategyTransaction }] = await lastValueFrom(
    from(strategiesWithDePools).pipe(
      concatMap(({ strategyContract }) =>
        locklift.tracing.trace(
          vaultContract.methods
            .addStrategy({ _strategy: strategyContract.address })
            .sendExternal({ publicKey: governanceSigner.publicKey }),
        ),
      ),
      toArray(),
    ),
  );
  await printEvents({ eventName: "StrategyAdded", contract: vaultContract, parentTransaction: addStrategyTransaction });
  logger.successStep("Strategies added");

  //  governance deposit to strategies
  logger.startStep("Governance depositing to strategies...");
  const DEPOSIT_TO_STRATEGY_AMOUNT = 5;
  const { transaction: depositToStrategiesTransaction } = await locklift.tracing.trace(
    vaultContract.methods
      .depositToStrategies({
        _depositConfigs: strategiesWithDePools.map(({ strategyContract }) => [
          locklift.utils.getRandomNonce(),
          {
            strategy: strategyContract.address,
            amount: locklift.utils.toNano(DEPOSIT_TO_STRATEGY_AMOUNT),
            fee: locklift.utils.toNano(0.6),
          },
        ]),
      })
      .sendExternal({ publicKey: adminAccount.publicKey }),
  );
  logger.info(`Vault details ${JSON.stringify(await getVaultInfo(vaultContract), null, 4)}`);

  await printEvents({
    contract: vaultContract,
    eventName: "StrategyHandledDeposit",
    parentTransaction: depositToStrategiesTransaction,
  });
  logger.successStep("Deposit to strategies success");

  //  dePool send onRoundComplete callBack
  logger.startStep("DePools sending onRoundComplete callBack...");
  const ROUND_REWARD = 2;
  const [{ transaction: roundCompleteTransaction }] = await lastValueFrom(
    from(strategiesWithDePools).pipe(
      concatMap(({ dePoolContract }) =>
        dePoolContract.methods
          .roundCompelte({ _reward: locklift.utils.toNano(ROUND_REWARD) })
          .sendExternal({ publicKey: governanceSigner.publicKey }),
      ),
      toArray(),
    ),
  );
  await printEvents({
    contract: vaultContract,
    eventName: "StrategyReported",
    parentTransaction: roundCompleteTransaction,
  });
  logger.info(`Vault details ${JSON.stringify(await getVaultInfo(vaultContract), null, 4)}`);
  logger.successStep("Strategies reported after onRoundComplete callBack");

  //  governance withdrawing value from strategies
  logger.startStep("Governance withdrawing from strategies full value");
  const { transaction: withdrawFromStrategyTransaction } = await locklift.tracing.trace(
    vaultContract.methods
      .processWithdrawFromStrategies({
        _withdrawConfig: strategiesWithDePools.map(({ strategyContract: { address } }) => [
          locklift.utils.getRandomNonce(),
          {
            strategy: address,
            amount: locklift.utils.toNano(DEPOSIT_TO_STRATEGY_AMOUNT + ROUND_REWARD),
            fee: locklift.utils.toNano(0.6),
          },
        ]),
      })
      .sendExternal({ publicKey: governanceSigner.publicKey }),
  );
  await printEvents({
    contract: vaultContract,
    eventName: "StrategyWithdrawSuccess",
    parentTransaction: withdrawFromStrategyTransaction,
  });
  logger.info(`Vault details ${JSON.stringify(await getVaultInfo(vaultContract), null, 4)}`);
  logger.info(`Strategies state ${JSON.stringify(await getStrategiesInfo(vaultContract), null, 4)}`);
  logger.successStep("Withdrawing from strategies success");

  //users are making withdraw requests
  logger.startStep("Users are making withdraw requests");
  const withdrawNonces = users.reduce(
    (acc, user) => ({ ...acc, [user.address.toString()]: locklift.utils.getRandomNonce() }),
    {} as Record<string, number>,
  );
  const [{ transaction: requestWithdrawTransaction }] = await lastValueFrom(
    from(users).pipe(
      concatMap(user =>
        defer(async () => {
          const { depositPayload } = await vaultContract.methods
            .encodeDepositPayload({
              _nonce: withdrawNonces[user.address.toString()],
              _deposit_owner: user.address,
            })
            .call();

          const stEverWallet = await getSteEverWallet({
            userAddress: user.address,
            tokenRootContract: stEverTokenRootContract,
          });
          return locklift.tracing.trace(
            user.runTarget(
              {
                contract: stEverWallet,
                value: locklift.utils.toNano(4),
              },
              stEverWallet =>
                stEverWallet.methods.transfer({
                  remainingGasTo: user.address,
                  amount: locklift.utils.toNano(DEPOSIT_AMOUNT),
                  notify: true,
                  recipient: vaultContract.address,
                  payload: depositPayload,
                  deployWalletValue: 0,
                }),
            ),
            { allowedCodes: { compute: [null] } },
          );
        }),
      ),
      toArray(),
    ),
  );
  await printEvents({
    eventName: "WithdrawRequest",
    parentTransaction: requestWithdrawTransaction,
    contract: vaultContract,
  });
  logger.successStep("Users made withdraw requests");

  //  governance emit withdraw to user
  logger.startStep("Governance are emitting withdraw to users");
  const { transaction: withdrawToUsersTransaction } = await locklift.tracing.trace(
    vaultContract.methods
      .processSendToUsers({
        sendConfig: users.map(({ address }) => [
          locklift.utils.getRandomNonce(),
          { user: address, nonces: [withdrawNonces[address.toString()]] },
        ]),
      })
      .sendExternal({ publicKey: governanceSigner.publicKey }),
  );
  await printEvents({
    eventName: "WithdrawSuccess",
    parentTransaction: withdrawToUsersTransaction,
    contract: vaultContract,
  });
  logger.info(`Vault details ${JSON.stringify(await getVaultInfo(vaultContract), null, 4)}`);
  logger.successStep(`Users received deposited amount + reward`);
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
