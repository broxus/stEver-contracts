pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;

library Constants {
    // common
    uint8 constant ONE_HUNDRED_PERCENT = 100;
    uint128 constant MIN_TRANSACTION_VALUE = 0.01 ever;
    uint64 constant MAX_UINT_64 = 2**64 - 1;
    // StEverVault
    uint128 constant INITIAL_AVAILABLE_ASSETS = 100 ever;
    uint128 constant DEPLOY_VAULT_FEE = 1 ever;
        // Emergency
    uint64 constant EMERGENCY_DURATION = 60 * 60; //1 hour
    uint64 constant TIME_AFTER_EMERGENCY_CAN_BE_ACTIVATED = 60 * 60 * 90; //90 hours 
}