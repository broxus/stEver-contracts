pragma ton-solidity >=0.61.0;
pragma AbiHeader expire;
import "../~stlib.sol";
interface IVault {
    event StrategyAdded(address strategy);
    event StrategyReported(address strategy, StrategyReport report);
    event Deposit(address user,uint128 depositAmount,uint128 receivedStEvers);
    event WithdrawRequest(address user,uint128 amount,uint64 nonce);
    event WithdrawSuccess(address user,uint128 amount);
    struct Details {
       address stEverRoot;
       address stEverWallet;
       uint128 stEverSupply;
       uint128 everBalance;
       address owner;
    }
    struct StrategyReport {
        uint128 gain;
        uint128 loss;
        uint128 totalAssets;
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
}

