pragma ever-solidity >=0.61.0;
pragma AbiHeader expire;


interface IDePool {
    function addOrdinaryStake(uint64 stake) external;
    function withdrawFromPoolingRound(uint64 withdrawValue) external;
    function withdrawPart(uint64 withdrawValue) external;
    function withdrawAll() external;
    // mock methods
    function roundCompelte(uint64 _reward) external;
}
