pragma ever-solidity >=0.62.0;


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
    mapping(uint64 => PendingWithdraw) pendingWithdrawals;
}
