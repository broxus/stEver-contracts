pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;

library Constants {
    // common
    uint32 constant ONE_HUNDRED_PERCENT = 1_000;
    uint128 constant MIN_TRANSACTION_VALUE = 0.01 ever;
    uint64 constant MAX_UINT_64 = 2**64 - 1;
    // StEverVault
    uint128 constant INITIAL_AVAILABLE_ASSETS = 100 ever;
    uint128 constant DEPLOY_VAULT_FEE = 1 ever;
        // Emergency
    uint64 constant EMERGENCY_DURATION = 1 hours;
    uint64 constant TIME_AFTER_EMERGENCY_CAN_BE_ACTIVATED = 168 hours;
    // DePooLStrategyFactory
    uint128 constant MAX_STRATEGY_PER_UPGRADE = 50;
}
