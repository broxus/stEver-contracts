pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;

interface IStrategy {
    event Deposit(uint128 amount);
    event Withdraw(uint128 amount);

    function deposit(uint128 amount) external;
    function withdraw(uint128 amount) external;
    function withdrawExtraMoney() external;
    function withdrawForce(uint64 _amount) external;
    // upgrade
    function upgrade(TvmCell _newCode, uint32 _newVersion, address _sendGasTo) external;
}
