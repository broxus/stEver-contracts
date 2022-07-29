pragma ton-solidity >=0.61.0;
pragma AbiHeader expire;

struct StrategyParams {
    uint128 lastReport;
    uint128 totalGain;
    uint128 totalAssets;    
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
}

struct SendToUserConfig {
    address user;
    uint64[] nonces;
}