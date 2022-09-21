pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;

import "../interfaces/IStEverVault.sol";

interface IStEverAccount {
    event Receive(uint128 amount);
    struct AccountDetails {
        address user;
        address vault;
    }

    struct WithdrawRequest {
        uint128 amount;
        uint64 timestamp;
    }

    function getDetails() external responsible view returns (AccountDetails);
    function addPendingValue(uint64 _nonce, uint128 amount) external;
    function processWithdraw(uint64[] _satisfiedWithdrawRequests) external;
    function resetPendingValues(mapping(uint64 => WithdrawRequest) rejectedWithdrawals) external;
    function removePendingWithdraw(uint64 _nonce) external;
    // emergency
    function onEmergencyWithdrawStart() external;
}
