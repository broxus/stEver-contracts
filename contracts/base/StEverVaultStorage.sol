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
    uint128 totalStEverFee;
    // tokens
    address stEverWallet;
    address stTokenRoot;

    // modifiable field
    uint128 gainFee;
    uint32 stEverFeePercent;
    uint128 minStrategyDepositValue = 100 ever;
    uint128 minStrategyWithdrawValue = 100 ever;
    bool isPaused;


    address owner;
    uint32 accountVersion;
    uint32 stEverVaultVersion;
    // mappings
    mapping(address => StrategyParams) public strategies;
    mapping(uint64 => PendingWithdraw) pendingWithdrawals;
    // emergency
    EmergencyState emergencyState;

}
