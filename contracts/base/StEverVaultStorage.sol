pragma ever-solidity >=0.62.0;


import "../interfaces/IStEverVault.sol";

abstract contract StEverVaultStorage is IStEverVault {

    // static
    uint128 public static nonce;
    address static stTokenRoot;
    uint256 static governance;
    TvmCell static platformCode;
    TvmCell static accountCode;
    // balances
    uint128 stEverSupply;
    uint128 totalAssets;
    uint128 availableAssets;
//    TODO rename to totalStEverVaultFee
    uint128 totalStEverFee;
    // tokens
    address stEverWallet;

    // modifiable field
    uint128 gainFee;
//    TODO rename to stEverVaultFeePercent
    uint8 stEverFeePercent;
    uint128 minStrategyDepositValue = 100 ever;
    uint128 minStrategyWithdrawValue = 100 ever;


    address owner;
    uint32 accountVersion;
    uint32 stEverVaultVersion;
    // mappings
    mapping(address => StrategyParams) public strategies;
    mapping(uint64 => PendingWithdraw) pendingWithdrawals;
    // emergency
    EmergencyState emergencyState;

}
