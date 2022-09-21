pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;

library Constants {
    // common
    uint8 constant ONE_HUNDRED_PERCENT = 100;
    uint128 constant MIN_TRANSACTION_VALUE = 0.01 ever;
    // StEverVault
    uint128 constant INITIAL_AVAILABLE_ASSETS = 100 ever;
    uint128 constant DEPLOY_VAULT_FEE = 1 ever;
        // Emergency
    uint64 constant EMERGENCY_DURATION = 60 * 60; //1 hour
}