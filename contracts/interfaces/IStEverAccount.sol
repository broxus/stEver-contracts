pragma ton-solidity >=0.61.0;
pragma AbiHeader expire;

import "../interfaces/IVault.sol";

interface IStEverAccount {
    event Receive(uint128 amount);
    struct AccountDetails {
        uint128 pendingReturnedTokens;
        uint128 pendingReceiveEver;
        address user;
    }

    function getDetails() external responsible view returns (AccountDetails);
    function addPendingValue(uint64 _nonce,uint128 amount) external;
    function processWithdraw(uint64[] _satisfiedWithdrawRequests) external;
    function resetPendingValues(IVault.DumpWithdraw[] dump) external;
    function removePendingWithdraw(uint64 _nonce) external;
}