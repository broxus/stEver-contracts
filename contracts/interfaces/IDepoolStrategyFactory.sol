pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;

interface IDepoolStrategyFactory {
    event NewStrategyDeployed(address strategy, uint32 version);
    event StrategyCodeUpdated(uint32 prevStrategyVersion, uint32 newStrategyVersion);
    function deployStrategy(address strategyOwner,address dePool, address vault) external;
    function installNewStrategyCode(TvmCell strategyCode,address sendGasTo) external; 
}