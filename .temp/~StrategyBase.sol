pragma ton-solidity >=0.61.0;
pragma AbiHeader expire;
import "./interfaces/~IStrategy.sol";
import "./interfaces/~IParticipant.sol";
import "./interfaces/~IDePool.sol";
import "./interfaces/~IVault.sol";

import "o:/projects/broxus/st-ever/node_modules/@broxus/contracts/contracts/libraries/MsgFlag.sol";


contract StrategyBase is IStrategy,IParticipant {
    // constant
    uint128 constant CONTRACT_MIN_BALANCE = 1 ton;
    uint64 constant DEPOSIT_STAKE_DEPOOL_FEE = 0.5 ton;
    uint64 constant DEPOSIT_STAKE_STRATEGY_FEE = 0.05 ton;
    address vault;
    address dePool;

    // static
    uint128 public static nonce;
    // errors
    uint8 constant NOT_VAULT = 101;
    uint8 constant BAD_DEPOSIT_VALUE = 102;
    constructor(address _vault,address _dePool) public {
        tvm.accept();
        vault = _vault;
        dePool = _dePool;
    }

    modifier onlyVault() {
        require(msg.sender == vault,NOT_VAULT);
        _;
    }

    modifier onlyDepool() {
        require(msg.sender == dePool,NOT_VAULT);
        _;
    }

    modifier onlyStrategy() {
        _;
    }

    function _reserve() internal pure returns (uint128) {
		return
			math.max(address(this).balance - msg.value, CONTRACT_MIN_BALANCE);
	}

    function _reserveWithValue(uint128 _value) internal pure returns (uint128) {
		return math.max(address(this).balance - msg.value - _value, CONTRACT_MIN_BALANCE);
	}

    function getDetails() override external responsible view returns(Details){
        return {value:0,bounce:false,flag: MsgFlag.REMAINING_GAS} Details(vault,true,9999,9999);
    } 

    function deposit(uint64 amount) override external onlyVault{
        require(msg.value >= amount+DEPOSIT_STAKE_DEPOOL_FEE+DEPOSIT_STAKE_STRATEGY_FEE,BAD_DEPOSIT_VALUE);
        tvm.rawReserve(_reserve(),0);
        depositToDepool(amount,vault);
    } 

    function withdraw(uint64 amount) override external onlyVault{
       withdrawFromDePool(amount);
    }

    function receiveFromStrategy(uint64 amount) override external onlyStrategy {
        depositToDepool(amount,msg.sender);
    } 

    function sendToStrategy(address strategy, uint64 amount) override external onlyVault {

    }

    function depositToDepool(uint64 amount,address remaining_gas_to) internal {
        IDePool(dePool).addOrdinaryStake{value:0,flag:MsgFlag.ALL_NOT_RESERVED}(amount);
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
    ) override external onlyDepool {
        // TODO fix hardcode value
        IVault(vault).strategyReport{value:0.1 ton,flag:MsgFlag.REMAINING_GAS}(reward,0,ordinaryStake);
    }

    function receiveAnswer(uint32 errcode, uint64 comment) override external onlyDepool {
        tvm.rawReserve(_reserve(),0);
        IVault(vault).onStrategyHandledDeposit{value:0,flag:MsgFlag.ALL_NOT_RESERVED}();
    }

    function onTransfer(address source, uint128 amount) override external {

    }

}