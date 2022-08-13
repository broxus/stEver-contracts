pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;

library ErrorCodes {
    // Vault
    uint16 constant NOT_GOVERNANCE = 1001;
    uint16 constant BAD_WITHDRAW_CONFIG = 1002;
    uint16 constant NOT_ENOUGH_VALUE = 1003;
    uint16 constant ONLY_ONE_VALUE_MOVE_PER_STEP = 1004;
    uint16 constant NOT_ROOT_WALLET = 1005;
    uint16 constant NOT_ENOUGH_ST_EVER = 1006;
    uint16 constant STRATEGY_NOT_EXISTS = 1007;
    uint16 constant NOT_ENOUGH_WITHDRAW_FEE = 1008;
    uint16 constant NOT_ENOUGH_DEPOSIT_VALUE = 1009;
    uint16 constant STRATEGY_IN_DEPOSITING_STATE = 1010;
    uint16 constant STRATEGY_IN_WITHDRAWING_STATE = 1011;
    uint16 constant NOT_USER_DATA = 1012;
    uint16 constant LOW_MSG_VALUE = 1013;
    uint16 constant NOT_ENOUGH_VALUE_TO_DEPOSIT = 1014;
    uint16 constant NOT_ENOUGH_VALUE_TO_WITHDRAW = 1015;
    uint16 constant BAD_DEPOSIT_TO_STRATEGY_VALUE = 1016;
    uint16 constant BAD_WITHDRAW_FROM_STRATEGY_VALUE = 1017;
    uint16 constant BAD_ADMIN_DEPOSIT_VALUE = 1018;

    // StEverAccount
    uint16 constant ONLY_VAULT = 2001;
    uint16 constant RECEIVED_BAD_VALUE = 2002;
    uint16 constant REQUEST_NOT_EXISTS = 2003;

    // Strategy
    uint16 constant NOT_VAULT = 3001;
    uint16 constant NOT_DEPOOL = 3002;
    uint16 constant NOT_DEPOOL_OR_VAULT = 3003;
    uint16 constant BAD_DEPOSIT_VALUE = 3004;
    uint16 constant NOT_FABRIC = 3005;
}