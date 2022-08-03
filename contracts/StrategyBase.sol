pragma ton-solidity >=0.61.0;
pragma AbiHeader expire;
import "./interfaces/IStrategy.sol";
import "./interfaces/IParticipant.sol";
import "./interfaces/IDePool.sol";
import "./interfaces/IVault.sol";

import "@broxus/contracts/contracts/libraries/MsgFlag.sol";


contract StrategyBase is IStrategy,IParticipant {
    // constant
    uint128 constant CONTRACT_MIN_BALANCE = 1 ton;
    uint64 constant DEPOSIT_STAKE_DEPOOL_FEE = 0.5 ton;
    uint64 constant DEPOSIT_STAKE_STRATEGY_FEE = 0.05 ton;
    // dePoolAnserStatuses
    uint8 constant STATUS_SUCCESS = 0;
    uint8 constant STATUS_STAKE_TOO_SMALL = 1;
    uint8 constant STATUS_DEPOOL_CLOSED = 3;
    uint64 minStake = 1 ton;

    address vault;
    address dePool;
    uint128 lastFee;

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
        // TODO strategy needs value for reporting. See onRoundComplete method
        tvm.rawReserve(_reserve(),0);
        if(msg.value < amount+DEPOSIT_STAKE_DEPOOL_FEE+DEPOSIT_STAKE_STRATEGY_FEE) {
           return depositNotHandled();
        }
        if(amount < minStake) {
           return depositNotHandled();
        }
        depositToDepool(amount,vault);
    } 

    function withdraw(uint64 amount,uint128 fee) override external onlyVault{

       tvm.rawReserve(_reserve(),0);
        // TODO resolve fee, it's need for calculating received amount withot fee. See receive method
        lastFee = fee;
       withdrawFromDePool(amount);
    }

    function receiveFromStrategy(uint64 amount) override external onlyStrategy {
        tvm.rawReserve(_reserve(),0);
        depositToDepool(amount,msg.sender);
    } 

    function sendToStrategy(address strategy, uint64 amount) override external onlyVault {
        tvm.rawReserve(_reserve(),0);
        IStrategy(strategy).receiveFromStrategy{value:0,flag:MsgFlag.ALL_NOT_RESERVED}(amount);
    }

    function depositToDepool(uint64 amount,address remaining_gas_to) internal {
        IDePool(dePool).addOrdinaryStake{value:0,flag:MsgFlag.ALL_NOT_RESERVED}(amount);
    }

    function withdrawFromDePool(uint64 amount) internal {
        IDePool(dePool).withdrawFromPoolingRound{value:0,flag:MsgFlag.ALL_NOT_RESERVED}(amount);
    }



    function receiveAnswer(uint32 errcode, uint64 comment) override external onlyDepool {
        // TODO can't sync what of the deposits accepted,so we should reject parallel deposits
        tvm.rawReserve(_reserve(),0);
        if(errcode == 0) {
           return depositHandled();
        }
        if(errcode > 0) {
            return depositNotHandled();
        }
    }

    function depositHandled() internal {
        IVault(vault).onStrategyHandledDeposit{value:0,flag:MsgFlag.ALL_NOT_RESERVED}();
    }

    function depositNotHandled() internal {
        IVault(vault).onStrategyDidntHandleDeposit{value:0,flag:MsgFlag.ALL_NOT_RESERVED}();
    }

    function onTransfer(address source, uint128 amount) override external {

    }

    receive() external onlyDepool {
        tvm.rawReserve(_reserve(),0);
        IVault(vault).receiveFromStrategy{value:0,flag:MsgFlag.ALL_NOT_RESERVED}(lastFee);
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

}