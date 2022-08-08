pragma ever-solidity >=0.61.0;


import "../interfaces/IVault.sol";

abstract contract VaultStorage is IVault {
    // TODO: move to library
    // constant
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

    // static
    uint128 public static nonce;
    uint256 static governance;
    TvmCell static platformCode;
    TvmCell static accountCode;
    // balances
    uint128 stEverSupply;
    uint128 totalAssets;
    uint128 availableAssets;
    // tokens
    address stEverWallet;
    address stTokenRoot;

    // modifiable field
    uint128 gainFee;

    address owner;
    uint32 accountVersion;
    // mappings
    mapping(address => StrategyParams) public strategies;
    // TODO: dont specify type in name e.g remove Map from name
    mapping(uint64 => PendingWithdraw) pendingWithdrawMap;

    // TODO: move to library
    // errors
    uint8 constant NOT_GOVERNANCE = 101;
    uint8 constant BAD_WITHDRAW_CONFIG = 102;
    uint8 constant NOT_ENOUGH_VALUE = 103;
    uint8 constant ONLY_ONE_VALUE_MOVE_PER_STEP = 104;
    uint8 constant NOT_ROOT_WALLET = 105;
    uint8 constant NOT_ENOUGH_ST_EVER = 106;
    uint8 constant STRATEGY_NOT_EXISTS = 107;
    uint8 constant NOT_ENOUGH_WITHDRAW_FEE = 108;
    uint8 constant NOT_ENOUGH_DEPOSIT_VALUE = 109;
    uint8 constant CANT_DEPOSIT_UNTILS_STRATEGY_IN_DEPOSIT_STATE = 110;
    uint8 constant NOT_USER_DATA = 111;
    uint8 constant LOW_MSG_VALUE = 112;
    uint8 constant NOT_ENOUGH_VALUE_TO_DEPOSIT = 113;
    uint8 constant NOT_ENOUGH_VALUE_TO_WITHDRAW = 114;
}
