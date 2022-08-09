pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;


library StEverVaultConstants {
    uint128 constant MIN_STRATEGY_DEPOSIT_VALUE = 100 ever;
    uint128 constant MIN_STRATEGY_WITHDRAW_VALUE = 100 ever;
    uint128 constant MIN_USER_DEPOSIT_VALUE = 10 ever;
    uint128 constant MIN_USER_WITHDRAW_VALUE = 5 ever;
}