pragma ton-solidity >=0.61.0;
pragma AbiHeader expire;

interface IDepoolStrategyFactory {
    event StrategyCodeUpdated(uint32 prevStrategyVersion, uint32 newStrategyVersion);
    function deployStrategy(address strategyOwner,address dePool, address vault) external returns (address);
    function installNewStrategyCode(TvmCell strategyCode,address sendGasTo) external; 
}