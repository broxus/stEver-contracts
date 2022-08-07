pragma ton-solidity >=0.61.0;
pragma AbiHeader expire;
import "./interfaces/IStrategy.sol";
import "./interfaces/IParticipant.sol";
import "./interfaces/IDePool.sol";
import "./interfaces/IVault.sol";

import "@broxus/contracts/contracts/libraries/MsgFlag.sol";
import "locklift/src/console.sol";


enum StrategyState {INIT,BALANCING}
contract StrategyBase is IStrategy,IParticipant {
    // constant
    uint128 constant CONTRACT_MIN_BALANCE = 1 ever;
    uint128 constant THRESHOLD_BALANCE = 4 ever;
    uint128 constant MAX_BALANCE = 10 ever;
    uint64 constant DEPOSIT_STAKE_DEPOOL_FEE = 0.5 ever;
    uint64 constant DEPOSIT_STAKE_STRATEGY_FEE = 0.05 ever;
    // dePoolAnserStatuses
    uint8 constant STATUS_SUCCESS = 0;
    uint8 constant STATUS_STAKE_TOO_SMALL = 1;
    uint8 constant STATUS_DEPOOL_CLOSED = 3;
    uint8 constant STATUS_NO_PARTICIPANT = 6;
    uint8 constant STATUS_PARTICIPANT_ALREADY_HAS_VESTING = 9;
    uint8 constant STATUS_WITHDRAWAL_PERIOD_GREATER_TOTAL_PERIOD = 10;
    uint8 constant STATUS_TOTAL_PERIOD_MORE_18YEARS = 11;
    uint8 constant STATUS_WITHDRAWAL_PERIOD_IS_ZERO = 12;
    uint8 constant STATUS_TOTAL_PERIOD_IS_NOT_DIVISIBLE_BY_WITHDRAWAL_PERIOD = 13;
    uint8 constant STATUS_REMAINING_STAKE_LESS_THAN_MINIMAL = 16;
    uint8 constant STATUS_PARTICIPANT_ALREADY_HAS_LOCK = 17;
    uint8 constant STATUS_TRANSFER_AMOUNT_IS_TOO_BIG = 18;
    uint8 constant STATUS_TRANSFER_SELF = 19;
    uint8 constant STATUS_TRANSFER_TO_OR_FROM_VALIDATOR = 20;
    uint8 constant STATUS_FEE_TOO_SMALL = 21;
    uint8 constant STATUS_INVALID_ADDRESS = 22;
    uint8 constant STATUS_INVALID_DONOR = 23;
    uint8 constant STATUS_NO_ELECTION_ROUND = 24;
    uint8 constant STATUS_INVALID_ELECTION_ID = 25;
    uint8 constant STATUS_TRANSFER_WHILE_COMPLETING_STEP = 26;
    uint8 constant STATUS_NO_POOLING_STAKE = 27;
    // strategy statuses
    uint8 constant STAKE_TO_SMALL = 28;
    uint8 constant DEPOSIT_FEE_TO_SMALL = 29;

    uint64 minStake = 1 ever;

    address vault;
    address dePool;
    StrategyState strategyState = StrategyState.INIT;

    // static
    uint128 public static nonce;
    address public static fabric;
    uint32 public static strategyVesrsion;
    // errors
    uint8 constant NOT_VAULT = 101;
    uint8 constant NOT_DEPOOL = 102;
    uint8 constant NOT_DEPOOL_OR_VAULT = 103;
    uint8 constant BAD_DEPOSIT_VALUE = 104;
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
        require(msg.sender == dePool,NOT_DEPOOL);
        _;
    }
    modifier onlyDepoolOrVault() {
        require(msg.sender == dePool || msg.sender == vault,NOT_DEPOOL_OR_VAULT);
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
        return {value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS, bounce: false} Details(vault);
    }

    function deposit(uint64 amount) override external onlyVault{
        
        tvm.rawReserve(_reserve(),0);
        if(msg.value < amount+DEPOSIT_STAKE_DEPOOL_FEE+DEPOSIT_STAKE_STRATEGY_FEE) {
           return depositNotHandled(DEPOSIT_FEE_TO_SMALL);
        }
        if(amount < minStake) {
           return depositNotHandled(STAKE_TO_SMALL);
        }
        depositToDepool(amount,vault);
    }

    function withdraw(uint64 amount) override external onlyVault{

       tvm.rawReserve(_reserve(),0);

       withdrawFromDePool(amount);
    }

    function depositToDepool(uint64 amount,address remaining_gas_to) internal {
        IDePool(dePool).addOrdinaryStake{value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false}(amount);
    }

    function withdrawFromDePool(uint64 amount) internal {
        IDePool(dePool).withdrawFromPoolingRound{value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false}(amount);
    }



    function receiveAnswer(uint32 errcode, uint64 comment) override external onlyDepool {
        tvm.rawReserve(_reserve(),0);
        if(errcode == 0) {
           return depositHandled();
        }
        if(
            errcode == STATUS_DEPOOL_CLOSED ||
            errcode == STATUS_FEE_TOO_SMALL ||
            errcode == STATUS_STAKE_TOO_SMALL
        ) {
            return depositNotHandled(errcode);
        }
        if(
            errcode == STATUS_DEPOOL_CLOSED ||
            errcode == STATUS_NO_PARTICIPANT ||
            errcode == STATUS_NO_POOLING_STAKE
        ) {
            return withdrawError(errcode);
        }
    }

    function depositHandled() internal {
        IVault(vault).onStrategyHandledDeposit{value:0,flag:MsgFlag.ALL_NOT_RESERVED, bounce:false}();
    }

    function depositNotHandled(uint32 errcode) internal {
        IVault(vault).onStrategyDidntHandleDeposit{value:0,flag:MsgFlag.ALL_NOT_RESERVED, bounce:false}(errcode);
    }

    function withdrawError(uint32 errcode) internal {
        IVault(vault).withdrawFromStrategyError{value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false}(errcode);
    }

    function onTransfer(address source, uint128 amount) override external {

    }

    receive() external onlyDepoolOrVault {
        tvm.rawReserve(_reserve(),0);
        if(msg.sender == dePool) {
            IVault(vault).receiveFromStrategy{value:0,flag:MsgFlag.ALL_NOT_RESERVED, bounce:false}();
        }
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
        tvm.accept();
        tvm.rawReserve(_reserveWithValue(0.1 ton),0);
        uint128 requestedBalance;
        if(address(this).balance < THRESHOLD_BALANCE) {
            requestedBalance = MAX_BALANCE - address(this).balance;
        }
        IVault(vault).strategyReport{value:0.1 ever,flag:MsgFlag.REMAINING_GAS, bounce:false}(reward,0,ordinaryStake,requestedBalance);
    }

}
