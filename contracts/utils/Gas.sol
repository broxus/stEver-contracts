pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;

library StEverVaultGas {
    uint128 constant CONTRACT_MIN_BALANCE = 1 ever;
    uint128 constant ST_EVER_WALLET_DEPLOY_GRAMS_VALUE = 0.1 ever;
    uint128 constant EXPEREMENTAL_FEE = 0.2 ever;
	uint128 constant ST_EVER_WALLET_DEPLOY_VALUE = 0.5 ever;
    uint128 constant USER_DATA_DEPLOY_VALUE = 0.2 ever;
    uint128 constant DEPOSIT_FEE = 1 ever;
    uint128 constant MIN_CALL_MSG_VALUE = 1 ton;
    uint128 constant WITHDRAW_FEE = 1 ever;
    uint128 constant WITHDRAW_FEE_FOR_USER_DATA = 1 ever;
    uint128 constant SEND_SELF_VALUE = 1 ever;
    uint128 constant HANDLING_STRATEGY_CB_FEE = 0.03 ever;
    uint128 constant MIN_WITHDRAW_FROM_STRATEGY_FEE = 0.6 ever;
}

library StEverAccountGas {
    uint128 constant CONTRACT_MIN_BALANCE = 0.1 ton;
}