pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;

interface IStrategy {
    event Deposit(uint128 amount);
    event Withdraw(uint128 amount);
    struct Details {
        address vault;
    }
    function getDetails() external responsible view returns(Details);
    function deposit(uint128 amount) external;
    function withdraw(uint128 amount) external;
}