pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;


interface IDePool {
    function addOrdinaryStake(uint64 stake) external;
    function withdrawFromPoolingRound(uint64 withdrawValue) external;
    function withdrawPart(uint64 withdrawValue) external;
    function withdrawAll() external;
    // mock methods
    function roundComplete(uint64 _reward, bool includesWithdraw) external;
    function setClosed(bool _closed) external;
    function setWithdrawalsClosed(bool _withdrawalsClosed) external;
}
