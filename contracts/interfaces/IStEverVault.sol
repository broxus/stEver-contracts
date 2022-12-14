pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;
import "./IStEverAccount.sol";


interface IStEverVault {
    // common
    event PausedStateChanged(bool pauseState);
    // Strategy
    event StrategiesAdded(address[] strategy);
    event StrategiesRemoved(address[] strategy);
    event StrategyReported(address strategy, StrategyReport report);

    // Strategy deposit
    event StrategyHandledDeposit(address strategy, uint128 depositValue);
    event StrategyDidntHandleDeposit(address strategy, uint32 errcode);
    event ProcessDepositToStrategyError(address strategy, uint16 errcode);

    // Strategy withdraw
    event StrategyHandledWithdrawRequest(address strategy, uint128 amount);
    event StrategyWithdrawSuccess(address strategy, uint128 amount);
    event StrategyWithdrawError(address strategy, uint32 errcode);
    event ProcessWithdrawFromStrategyError(address strategy, uint16 errcode);
    event ReceiveAdditionalTransferFromStrategy(address strategy, uint128 amount);
        // Withdraw extra ever from strategies
    event ProcessWithdrawExtraMoneyFromStrategyError(address strategy, uint16 ercode);
    event ReceiveExtraMoneyFromStrategy(address strategy, uint128 value);

    // Withdraw extra ever from vault
    event SuccessWithdrawExtraEver(uint128 value);

    // User interaction
    event Deposit(address user, uint128 depositAmount, uint128 receivedStEvers);
    event WithdrawRequest(address user, uint128 amount, uint64 nonce);
    event WithdrawRequestRemoved(address user, uint64 nonce);
    event BadWithdrawRequest(address user, uint128 amount, uint128 attachedValue);
    event WithdrawError(address user, mapping(uint64 => WithdrawToUserInfo) withdrawInfo, uint128 amount);
    event WithdrawSuccess(address user, uint128 amount, mapping(uint64 => WithdrawToUserInfo) withdrawInfo);

    // Upgrade
    event NewAccountCodeSet(uint32 newVersion);
    event AccountUpgraded(address user, uint32 newVersion);
    // Emergency
    event EmergencyProcessStarted(address emitter);
    event EmergencyProcessRejectedByAccount(address emitter, uint16 errcode);
    event EmergencyStatePaused();
    event EmergencyStateContinued();
    event EmergencyStopped();



    event WithdrawFee(uint128 amount);

    struct Details {
        address stTokenRoot;
        address stEverWallet;
        uint128 stEverSupply;
        uint128 totalAssets;
        uint128 availableAssets;
        address owner;
        uint256 governance;
        uint128 gainFee;
        uint32 accountVersion;
        uint32 stEverVaultVersion;
        uint128 minStrategyDepositValue;
        uint128 minStrategyWithdrawValue;
        bool isPaused;
        uint32 stEverFeePercent;
        uint128 totalStEverFee;
        EmergencyState emergencyState;
    }
    struct StrategyReport {
        uint128 gain;
        uint128 loss;
        uint128 totalAssets;
    }
    struct StrategyParams {
        uint128 lastReport;
        uint128 totalGain;
        uint128 depositingAmount;
        uint128 withdrawingAmount;
    }

    struct PendingWithdraw {
        uint128 amount;
        address user;
        address remainingGasTo;
    }

    struct WithdrawConfig {
        uint128 amount;
        uint128 fee;
    }

    struct DepositConfig {
        uint128 amount;
        uint128 fee;
    }

    struct SendToUserConfig {
        uint64[] nonces;
    }

    struct WithdrawToUserInfo {
        uint128 stEverAmount;
        uint128 everAmount;
    }
    struct ValidationResult {
        address strategy;
        uint16 errCode;
    }

    struct EmergencyState {
        bool isEmergency;
        bool isPaused;
        address emitter;
        uint64 emitTimestamp;
    }

