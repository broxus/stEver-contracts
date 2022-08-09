pragma ever-solidity >=0.62.0;


import "../interfaces/IStEverVault.sol";

abstract contract StEverVaultStorage is IStEverVault {

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
