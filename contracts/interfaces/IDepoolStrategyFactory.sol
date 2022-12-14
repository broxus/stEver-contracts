pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;

interface IDepoolStrategyFactory {
    event NewStrategyDeployed(address strategy,address dePool, uint32 version);
    event StrategyCodeUpdated(uint32 prevStrategyVersion, uint32 newStrategyVersion);

    struct FactoryDetails {
        address stEverVault;
        address owner;
        uint32 strategyVersion;
        uint32 strategyCount;
        uint32 factoryVersion;
    }
    
    function getDetails() external responsible view returns (FactoryDetails);
    function deployStrategy(address dePool) external;
    function installNewStrategyCode(TvmCell strategyCode,address sendGasTo) external;
    function upgradeStrategies(address[] _strategies) external;
    function upgrade(TvmCell _newCode, uint32 _newVersion, address _sendGasTo) external;
    function transferOwnership(address _newOwner, address _sendGasTo) external;
    
}
