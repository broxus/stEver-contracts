pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;

interface IDepoolStrategyFactory {
    event NewStrategyDeployed(address strategy, uint32 version);
    event StrategyCodeUpdated(uint32 prevStrategyVersion, uint32 newStrategyVersion);
    function deployStrategy(address dePool) external;
    function installNewStrategyCode(TvmCell strategyCode,address sendGasTo) external; 
    function upgradeStrategy(address _strategy) external;
    function upgrade(TvmCell _newCode, uint32 _newVersion, address _sendGasTo) external;
    function transferOwnership(address _newOwner, address _sendGasTo) external;
}