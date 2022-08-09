pragma ever-solidity >=0.62.0;
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
    function resetPendingValues(uint128[] _amountWithdrawn, uint64[] _noncesWithdrawn) external;
    function removePendingWithdraw(uint64 _nonce) external;
}