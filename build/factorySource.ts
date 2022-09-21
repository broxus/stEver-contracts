const depoolStrategyFactoryAbi = {"ABIversion":2,"version":"2.2","header":["pubkey","time","expire"],"functions":[{"name":"constructor","inputs":[{"name":"_owner","type":"address"}],"outputs":[]},{"name":"transferOwnership","inputs":[{"name":"_newOwner","type":"address"},{"name":"_sendGasTo","type":"address"}],"outputs":[]},{"name":"installNewStrategyCode","inputs":[{"name":"_strategyCode","type":"cell"},{"name":"_sendGasTo","type":"address"}],"outputs":[]},{"name":"deployStrategy","inputs":[{"name":"_dePool","type":"address"},{"name":"_vault","type":"address"}],"outputs":[]},{"name":"upgradeStrategy","inputs":[{"name":"_strategy","type":"address"}],"outputs":[]},{"name":"upgrade","inputs":[{"name":"_newCode","type":"cell"},{"name":"_newVersion","type":"uint32"},{"name":"_sendGasTo","type":"address"}],"outputs":[]},{"name":"nonce","inputs":[],"outputs":[{"name":"nonce","type":"uint128"}]},{"name":"dePoolStrategyCode","inputs":[],"outputs":[{"name":"dePoolStrategyCode","type":"cell"}]},{"name":"strategyVersion","inputs":[],"outputs":[{"name":"strategyVersion","type":"uint32"}]},{"name":"strategyCount","inputs":[],"outputs":[{"name":"strategyCount","type":"uint32"}]},{"name":"factoryVersion","inputs":[],"outputs":[{"name":"factoryVersion","type":"uint32"}]}],"data":[{"key":1,"name":"nonce","type":"uint128"},{"key":2,"name":"dePoolStrategyCode","type":"cell"}],"events":[{"name":"NewStrategyDeployed","inputs":[{"name":"strategy","type":"address"},{"name":"version","type":"uint32"}],"outputs":[]},{"name":"StrategyCodeUpdated","inputs":[{"name":"prevStrategyVersion","type":"uint32"},{"name":"newStrategyVersion","type":"uint32"}],"outputs":[]}],"fields":[{"name":"_pubkey","type":"uint256"},{"name":"_timestamp","type":"uint64"},{"name":"_constructorFlag","type":"bool"},{"name":"nonce","type":"uint128"},{"name":"dePoolStrategyCode","type":"cell"},{"name":"owner","type":"address"},{"name":"strategyVersion","type":"uint32"},{"name":"strategyCount","type":"uint32"},{"name":"factoryVersion","type":"uint32"}]} as const
const platformAbi = {"ABIversion":2,"version":"2.2","header":["time","expire"],"functions":[{"name":"constructor","inputs":[{"name":"code","type":"cell"},{"name":"params","type":"cell"},{"name":"sendGasTo","type":"address"}],"outputs":[]}],"data":[{"key":1,"name":"root","type":"address"},{"key":2,"name":"platformType","type":"uint8"},{"key":3,"name":"initialData","type":"cell"},{"key":4,"name":"platformCode","type":"cell"}],"events":[],"fields":[{"name":"_pubkey","type":"uint256"},{"name":"_timestamp","type":"uint64"},{"name":"_constructorFlag","type":"bool"},{"name":"root","type":"address"},{"name":"platformType","type":"uint8"},{"name":"initialData","type":"cell"},{"name":"platformCode","type":"cell"}]} as const
const stEverAccountAbi = {"ABIversion":2,"version":"2.2","header":["time","expire"],"functions":[{"name":"constructor","inputs":[],"outputs":[]},{"name":"getDetails","inputs":[{"name":"answerId","type":"uint32"}],"outputs":[{"components":[{"name":"user","type":"address"},{"name":"vault","type":"address"}],"name":"value0","type":"tuple"}]},{"name":"onEmergencyWithdrawStart","inputs":[],"outputs":[]},{"name":"addPendingValue","inputs":[{"name":"_nonce","type":"uint64"},{"name":"_amount","type":"uint128"}],"outputs":[]},{"name":"resetPendingValues","inputs":[{"components":[{"name":"amount","type":"uint128"},{"name":"timestamp","type":"uint64"}],"name":"rejectedWithdrawals","type":"map(uint64,tuple)"}],"outputs":[]},{"name":"removePendingWithdraw","inputs":[{"name":"_nonce","type":"uint64"}],"outputs":[]},{"name":"processWithdraw","inputs":[{"name":"_satisfiedWithdrawRequests","type":"uint64[]"}],"outputs":[]},{"name":"withdrawRequests","inputs":[],"outputs":[{"components":[{"name":"amount","type":"uint128"},{"name":"timestamp","type":"uint64"}],"name":"withdrawRequests","type":"map(uint64,tuple)"}]}],"data":[],"events":[{"name":"Receive","inputs":[{"name":"amount","type":"uint128"}],"outputs":[]}],"fields":[{"name":"_pubkey","type":"uint256"},{"name":"_timestamp","type":"uint64"},{"name":"_constructorFlag","type":"bool"},{"name":"vault","type":"address"},{"name":"user","type":"address"},{"name":"currentVersion","type":"uint32"},{"components":[{"name":"amount","type":"uint128"},{"name":"timestamp","type":"uint64"}],"name":"withdrawRequests","type":"map(uint64,tuple)"}]} as const
const stEverVaultAbi = {"ABIversion":2,"version":"2.2","header":["pubkey","time","expire"],"functions":[{"name":"constructor","inputs":[{"name":"_owner","type":"address"},{"name":"_gainFee","type":"uint128"}],"outputs":[]},{"name":"addStrategy","inputs":[{"name":"_strategy","type":"address"}],"outputs":[]},{"name":"removeStrategy","inputs":[{"name":"_strategy","type":"address"}],"outputs":[]},{"name":"validateDepositRequest","inputs":[{"components":[{"name":"amount","type":"uint128"},{"name":"fee","type":"uint128"}],"name":"_depositConfigs","type":"map(address,tuple)"}],"outputs":[{"components":[{"name":"strategy","type":"address"},{"name":"errCode","type":"uint16"}],"name":"value0","type":"tuple[]"}]},{"name":"depositToStrategies","inputs":[{"components":[{"name":"amount","type":"uint128"},{"name":"fee","type":"uint128"}],"name":"_depositConfigs","type":"map(address,tuple)"}],"outputs":[]},{"name":"onStrategyHandledDeposit","inputs":[],"outputs":[]},{"name":"onStrategyDidntHandleDeposit","inputs":[{"name":"_errcode","type":"uint32"}],"outputs":[]},{"name":"strategyReport","inputs":[{"name":"_gain","type":"uint128"},{"name":"_loss","type":"uint128"},{"name":"_totalAssets","type":"uint128"},{"name":"_requestedBalance","type":"uint128"}],"outputs":[]},{"name":"validateWithdrawFromStrategiesRequest","inputs":[{"components":[{"name":"amount","type":"uint128"},{"name":"fee","type":"uint128"}],"name":"_withdrawConfig","type":"map(address,tuple)"}],"outputs":[{"components":[{"name":"strategy","type":"address"},{"name":"errCode","type":"uint16"}],"name":"value0","type":"tuple[]"}]},{"name":"processWithdrawFromStrategies","inputs":[{"components":[{"name":"amount","type":"uint128"},{"name":"fee","type":"uint128"}],"name":"_withdrawConfig","type":"map(address,tuple)"}],"outputs":[]},{"name":"onStrategyHandledWithdrawRequest","inputs":[],"outputs":[]},{"name":"receiveFromStrategy","inputs":[],"outputs":[]},{"name":"receiveAdditionalTransferFromStrategy","inputs":[],"outputs":[]},{"name":"withdrawFromStrategyError","inputs":[{"name":"_errcode","type":"uint32"}],"outputs":[]},{"name":"deposit","inputs":[{"name":"_amount","type":"uint128"},{"name":"_nonce","type":"uint64"}],"outputs":[]},{"name":"onAcceptTokensTransfer","inputs":[{"name":"_tokenRoot","type":"address"},{"name":"_amount","type":"uint128"},{"name":"_sender","type":"address"},{"name":"_senderWallet","type":"address"},{"name":"_remainingGasTo","type":"address"},{"name":"_payload","type":"cell"}],"outputs":[]},{"name":"onPendingWithdrawAccepted","inputs":[{"name":"_nonce","type":"uint64"},{"name":"user","type":"address"}],"outputs":[]},{"name":"onPendingWithdrawRejected","inputs":[{"name":"_nonce","type":"uint64"},{"name":"user","type":"address"},{"name":"_amount","type":"uint128"}],"outputs":[]},{"name":"removePendingWithdraw","inputs":[{"name":"_nonce","type":"uint64"}],"outputs":[]},{"name":"onPendingWithdrawRemoved","inputs":[{"name":"user","type":"address"},{"name":"nonce","type":"uint64"},{"name":"_amount","type":"uint128"}],"outputs":[]},{"name":"processSendToUsers","inputs":[{"components":[{"name":"nonces","type":"uint64[]"}],"name":"sendConfig","type":"map(address,tuple)"}],"outputs":[]},{"name":"withdrawToUser","inputs":[{"name":"amount","type":"uint128"},{"name":"_user","type":"address"},{"components":[{"name":"amount","type":"uint128"},{"name":"timestamp","type":"uint64"}],"name":"_withdrawals","type":"map(uint64,tuple)"}],"outputs":[]},{"name":"onAcceptTokensBurn","inputs":[{"name":"amount","type":"uint128"},{"name":"walletOwner","type":"address"},{"name":"wallet","type":"address"},{"name":"remainingGasTo","type":"address"},{"name":"payload","type":"cell"}],"outputs":[]},{"name":"processWithdrawExtraMoneyFromStrategies","inputs":[{"name":"_strategies","type":"address[]"}],"outputs":[]},{"name":"receiveExtraMoneyFromStrategy","inputs":[],"outputs":[]},{"name":"withdrawStEverFee","inputs":[{"name":"_amount","type":"uint128"}],"outputs":[]},{"name":"upgrade","inputs":[{"name":"_newCode","type":"cell"},{"name":"_newVersion","type":"uint32"},{"name":"_sendGasTo","type":"address"}],"outputs":[]},{"name":"emergencyWithdrawProcess","inputs":[{"name":"_user","type":"address"},{"components":[{"name":"amount","type":"uint128"},{"name":"fee","type":"uint128"}],"name":"_emergencyWithdrawConfig","type":"map(address,tuple)"}],"outputs":[]},{"name":"_processEmergencyWithdraw","inputs":[{"name":"_user","type":"address"},{"components":[{"name":"amount","type":"uint128"},{"name":"fee","type":"uint128"}],"name":"_emergencyWithdrawConfig","type":"map(address,tuple)"}],"outputs":[]},{"name":"getEmergencyWithdrawConfig","inputs":[{"name":"answerId","type":"uint32"}],"outputs":[{"components":[{"name":"amount","type":"uint128"},{"name":"fee","type":"uint128"}],"name":"value0","type":"map(address,tuple)"}]},{"name":"transferOwnership","inputs":[{"name":"_newOwner","type":"address"},{"name":"_sendGasTo","type":"address"}],"outputs":[]},{"name":"transferGovernance","inputs":[{"name":"_newGovernance","type":"uint256"},{"name":"_sendGasTo","type":"address"}],"outputs":[]},{"name":"initVault","inputs":[{"name":"_stTokenRoot","type":"address"}],"outputs":[]},{"name":"receiveTokenWalletAddress","inputs":[{"name":"_wallet","type":"address"}],"outputs":[]},{"name":"setGainFee","inputs":[{"name":"_gainFee","type":"uint128"}],"outputs":[]},{"name":"setMinStrategyDepositValue","inputs":[{"name":"_minStrategyDepositValue","type":"uint128"}],"outputs":[]},{"name":"setMinStrategyWithdrawValue","inputs":[{"name":"_minStrategyWithdrawValue","type":"uint128"}],"outputs":[]},{"name":"setStEverFeePercent","inputs":[{"name":"_stEverFeePercent","type":"uint8"}],"outputs":[]},{"name":"encodeDepositPayload","inputs":[{"name":"_deposit_owner","type":"address"},{"name":"_nonce","type":"uint64"}],"outputs":[{"name":"depositPayload","type":"cell"}]},{"name":"decodeDepositPayload","inputs":[{"name":"_payload","type":"cell"}],"outputs":[{"name":"deposit_owner","type":"address"},{"name":"nonce","type":"uint64"},{"name":"correct","type":"bool"}]},{"name":"getDepositStEverAmount","inputs":[{"name":"_amount","type":"uint128"}],"outputs":[{"name":"value0","type":"uint128"}]},{"name":"getWithdrawEverAmount","inputs":[{"name":"_amount","type":"uint128"}],"outputs":[{"name":"value0","type":"uint128"}]},{"name":"getAccountAddress","inputs":[{"name":"answerId","type":"uint32"},{"name":"_user","type":"address"}],"outputs":[{"name":"value0","type":"address"}]},{"name":"getDetails","inputs":[{"name":"answerId","type":"uint32"}],"outputs":[{"components":[{"name":"stTokenRoot","type":"address"},{"name":"stEverWallet","type":"address"},{"name":"stEverSupply","type":"uint128"},{"name":"totalAssets","type":"uint128"},{"name":"availableAssets","type":"uint128"},{"name":"owner","type":"address"},{"name":"governance","type":"uint256"},{"name":"gainFee","type":"uint128"},{"name":"accountVersion","type":"uint32"},{"name":"stEverVaultVersion","type":"uint32"},{"name":"minStrategyDepositValue","type":"uint128"},{"name":"minStrategyWithdrawValue","type":"uint128"},{"name":"stEverFeePercent","type":"uint8"},{"name":"totalStEverFee","type":"uint128"}],"name":"value0","type":"tuple"}]},{"name":"nonce","inputs":[],"outputs":[{"name":"nonce","type":"uint128"}]},{"name":"strategies","inputs":[],"outputs":[{"components":[{"name":"lastReport","type":"uint128"},{"name":"totalGain","type":"uint128"},{"name":"depositingAmount","type":"uint128"},{"name":"withdrawingAmount","type":"uint128"}],"name":"strategies","type":"map(address,tuple)"}]}],"data":[{"key":1,"name":"nonce","type":"uint128"},{"key":2,"name":"governance","type":"uint256"},{"key":3,"name":"platformCode","type":"cell"},{"key":4,"name":"accountCode","type":"cell"}],"events":[{"name":"StrategyAdded","inputs":[{"name":"strategy","type":"address"}],"outputs":[]},{"name":"StrategyRemoved","inputs":[{"name":"strategy","type":"address"}],"outputs":[]},{"name":"StrategyReported","inputs":[{"name":"strategy","type":"address"},{"components":[{"name":"gain","type":"uint128"},{"name":"loss","type":"uint128"},{"name":"totalAssets","type":"uint128"}],"name":"report","type":"tuple"}],"outputs":[]},{"name":"StrategyHandledDeposit","inputs":[{"name":"strategy","type":"address"},{"name":"depositValue","type":"uint128"}],"outputs":[]},{"name":"StrategyDidntHandleDeposit","inputs":[{"name":"strategy","type":"address"},{"name":"errcode","type":"uint32"}],"outputs":[]},{"name":"ProcessDepositToStrategyError","inputs":[{"name":"strategy","type":"address"},{"name":"errcode","type":"uint16"}],"outputs":[]},{"name":"StrategyHandledWithdrawRequest","inputs":[{"name":"strategy","type":"address"},{"name":"amount","type":"uint128"}],"outputs":[]},{"name":"StrategyWithdrawSuccess","inputs":[{"name":"strategy","type":"address"},{"name":"amount","type":"uint128"}],"outputs":[]},{"name":"StrategyWithdrawError","inputs":[{"name":"strategy","type":"address"},{"name":"errcode","type":"uint32"}],"outputs":[]},{"name":"ProcessWithdrawFromStrategyError","inputs":[{"name":"strategy","type":"address"},{"name":"errcode","type":"uint16"}],"outputs":[]},{"name":"ReceiveAdditionalTransferFromStrategy","inputs":[{"name":"strategy","type":"address"},{"name":"amount","type":"uint128"}],"outputs":[]},{"name":"ProcessWithdrawExtraMoneyFromStrategyError","inputs":[{"name":"strategy","type":"address"},{"name":"ercode","type":"uint16"}],"outputs":[]},{"name":"ReceiveExtraMoneyFromStrategy","inputs":[{"name":"strategy","type":"address"},{"name":"value","type":"uint128"}],"outputs":[]},{"name":"Deposit","inputs":[{"name":"user","type":"address"},{"name":"depositAmount","type":"uint128"},{"name":"receivedStEvers","type":"uint128"}],"outputs":[]},{"name":"WithdrawRequest","inputs":[{"name":"user","type":"address"},{"name":"amount","type":"uint128"},{"name":"nonce","type":"uint64"}],"outputs":[]},{"name":"WithdrawRequestRemoved","inputs":[{"name":"user","type":"address"},{"name":"nonce","type":"uint64"}],"outputs":[]},{"name":"BadWithdrawRequest","inputs":[{"name":"user","type":"address"},{"name":"amount","type":"uint128"},{"name":"attachedValue","type":"uint128"}],"outputs":[]},{"name":"WithdrawError","inputs":[{"name":"user","type":"address"},{"components":[{"name":"stEverAmount","type":"uint128"},{"name":"everAmount","type":"uint128"}],"name":"withdrawInfo","type":"map(uint64,tuple)"},{"name":"amount","type":"uint128"}],"outputs":[]},{"name":"WithdrawSuccess","inputs":[{"name":"user","type":"address"},{"name":"amount","type":"uint128"},{"components":[{"name":"stEverAmount","type":"uint128"},{"name":"everAmount","type":"uint128"}],"name":"withdrawInfo","type":"map(uint64,tuple)"}],"outputs":[]},{"name":"WithdrawFee","inputs":[{"name":"amount","type":"uint128"}],"outputs":[]}],"fields":[{"name":"_pubkey","type":"uint256"},{"name":"_timestamp","type":"uint64"},{"name":"_constructorFlag","type":"bool"},{"name":"nonce","type":"uint128"},{"name":"governance","type":"uint256"},{"name":"platformCode","type":"cell"},{"name":"accountCode","type":"cell"},{"name":"stEverSupply","type":"uint128"},{"name":"totalAssets","type":"uint128"},{"name":"availableAssets","type":"uint128"},{"name":"totalStEverFee","type":"uint128"},{"name":"stEverWallet","type":"address"},{"name":"stTokenRoot","type":"address"},{"name":"gainFee","type":"uint128"},{"name":"stEverFeePercent","type":"uint8"},{"name":"minStrategyDepositValue","type":"uint128"},{"name":"minStrategyWithdrawValue","type":"uint128"},{"name":"owner","type":"address"},{"name":"accountVersion","type":"uint32"},{"name":"stEverVaultVersion","type":"uint32"},{"components":[{"name":"lastReport","type":"uint128"},{"name":"totalGain","type":"uint128"},{"name":"depositingAmount","type":"uint128"},{"name":"withdrawingAmount","type":"uint128"}],"name":"strategies","type":"map(address,tuple)"},{"components":[{"name":"amount","type":"uint128"},{"name":"user","type":"address"}],"name":"pendingWithdrawals","type":"map(uint64,tuple)"},{"components":[{"name":"isEmergency","type":"bool"},{"name":"emitter","type":"address"},{"name":"emitTimestamp","type":"uint64"}],"name":"emergencyState","type":"tuple"}]} as const
const strategyDePoolAbi = {"ABIversion":2,"version":"2.2","header":["time","expire"],"functions":[{"name":"constructor","inputs":[{"name":"_vault","type":"address"},{"name":"_dePool","type":"address"}],"outputs":[]},{"name":"getDetails","inputs":[{"name":"answerId","type":"uint32"}],"outputs":[{"components":[{"name":"vault","type":"address"},{"name":"dePool","type":"address"}],"name":"value0","type":"tuple"}]},{"name":"deposit","inputs":[{"name":"_amount","type":"uint128"}],"outputs":[]},{"name":"withdraw","inputs":[{"name":"_amount","type":"uint128"}],"outputs":[]},{"name":"receiveAnswer","inputs":[{"name":"_errcode","type":"uint32"},{"name":"comment","type":"uint64"}],"outputs":[]},{"name":"onTransfer","inputs":[{"name":"source","type":"address"},{"name":"amount","type":"uint128"}],"outputs":[]},{"name":"onRoundComplete","inputs":[{"name":"_roundId","type":"uint64"},{"name":"_reward","type":"uint64"},{"name":"_ordinaryStake","type":"uint64"},{"name":"_vestingStake","type":"uint64"},{"name":"_lockStake","type":"uint64"},{"name":"_reinvest","type":"bool"},{"name":"_reason","type":"uint8"}],"outputs":[]},{"name":"withdrawExtraMoney","inputs":[],"outputs":[]},{"name":"upgrade","inputs":[{"name":"_newCode","type":"cell"},{"name":"_newVersion","type":"uint32"},{"name":"_sendGasTo","type":"address"}],"outputs":[]},{"name":"nonce","inputs":[],"outputs":[{"name":"nonce","type":"uint128"}]},{"name":"factory","inputs":[],"outputs":[{"name":"factory","type":"address"}]},{"name":"strategyVersion","inputs":[],"outputs":[{"name":"strategyVersion","type":"uint32"}]}],"data":[{"key":1,"name":"nonce","type":"uint128"},{"key":2,"name":"factory","type":"address"},{"key":3,"name":"strategyVersion","type":"uint32"}],"events":[{"name":"Deposit","inputs":[{"name":"amount","type":"uint128"}],"outputs":[]},{"name":"Withdraw","inputs":[{"name":"amount","type":"uint128"}],"outputs":[]}],"fields":[{"name":"_pubkey","type":"uint256"},{"name":"_timestamp","type":"uint64"},{"name":"_constructorFlag","type":"bool"},{"name":"minStake","type":"uint128"},{"name":"vault","type":"address"},{"name":"dePool","type":"address"},{"name":"state","type":"uint8"},{"name":"nonce","type":"uint128"},{"name":"factory","type":"address"},{"name":"strategyVersion","type":"uint32"}]} as const
const testDepoolAbi = {"ABIversion":2,"version":"2.2","header":["time","expire"],"functions":[{"name":"setClosed","inputs":[{"name":"_closed","type":"bool"}],"outputs":[]},{"name":"setWithdrawalsClosed","inputs":[{"name":"_withdrawalsClosed","type":"bool"}],"outputs":[]},{"name":"addOrdinaryStake","inputs":[{"name":"stake","type":"uint64"}],"outputs":[]},{"name":"withdrawFromPoolingRound","inputs":[{"name":"withdrawValue","type":"uint64"}],"outputs":[]},{"name":"withdrawPart","inputs":[{"name":"withdrawValue","type":"uint64"}],"outputs":[]},{"name":"withdrawAll","inputs":[],"outputs":[]},{"name":"roundComplete","inputs":[{"name":"_reward","type":"uint64"},{"name":"includesWithdraw","type":"bool"}],"outputs":[]},{"name":"constructor","inputs":[],"outputs":[]},{"name":"nonce","inputs":[],"outputs":[{"name":"nonce","type":"uint128"}]}],"data":[{"key":1,"name":"nonce","type":"uint128"}],"events":[],"fields":[{"name":"_pubkey","type":"uint256"},{"name":"_timestamp","type":"uint64"},{"name":"_constructorFlag","type":"bool"},{"name":"round","type":"uint64"},{"name":"closed","type":"bool"},{"name":"m_minStake","type":"uint64"},{"name":"withdrawalsClosed","type":"bool"},{"name":"nonce","type":"uint128"},{"name":"depositor","type":"address"},{"components":[{"name":"amount","type":"uint128"},{"name":"withdrawValue","type":"uint128"}],"name":"depositors","type":"map(address,tuple)"}]} as const
const tokenRootAbi = {"ABIversion":2,"version":"2.2","header":["pubkey","time","expire"],"functions":[{"name":"constructor","inputs":[{"name":"initialSupplyTo","type":"address"},{"name":"initialSupply","type":"uint128"},{"name":"deployWalletValue","type":"uint128"},{"name":"mintDisabled","type":"bool"},{"name":"burnByRootDisabled","type":"bool"},{"name":"burnPaused","type":"bool"},{"name":"remainingGasTo","type":"address"}],"outputs":[]},{"name":"supportsInterface","inputs":[{"name":"answerId","type":"uint32"},{"name":"interfaceID","type":"uint32"}],"outputs":[{"name":"value0","type":"bool"}]},{"name":"disableMint","inputs":[{"name":"answerId","type":"uint32"}],"outputs":[{"name":"value0","type":"bool"}]},{"name":"mintDisabled","inputs":[{"name":"answerId","type":"uint32"}],"outputs":[{"name":"value0","type":"bool"}]},{"name":"burnTokens","inputs":[{"name":"amount","type":"uint128"},{"name":"walletOwner","type":"address"},{"name":"remainingGasTo","type":"address"},{"name":"callbackTo","type":"address"},{"name":"payload","type":"cell"}],"outputs":[]},{"name":"disableBurnByRoot","inputs":[{"name":"answerId","type":"uint32"}],"outputs":[{"name":"value0","type":"bool"}]},{"name":"burnByRootDisabled","inputs":[{"name":"answerId","type":"uint32"}],"outputs":[{"name":"value0","type":"bool"}]},{"name":"burnPaused","inputs":[{"name":"answerId","type":"uint32"}],"outputs":[{"name":"value0","type":"bool"}]},{"name":"setBurnPaused","inputs":[{"name":"answerId","type":"uint32"},{"name":"paused","type":"bool"}],"outputs":[{"name":"value0","type":"bool"}]},{"name":"transferOwnership","inputs":[{"name":"newOwner","type":"address"},{"name":"remainingGasTo","type":"address"},{"components":[{"name":"value","type":"uint128"},{"name":"payload","type":"cell"}],"name":"callbacks","type":"map(address,tuple)"}],"outputs":[]},{"name":"name","inputs":[{"name":"answerId","type":"uint32"}],"outputs":[{"name":"value0","type":"string"}]},{"name":"symbol","inputs":[{"name":"answerId","type":"uint32"}],"outputs":[{"name":"value0","type":"string"}]},{"name":"decimals","inputs":[{"name":"answerId","type":"uint32"}],"outputs":[{"name":"value0","type":"uint8"}]},{"name":"totalSupply","inputs":[{"name":"answerId","type":"uint32"}],"outputs":[{"name":"value0","type":"uint128"}]},{"name":"walletCode","inputs":[{"name":"answerId","type":"uint32"}],"outputs":[{"name":"value0","type":"cell"}]},{"name":"rootOwner","inputs":[{"name":"answerId","type":"uint32"}],"outputs":[{"name":"value0","type":"address"}]},{"name":"walletOf","inputs":[{"name":"answerId","type":"uint32"},{"name":"walletOwner","type":"address"}],"outputs":[{"name":"value0","type":"address"}]},{"name":"deployWallet","inputs":[{"name":"answerId","type":"uint32"},{"name":"walletOwner","type":"address"},{"name":"deployWalletValue","type":"uint128"}],"outputs":[{"name":"tokenWallet","type":"address"}]},{"name":"mint","inputs":[{"name":"amount","type":"uint128"},{"name":"recipient","type":"address"},{"name":"deployWalletValue","type":"uint128"},{"name":"remainingGasTo","type":"address"},{"name":"notify","type":"bool"},{"name":"payload","type":"cell"}],"outputs":[]},{"name":"acceptBurn","id":"0x192B51B1","inputs":[{"name":"amount","type":"uint128"},{"name":"walletOwner","type":"address"},{"name":"remainingGasTo","type":"address"},{"name":"callbackTo","type":"address"},{"name":"payload","type":"cell"}],"outputs":[]},{"name":"sendSurplusGas","inputs":[{"name":"to","type":"address"}],"outputs":[]}],"data":[{"key":1,"name":"name_","type":"string"},{"key":2,"name":"symbol_","type":"string"},{"key":3,"name":"decimals_","type":"uint8"},{"key":4,"name":"rootOwner_","type":"address"},{"key":5,"name":"walletCode_","type":"cell"},{"key":6,"name":"randomNonce_","type":"uint256"},{"key":7,"name":"deployer_","type":"address"}],"events":[],"fields":[{"name":"_pubkey","type":"uint256"},{"name":"_timestamp","type":"uint64"},{"name":"_constructorFlag","type":"bool"},{"name":"name_","type":"string"},{"name":"symbol_","type":"string"},{"name":"decimals_","type":"uint8"},{"name":"rootOwner_","type":"address"},{"name":"walletCode_","type":"cell"},{"name":"totalSupply_","type":"uint128"},{"name":"burnPaused_","type":"bool"},{"name":"burnByRootDisabled_","type":"bool"},{"name":"mintDisabled_","type":"bool"},{"name":"randomNonce_","type":"uint256"},{"name":"deployer_","type":"address"}]} as const
const tokenRootUpgradeableAbi = {"ABIversion":2,"version":"2.2","header":["pubkey","time","expire"],"functions":[{"name":"constructor","inputs":[{"name":"initialSupplyTo","type":"address"},{"name":"initialSupply","type":"uint128"},{"name":"deployWalletValue","type":"uint128"},{"name":"mintDisabled","type":"bool"},{"name":"burnByRootDisabled","type":"bool"},{"name":"burnPaused","type":"bool"},{"name":"remainingGasTo","type":"address"}],"outputs":[]},{"name":"supportsInterface","inputs":[{"name":"answerId","type":"uint32"},{"name":"interfaceID","type":"uint32"}],"outputs":[{"name":"value0","type":"bool"}]},{"name":"walletVersion","inputs":[{"name":"answerId","type":"uint32"}],"outputs":[{"name":"value0","type":"uint32"}]},{"name":"platformCode","inputs":[{"name":"answerId","type":"uint32"}],"outputs":[{"name":"value0","type":"cell"}]},{"name":"requestUpgradeWallet","inputs":[{"name":"currentVersion","type":"uint32"},{"name":"walletOwner","type":"address"},{"name":"remainingGasTo","type":"address"}],"outputs":[]},{"name":"setWalletCode","inputs":[{"name":"code","type":"cell"}],"outputs":[]},{"name":"upgrade","inputs":[{"name":"code","type":"cell"}],"outputs":[]},{"name":"disableMint","inputs":[{"name":"answerId","type":"uint32"}],"outputs":[{"name":"value0","type":"bool"}]},{"name":"mintDisabled","inputs":[{"name":"answerId","type":"uint32"}],"outputs":[{"name":"value0","type":"bool"}]},{"name":"burnTokens","inputs":[{"name":"amount","type":"uint128"},{"name":"walletOwner","type":"address"},{"name":"remainingGasTo","type":"address"},{"name":"callbackTo","type":"address"},{"name":"payload","type":"cell"}],"outputs":[]},{"name":"disableBurnByRoot","inputs":[{"name":"answerId","type":"uint32"}],"outputs":[{"name":"value0","type":"bool"}]},{"name":"burnByRootDisabled","inputs":[{"name":"answerId","type":"uint32"}],"outputs":[{"name":"value0","type":"bool"}]},{"name":"burnPaused","inputs":[{"name":"answerId","type":"uint32"}],"outputs":[{"name":"value0","type":"bool"}]},{"name":"setBurnPaused","inputs":[{"name":"answerId","type":"uint32"},{"name":"paused","type":"bool"}],"outputs":[{"name":"value0","type":"bool"}]},{"name":"transferOwnership","inputs":[{"name":"newOwner","type":"address"},{"name":"remainingGasTo","type":"address"},{"components":[{"name":"value","type":"uint128"},{"name":"payload","type":"cell"}],"name":"callbacks","type":"map(address,tuple)"}],"outputs":[]},{"name":"name","inputs":[{"name":"answerId","type":"uint32"}],"outputs":[{"name":"value0","type":"string"}]},{"name":"symbol","inputs":[{"name":"answerId","type":"uint32"}],"outputs":[{"name":"value0","type":"string"}]},{"name":"decimals","inputs":[{"name":"answerId","type":"uint32"}],"outputs":[{"name":"value0","type":"uint8"}]},{"name":"totalSupply","inputs":[{"name":"answerId","type":"uint32"}],"outputs":[{"name":"value0","type":"uint128"}]},{"name":"walletCode","inputs":[{"name":"answerId","type":"uint32"}],"outputs":[{"name":"value0","type":"cell"}]},{"name":"rootOwner","inputs":[{"name":"answerId","type":"uint32"}],"outputs":[{"name":"value0","type":"address"}]},{"name":"walletOf","inputs":[{"name":"answerId","type":"uint32"},{"name":"walletOwner","type":"address"}],"outputs":[{"name":"value0","type":"address"}]},{"name":"deployWallet","inputs":[{"name":"answerId","type":"uint32"},{"name":"walletOwner","type":"address"},{"name":"deployWalletValue","type":"uint128"}],"outputs":[{"name":"tokenWallet","type":"address"}]},{"name":"mint","inputs":[{"name":"amount","type":"uint128"},{"name":"recipient","type":"address"},{"name":"deployWalletValue","type":"uint128"},{"name":"remainingGasTo","type":"address"},{"name":"notify","type":"bool"},{"name":"payload","type":"cell"}],"outputs":[]},{"name":"acceptBurn","id":"0x192B51B1","inputs":[{"name":"amount","type":"uint128"},{"name":"walletOwner","type":"address"},{"name":"remainingGasTo","type":"address"},{"name":"callbackTo","type":"address"},{"name":"payload","type":"cell"}],"outputs":[]},{"name":"sendSurplusGas","inputs":[{"name":"to","type":"address"}],"outputs":[]}],"data":[{"key":1,"name":"name_","type":"string"},{"key":2,"name":"symbol_","type":"string"},{"key":3,"name":"decimals_","type":"uint8"},{"key":4,"name":"rootOwner_","type":"address"},{"key":5,"name":"walletCode_","type":"cell"},{"key":6,"name":"randomNonce_","type":"uint256"},{"key":7,"name":"deployer_","type":"address"},{"key":8,"name":"platformCode_","type":"cell"}],"events":[],"fields":[{"name":"_pubkey","type":"uint256"},{"name":"_timestamp","type":"uint64"},{"name":"_constructorFlag","type":"bool"},{"name":"name_","type":"string"},{"name":"symbol_","type":"string"},{"name":"decimals_","type":"uint8"},{"name":"rootOwner_","type":"address"},{"name":"walletCode_","type":"cell"},{"name":"totalSupply_","type":"uint128"},{"name":"burnPaused_","type":"bool"},{"name":"burnByRootDisabled_","type":"bool"},{"name":"mintDisabled_","type":"bool"},{"name":"randomNonce_","type":"uint256"},{"name":"deployer_","type":"address"},{"name":"platformCode_","type":"cell"},{"name":"walletVersion_","type":"uint32"}]} as const
const tokenWalletAbi = {"ABIversion":2,"version":"2.2","header":["pubkey","time","expire"],"functions":[{"name":"constructor","inputs":[],"outputs":[]},{"name":"supportsInterface","inputs":[{"name":"answerId","type":"uint32"},{"name":"interfaceID","type":"uint32"}],"outputs":[{"name":"value0","type":"bool"}]},{"name":"destroy","inputs":[{"name":"remainingGasTo","type":"address"}],"outputs":[]},{"name":"burnByRoot","inputs":[{"name":"amount","type":"uint128"},{"name":"remainingGasTo","type":"address"},{"name":"callbackTo","type":"address"},{"name":"payload","type":"cell"}],"outputs":[]},{"name":"burn","inputs":[{"name":"amount","type":"uint128"},{"name":"remainingGasTo","type":"address"},{"name":"callbackTo","type":"address"},{"name":"payload","type":"cell"}],"outputs":[]},{"name":"balance","inputs":[{"name":"answerId","type":"uint32"}],"outputs":[{"name":"value0","type":"uint128"}]},{"name":"owner","inputs":[{"name":"answerId","type":"uint32"}],"outputs":[{"name":"value0","type":"address"}]},{"name":"root","inputs":[{"name":"answerId","type":"uint32"}],"outputs":[{"name":"value0","type":"address"}]},{"name":"walletCode","inputs":[{"name":"answerId","type":"uint32"}],"outputs":[{"name":"value0","type":"cell"}]},{"name":"transfer","inputs":[{"name":"amount","type":"uint128"},{"name":"recipient","type":"address"},{"name":"deployWalletValue","type":"uint128"},{"name":"remainingGasTo","type":"address"},{"name":"notify","type":"bool"},{"name":"payload","type":"cell"}],"outputs":[]},{"name":"transferToWallet","inputs":[{"name":"amount","type":"uint128"},{"name":"recipientTokenWallet","type":"address"},{"name":"remainingGasTo","type":"address"},{"name":"notify","type":"bool"},{"name":"payload","type":"cell"}],"outputs":[]},{"name":"acceptTransfer","id":"0x67A0B95F","inputs":[{"name":"amount","type":"uint128"},{"name":"sender","type":"address"},{"name":"remainingGasTo","type":"address"},{"name":"notify","type":"bool"},{"name":"payload","type":"cell"}],"outputs":[]},{"name":"acceptMint","id":"0x4384F298","inputs":[{"name":"amount","type":"uint128"},{"name":"remainingGasTo","type":"address"},{"name":"notify","type":"bool"},{"name":"payload","type":"cell"}],"outputs":[]},{"name":"sendSurplusGas","inputs":[{"name":"to","type":"address"}],"outputs":[]}],"data":[{"key":1,"name":"root_","type":"address"},{"key":2,"name":"owner_","type":"address"}],"events":[],"fields":[{"name":"_pubkey","type":"uint256"},{"name":"_timestamp","type":"uint64"},{"name":"_constructorFlag","type":"bool"},{"name":"root_","type":"address"},{"name":"owner_","type":"address"},{"name":"balance_","type":"uint128"}]} as const
const tokenWalletPlatformAbi = {"ABIversion":2,"version":"2.2","header":["time"],"functions":[{"name":"constructor","id":"0x15A038FB","inputs":[{"name":"walletCode","type":"cell"},{"name":"walletVersion","type":"uint32"},{"name":"sender","type":"address"},{"name":"remainingGasTo","type":"address"}],"outputs":[]}],"data":[{"key":1,"name":"root","type":"address"},{"key":2,"name":"owner","type":"address"}],"events":[],"fields":[{"name":"_pubkey","type":"uint256"},{"name":"_timestamp","type":"uint64"},{"name":"_constructorFlag","type":"bool"},{"name":"root","type":"address"},{"name":"owner","type":"address"}]} as const
const tokenWalletUpgradeableAbi = {"ABIversion":2,"version":"2.2","header":["pubkey","time","expire"],"functions":[{"name":"constructor","inputs":[],"outputs":[]},{"name":"supportsInterface","inputs":[{"name":"answerId","type":"uint32"},{"name":"interfaceID","type":"uint32"}],"outputs":[{"name":"value0","type":"bool"}]},{"name":"platformCode","inputs":[{"name":"answerId","type":"uint32"}],"outputs":[{"name":"value0","type":"cell"}]},{"name":"onDeployRetry","id":"0x15A038FB","inputs":[{"name":"value0","type":"cell"},{"name":"value1","type":"uint32"},{"name":"sender","type":"address"},{"name":"remainingGasTo","type":"address"}],"outputs":[]},{"name":"version","inputs":[{"name":"answerId","type":"uint32"}],"outputs":[{"name":"value0","type":"uint32"}]},{"name":"upgrade","inputs":[{"name":"remainingGasTo","type":"address"}],"outputs":[]},{"name":"acceptUpgrade","inputs":[{"name":"newCode","type":"cell"},{"name":"newVersion","type":"uint32"},{"name":"remainingGasTo","type":"address"}],"outputs":[]},{"name":"burnByRoot","inputs":[{"name":"amount","type":"uint128"},{"name":"remainingGasTo","type":"address"},{"name":"callbackTo","type":"address"},{"name":"payload","type":"cell"}],"outputs":[]},{"name":"destroy","inputs":[{"name":"remainingGasTo","type":"address"}],"outputs":[]},{"name":"burn","inputs":[{"name":"amount","type":"uint128"},{"name":"remainingGasTo","type":"address"},{"name":"callbackTo","type":"address"},{"name":"payload","type":"cell"}],"outputs":[]},{"name":"balance","inputs":[{"name":"answerId","type":"uint32"}],"outputs":[{"name":"value0","type":"uint128"}]},{"name":"owner","inputs":[{"name":"answerId","type":"uint32"}],"outputs":[{"name":"value0","type":"address"}]},{"name":"root","inputs":[{"name":"answerId","type":"uint32"}],"outputs":[{"name":"value0","type":"address"}]},{"name":"walletCode","inputs":[{"name":"answerId","type":"uint32"}],"outputs":[{"name":"value0","type":"cell"}]},{"name":"transfer","inputs":[{"name":"amount","type":"uint128"},{"name":"recipient","type":"address"},{"name":"deployWalletValue","type":"uint128"},{"name":"remainingGasTo","type":"address"},{"name":"notify","type":"bool"},{"name":"payload","type":"cell"}],"outputs":[]},{"name":"transferToWallet","inputs":[{"name":"amount","type":"uint128"},{"name":"recipientTokenWallet","type":"address"},{"name":"remainingGasTo","type":"address"},{"name":"notify","type":"bool"},{"name":"payload","type":"cell"}],"outputs":[]},{"name":"acceptTransfer","id":"0x67A0B95F","inputs":[{"name":"amount","type":"uint128"},{"name":"sender","type":"address"},{"name":"remainingGasTo","type":"address"},{"name":"notify","type":"bool"},{"name":"payload","type":"cell"}],"outputs":[]},{"name":"acceptMint","id":"0x4384F298","inputs":[{"name":"amount","type":"uint128"},{"name":"remainingGasTo","type":"address"},{"name":"notify","type":"bool"},{"name":"payload","type":"cell"}],"outputs":[]},{"name":"sendSurplusGas","inputs":[{"name":"to","type":"address"}],"outputs":[]}],"data":[{"key":1,"name":"root_","type":"address"},{"key":2,"name":"owner_","type":"address"}],"events":[],"fields":[{"name":"_pubkey","type":"uint256"},{"name":"_timestamp","type":"uint64"},{"name":"_constructorFlag","type":"bool"},{"name":"root_","type":"address"},{"name":"owner_","type":"address"},{"name":"balance_","type":"uint128"},{"name":"version_","type":"uint32"},{"name":"platformCode_","type":"cell"}]} as const
const walletAbi = {"ABIversion":2,"version":"2.2","header":["pubkey","time","expire"],"functions":[{"name":"sendTransaction","inputs":[{"name":"dest","type":"address"},{"name":"value","type":"uint128"},{"name":"bounce","type":"bool"},{"name":"flags","type":"uint8"},{"name":"payload","type":"cell"}],"outputs":[]},{"name":"transferOwnership","inputs":[{"name":"newOwner","type":"uint256"}],"outputs":[]},{"name":"constructor","inputs":[],"outputs":[]},{"name":"owner","inputs":[],"outputs":[{"name":"owner","type":"uint256"}]},{"name":"_randomNonce","inputs":[],"outputs":[{"name":"_randomNonce","type":"uint256"}]}],"data":[{"key":1,"name":"_randomNonce","type":"uint256"}],"events":[{"name":"OwnershipTransferred","inputs":[{"name":"previousOwner","type":"uint256"},{"name":"newOwner","type":"uint256"}],"outputs":[]}],"fields":[{"name":"_pubkey","type":"uint256"},{"name":"_timestamp","type":"uint64"},{"name":"_constructorFlag","type":"bool"},{"name":"owner","type":"uint256"},{"name":"_randomNonce","type":"uint256"}]} as const

