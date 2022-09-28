pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;

library ErrorCodes {
    // Vault
    uint16 constant WRONG_PUB_KEY = 1000;
    uint16 constant NOT_OWNER = 1001;
    uint16 constant NOT_GOVERNANCE = 1002;
    uint16 constant BAD_WITHDRAW_CONFIG = 1003;
    uint16 constant NOT_ENOUGH_VALUE = 1004;
    uint16 constant ONLY_ONE_VALUE_MOVE_PER_STEP = 1005;
    uint16 constant NOT_ROOT_WALLET = 1006;
    uint16 constant NOT_ENOUGH_ST_EVER = 1007;
    uint16 constant STRATEGY_NOT_EXISTS = 1008;
    uint16 constant NOT_ENOUGH_WITHDRAW_FEE = 1009;
    uint16 constant NOT_ENOUGH_DEPOSIT_VALUE = 1010;
    uint16 constant STRATEGY_IN_DEPOSITING_STATE = 1011;
    uint16 constant STRATEGY_IN_WITHDRAWING_STATE = 1012;
    uint16 constant STRATEGY_NOT_IN_INITIAL_STATE = 1013;
    uint16 constant NOT_USER_DATA = 1014;
    uint16 constant LOW_MSG_VALUE = 1015;
    uint16 constant NOT_ENOUGH_VALUE_TO_DEPOSIT = 1016;
    uint16 constant NOT_ENOUGH_VALUE_TO_WITHDRAW = 1017;
    uint16 constant BAD_DEPOSIT_TO_STRATEGY_VALUE = 1018;
    uint16 constant BAD_WITHDRAW_FROM_STRATEGY_VALUE = 1019;
    uint16 constant BAD_ADMIN_DEPOSIT_VALUE = 1020;
    uint16 constant BAD_FEE_PERCENT = 1021;
    uint16 constant NOT_ENOUGH_ST_EVER_FEE = 1022;
    uint16 constant NOT_ENOUGH_AVAILABLE_ASSETS = 1023;
    uint16 constant EMERGENCY_ALREADY_RUN = 1024;
    uint16 constant NOT_EMERGENCY_STATE = 1025;
    uint16 constant NOT_SELF = 1026;
    uint16 constant AVAILABLE_ASSETS_SHOULD_GT_TOTAL_ASSETS = 1027;
    uint16 constant NOT_ENOUGH_TOTAL_ASSETS = 1028;
    uint16 constant ST_EVER_VAULT_PAUSED = 1029;


    // StEverAccount
    uint16 constant ONLY_VAULT = 2001;
    uint16 constant RECEIVED_BAD_VALUE = 2002;
    uint16 constant REQUEST_NOT_EXISTS = 2003;
    uint16 constant EMERGENCY_CANT_BE_ACTIVATED = 2004;

    // Strategy
    uint16 constant NOT_VAULT = 3001;
    uint16 constant NOT_DEPOOL = 3002;
    uint16 constant NOT_DEPOOL_OR_VAULT = 3003;
    uint16 constant BAD_DEPOSIT_VALUE = 3004;
    uint16 constant NOT_FABRIC = 3005;

    // DePoolStrategyFactory
    uint16 constant MAX_STRATEGY_THAN_ALLOWED = 4001;
    uint16 constant NOT_ENOUGH_VALUE_FACTORY = 4002;

}
