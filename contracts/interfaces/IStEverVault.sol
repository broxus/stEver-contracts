pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;


interface IStEverVault {
    event AdminDeposited(uint128 amount);
    
    event StrategyAdded(address strategy);
    event StrategyRemoved(address strategy);

    event StrategyReported(address strategy, StrategyReport report);

    event StrategyHandledDeposit(address strategy, uint128 depositValue);
    event StrategyDidntHandleDeposit(address strategy, uint32 errcode);

    event StrategyHandledWithdrawRequest(address strategy, uint128 amount);
    event StrategyWithdrawSuccess(address strategy, uint128 amount);
    event StrategyWithdrawError(address strategy, uint32 errcode);

    event Deposit(address user, uint128 depositAmount, uint128 receivedStEvers);

    event WithdrawRequest(address user, uint128 amount, uint64 nonce);
    event WithdrawRequestRemoved(address user, uint64 nonce);
    event BadWithdrawRequest(address user, uint128 amount, uint128 attachedValue);
    event WithdrawError(address user, uint64[] nonces, uint128 amount); 
    event WithdrawSuccess(address user, uint128 amount, uint64[] nonces);

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
        address strategy;
        uint128 amount;
        uint128 fee;
    }

    struct DepositConfig {
        address strategy;
        uint128 amount;
        uint128 fee;
    }

    struct SendToUserConfig {
        address user;
        uint64[] nonces;
    }
    struct ValidationResult {
        address strategy;
        uint16 errCode;
    }

    function initVault(address stTokenRoot) external;
    function getDetails() external responsible view returns(Details);
    // strategy
    function addStrategy(address strategy) external;
    function removeStrategy(address _strategy) external;
    function deposit(uint128 amount, uint64 nonce) external;
    function processWithdrawFromStrategies(mapping(uint256 => WithdrawConfig) withdrawConfig) external;
    function processSendToUsers(mapping(uint256 =>SendToUserConfig) sendConfig) external;
    function strategyReport(uint128 gain, uint128 loss, uint128 totalAssets,uint128 requestedValue) external;
    function removePendingWithdraw(uint64 nonce) external;
    function depositToStrategies(mapping(uint256 => DepositConfig ) depositConfig) external;
    function onStrategyHandledDeposit() external;
    function onStrategyHandledWithdrawRequest() external;
    function onStrategyDidntHandleDeposit(uint32 errcode) external;
    function receiveFromStrategy() external;
    function withdrawFromStrategyError(uint32 errcode) external;
    function withdrawToUser(uint128 amount, address user, uint128[] amountsWithdraw, uint64[] noncesWithdrawn) external;
    // validators
    function validateDepositRequest(mapping (uint256 => DepositConfig) _depositConfigs) external view returns(ValidationResult[]);
    function validateWithdrawFromStrategiesRequest(mapping (uint256 => WithdrawConfig) _withdrawConfig) external view returns (ValidationResult[]);
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
    // ownership
    function transferOwnership(address _newOwner, address _sendGasTo) external;
    function transferGovernance(uint256 _newGovernance, address _sendGasTo) external;
    // upgrade
    function upgrade(TvmCell _newCode, uint32 _newVersion, address _sendGasTo) external;
}