export const factorySource = {
    DepoolStrategyFactory: depoolStrategyFactoryAbi,
    Platform: platformAbi,
    StEverAccount: stEverAccountAbi,
    StEverVault: stEverVaultAbi,
    StrategyDePool: strategyDePoolAbi,
    TestDepool: testDepoolAbi,
    TokenRoot: tokenRootAbi,
    TokenRootUpgradeable: tokenRootUpgradeableAbi,
    TokenWallet: tokenWalletAbi,
    TokenWalletPlatform: tokenWalletPlatformAbi,
    TokenWalletUpgradeable: tokenWalletUpgradeableAbi,
    Wallet: walletAbi
} as const

export type FactorySource = typeof factorySource
export type DepoolStrategyFactoryAbi = typeof depoolStrategyFactoryAbi
export type PlatformAbi = typeof platformAbi
export type StEverAccountAbi = typeof stEverAccountAbi
export type StEverVaultAbi = typeof stEverVaultAbi
export type StrategyDePoolAbi = typeof strategyDePoolAbi
export type TestDepoolAbi = typeof testDepoolAbi
export type TokenRootAbi = typeof tokenRootAbi
export type TokenRootUpgradeableAbi = typeof tokenRootUpgradeableAbi
export type TokenWalletAbi = typeof tokenWalletAbi
export type TokenWalletPlatformAbi = typeof tokenWalletPlatformAbi
export type TokenWalletUpgradeableAbi = typeof tokenWalletUpgradeableAbi
export type WalletAbi = typeof walletAbi
