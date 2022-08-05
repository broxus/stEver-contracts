pragma ton-solidity >=0.61.0;
pragma AbiHeader expire;

interface IWithdrawUserData {
    event Receive(uint128 amount);
    struct UserDataDetails {
        uint128 pendingReturnedTokens;
        uint128 pendingReceiveEver;
        address user;
    }

    function getDetails() external responsible view returns (UserDataDetails);
    function addPendingValue(uint64 _nonce,uint128 amount) external;
    function processWithdraw(uint64[] _satisfiedWithdrawRequests) external;
}