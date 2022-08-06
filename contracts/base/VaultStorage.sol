pragma ton-solidity >=0.61.0;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "../interfaces/IVault.sol";

abstract contract VaultStorage is IVault {
    // constant
    uint128 constant CONTRACT_MIN_BALANCE = 1 ever;
    uint128 constant ST_EVER_WALLET_DEPLOY_GRAMS_VALUE = 0.1 ever;
    uint128 constant EXPEREMENTAL_FEE = 0.2 ever;
	uint128 constant ST_EVER_WALLET_DEPLOY_VALUE = 0.5 ever;
    uint128 constant USER_DATA_DEPLOY_VALUE = 0.2 ever;
    uint128 constant DEPOSIT_FEE = 1 ever;
    uint128 constant WITHDRAW_FEE_FOR_GOVERNANCE = 1 ever;
    uint128 constant WITHDRAW_FEE_FOR_USER_DATA = 1 ever;
    uint128 constant SEND_SELF_VALUE = 1 ever;

    // static
    uint128 public static nonce;
    uint256 static governance;
    // balances
    uint128 stEverSupply;
    uint128 totalAssets;
    uint128 availableAssets;
    // tokens
    address stEverWallet;
    address stTokenRoot;

    // modifiebale fileds
    uint128 gainFee;
    // TODO is this feeld needs?
    uint128 depositFee;

    address owner;
    TvmCell public withdrawUserDataCode;
    // mappings
    mapping(address => StrategyParams) public strategies;
    mapping(uint64 => PendingWithdraw) pendingWithdrawMap;

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
}
