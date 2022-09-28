pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;

interface IDePoolStrategy {
    struct Details {
        address vault;
        address dePool;
    }
    function getDetails() external responsible view returns(Details);

}
