pragma ton-solidity >=0.61.0;
pragma AbiHeader expire;
import "./interfaces/~IStrategy.sol";
import "./interfaces/~IParticipant.sol";
import "./interfaces/~IDePool.sol";

contract Strategy is IStrategy,IParticipant {
    address vault;
    address dePool;
    uint8 constant NOT_VAULT = 101;

    constructor(address _vault,address _dePool) public {
        vault = _vault;
        dePool = _dePool;
    }
    modifier onlyVault() {
        require(msg.sender == vault,NOT_VAULT);
        _;
    }
    modifier onlyStrategy() {
        _;
    }
    function getDetails() override external responsible view returns(Details){

    } 
    function deposit(uint64 amount) override external onlyVault{
        depositToDepool(amount);
    } 
    function withdraw(uint64 amount) override external onlyVault{
       withdrawFromDePool(amount);
    }

    function receiveFromStrategy(uint64 amount) override external onlyStrategy {
        depositToDepool(amount);
    } 

    function sendToStrategy(address strategy, uint64 amount) override external onlyVault {

    }

    function depositToDepool(uint64 amount) internal {
        IDePool(dePool).addOrdinaryStake{value:msg.value}(amount);
    }

    function withdrawFromDePool(uint64 amount) internal {
        IDePool(dePool).withdrawFromPoolingRound(amount);
    }

    function onRoundComplete(
        uint64 roundId,
        uint64 reward,
        uint64 ordinaryStake,
        uint64 vestingStake,
        uint64 lockStake,
        bool reinvest,
        uint8 reason
    ) override external {
        
    }

    function receiveAnswer(uint32 errcode, uint64 comment) override external {

    }

    function onTransfer(address source, uint128 amount) override external {

    }

}