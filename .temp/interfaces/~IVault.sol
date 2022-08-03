pragma ton-solidity >=0.61.0;
pragma AbiHeader expire;
interface IVault {
    event StrategyAdded(address strategy);
    event StrategyReported(address strategy, StrategyReport report);
    event StrategyHandledDeposit(address strategy,uint128 returnedFee);
    event StrategyDidintHandleDeposit(address strategy,uint128 attachedAmount);
    event StrategyWithdrawSuccess(address strategy,uint128 amount);
    event Deposit(address user,uint128 depositAmount,uint128 receivedStEvers);
    event WithdrawRequest(address user,uint128 amount,uint64 nonce);
    event BadWithdrawRequest(address user,uint128 amount,uint128 attachedValue);
    event WithdrawError(address user,uint64 nonce,uint128 amount); 
    event WithdrawSuccess(address user,uint128 amount);
    struct Details {
       address stEverRoot;
       address stEverWallet;
       uint128 stEverSupply;
       uint128 everBalance;
       uint128 availableEverBalance;
       address owner;
    }
    struct StrategyReport {
        uint128 gain;
        uint128 loss;
        uint128 totalAssets;
    }
    struct StrategyParams {
        uint128 lastReport;
        uint128 totalGain;
        uint128 totalAssets;
        uint128 depositingAmount;    
    }

    struct PendingWithdraw {
        uint128 amount;
        address user;
    }

    struct BalancingConfig {
        address strategy;
        uint128 deposit;
        uint128 withdraw;
    }

    struct WithdrawConfig {
        address strategy;
        uint128 amount;
        uint128 fee;
    }

    struct DepositConfig {
        address strategy;
        uint128 amount;
    }

    struct SendToUserConfig {
        address user;
        uint64[] nonces;
    }

    struct DumpWithdraw {
        uint128 amount;
        uint64 nonce;
    }
    function initVault(address _stTtokenRoot) external;
    function getDetails() external responsible view returns(Details);
    function addStrategy(address strategy) external;
    function deposit(uint128 _amount,uint64 _nonce) external;
    function onRunBalancer(BalancingConfig[] balancerConfig) external;
    function processWithdrawFromStrategies(WithdrawConfig[] withdrawConfig) external;
    function processSendToUser(SendToUserConfig[] sendConfig) external;
    function strategyReport(uint128 gain, uint128 loss, uint128 totalAssets) external;
    function onPendingWithdrawAccepted(uint64 nonce,address user) external;
    function encodeDepositPayload(address deposit_owner, uint64 nonce) external pure returns (TvmCell deposit_payload);
    function withdrawToUser(uint128 amount,address user,DumpWithdraw[] withdrawDump) external;
    function depositToStrategies(DepositConfig[] depositConfig) external;
    function onStrategyHandledDeposit() external;
    function onStrategyDidntHandleDeposit() external;
    function receiveFromStrategy(uint128 fee) external;
    function strategyBalanceUpdated(uint128 update,bool isIncreased) external;
}