    function getDetails() external responsible view returns(Details);
    // strategy
    function addStrategies(address[] _strategies) external;
    function removeStrategies(address[] _strategy) external;

    function strategyReport(uint128 gain, uint128 loss, uint128 totalAssets,uint128 requestedValue) external;


    // Deposit to strategy
    function depositToStrategies(mapping(address => DepositConfig ) depositConfig) external;
    function onStrategyHandledDeposit() external;

    // Withdraw from strategies
    function processWithdrawFromStrategies(mapping(address => WithdrawConfig) withdrawConfig) external;
    function onStrategyHandledWithdrawRequest() external;
    function onStrategyDidntHandleDeposit(uint32 errcode) external;
    function receiveFromStrategy() external;
    function receiveAdditionalTransferFromStrategy() external;
    function withdrawFromStrategyError(uint32 errcode) external;
    function forceWithdrawFromStrategies(mapping (address => WithdrawConfig) _withdrawConfig) external;

    // User interactions
    function withdrawToUser(uint128 amount, address user, mapping(uint64 => IStEverAccount.WithdrawRequest) withdrawals) external;
    function removePendingWithdraw(uint64 nonce) external;
    function deposit(uint128 amount, uint64 nonce) external;

    // Withdraw to user
    function processSendToUsers(mapping(address => SendToUserConfig) sendConfig) external;

    // extra money from strategy
    function processWithdrawExtraMoneyFromStrategies(address[] _strategies) external;
    function receiveExtraMoneyFromStrategy() external;

    // withdraw fee
    function withdrawStEverFee(uint128 _amount) external;

    // withdraw extra ever
    function withdrawExtraEver() external;

    // validators
    function validateDepositRequest(mapping (address => DepositConfig) _depositConfigs) external view returns(ValidationResult[]);
    function validateWithdrawFromStrategiesRequest(mapping (address => WithdrawConfig) _withdrawConfig) external view returns (ValidationResult[]);

    // account
    function onPendingWithdrawAccepted(uint64 nonce,address user, address remainingGasTo) external;
    function onPendingWithdrawRejected(uint64 nonce, address user, uint128 amount, address remainingGasTo) external;
    function onPendingWithdrawRemoved(address user, uint64 nonce, uint128 amount) external;

    // utils
    function encodeDepositPayload(uint64 nonce) external pure returns (TvmCell deposit_payload);

    // setters
    function setGainFee(uint128 _gainFee) external;
    function setMinStrategyDepositValue(uint128 minStrategyDepositValue) external;
    function setMinStrategyWithdrawValue(uint128 minStrategyWithdrawValue) external;
    function setStEverFeePercent(uint32 _stEverFeePercent) external;
    function setIsPaused(bool isPaused) external;

    // ownership
    function transferOwnership(address _newOwner, address _sendGasTo) external;
    function transferGovernance(uint256 _newGovernance, address _sendGasTo) external;

    // emergency
    function startEmergencyProcess(uint64 _poofNonce) external;
    function changeEmergencyPauseState(bool _isPaused) external;
    function stopEmergencyProcess() external;
    function startEmergencyRejected(address _user, uint16 errcode) external;
    function emergencyWithdrawFromStrategiesProcess(address _user) external;
    function _processEmergencyWithdrawFromStrategy(address _user, optional(address, StrategyParams) _startPair) external;
    function emergencyWithdrawToUser() external;
    // upgrade
    function upgrade(TvmCell _newCode, uint32 _newVersion, address _sendGasTo) external;
    function setNewAccountCode(TvmCell _newAccountCode) external;
    function upgradeStEverAccount() external;
    function upgradeStEverAccounts(address _sendGasTo, address[] _users) external;
    function _upgradeStEverAccounts(address _sendGasTo, address[] _users, uint128 _startIdx) external;
    function onAccountUpgraded(address user, address sendGasTo, uint32 newVersion) external;
}

