pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;
import "./IStEverAccount.sol";


interface IStEverVault {
    // Strategy 
    event StrategyAdded(address strategy);
    event StrategyRemoved(address strategy);
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
        // Withdraw extra money from strategies
    event ProcessWithdrawExtraMoneyFromStrategyError(address strategy, uint16 ercode);
    event ReceiveExtraMoneyFromStrategy(address strategy, uint128 value);

    // User interaction
    event Deposit(address user, uint128 depositAmount, uint128 receivedStEvers);
    event WithdrawRequest(address user, uint128 amount, uint64 nonce);
    event WithdrawRequestRemoved(address user, uint64 nonce);
    event BadWithdrawRequest(address user, uint128 amount, uint128 attachedValue);
    event WithdrawError(address user, mapping(uint64 => WithdrawToUserInfo) withdrawInfo, uint128 amount); 
    event WithdrawSuccess(address user, uint128 amount, mapping(uint64 => WithdrawToUserInfo) withdrawInfo);



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
       uint8 stEverFeePercent;
       uint128 totalStEverFee;
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
        address emitter;
        uint64 emitTimestamp;
    }

    function initVault(address stTokenRoot) external;
    function getDetails() external responsible view returns(Details);
    // strategy
    function addStrategy(address strategy) external;
    function removeStrategy(address _strategy) external;

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

    // validators
    function validateDepositRequest(mapping (address => DepositConfig) _depositConfigs) external view returns(ValidationResult[]);
    function validateWithdrawFromStrategiesRequest(mapping (address => WithdrawConfig) _withdrawConfig) external view returns (ValidationResult[]);

    // account
    function onPendingWithdrawAccepted(uint64 nonce, address user) external;
    function onPendingWithdrawRejected(uint64 nonce, address user, uint128 amount) external;
    function onPendingWithdrawRemoved(address user, uint64 nonce, uint128 amount) external;

    // utils
    function encodeDepositPayload(address deposit_owner, uint64 nonce) external pure returns (TvmCell deposit_payload);

    // setters
    function setGainFee(uint128 _gainFee) external;
    function setMinStrategyDepositValue(uint128 minStrategyDepositValue) external;
    function setMinStrategyWithdrawValue(uint128 minStrategyWithdrawValue) external;
    function setStEverFeePercent(uint8 _stEverFeePercent) external;

    // ownership
    function transferOwnership(address _newOwner, address _sendGasTo) external;
    function transferGovernance(uint256 _newGovernance, address _sendGasTo) external;

    // emergency
    function emergencyWithdrawProcess(address _user, mapping (address => WithdrawConfig) _emergencyWithdrawConfig) external;
    function getEmergencyWithdrawConfig() external responsible view returns(mapping (address => WithdrawConfig));
    function _processEmergencyWithdraw(address _user, mapping (address => WithdrawConfig) _emergencyWithdrawConfig) external;
    // upgrade
    function upgrade(TvmCell _newCode, uint32 _newVersion, address _sendGasTo) external;
}

