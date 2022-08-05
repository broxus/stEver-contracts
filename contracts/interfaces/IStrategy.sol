pragma ton-solidity >=0.61.0;
pragma AbiHeader expire;

interface IStrategy {
    event Deposit(uint256 amount);
    event Withdraw(uint256 amount);
    struct Details {
        address vault;
    }
    function getDetails() external responsible view returns(Details);
    function deposit(uint64 amount) external;
    function withdraw(uint64 amount,uint128 fee) external;
}