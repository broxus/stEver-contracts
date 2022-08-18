pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;
import "./interfaces/IStrategy.sol";
import "./interfaces/IDePoolStrategy.sol";
import "./interfaces/IParticipant.sol";
import "./interfaces/IDePool.sol";
import "./interfaces/IStEverVault.sol";
import "./utils/ErrorCodes.sol";

import "@broxus/contracts/contracts/libraries/MsgFlag.sol";
import "locklift/src/console.sol";

enum State {
    INITIAL,
    DEPOSITING,
    WITHDRAWING
}
contract StrategyDePool is IStrategy, IDePoolStrategy, IParticipant {
    // constant
    uint128 constant CONTRACT_MIN_BALANCE = 1 ever;
    uint128 constant THRESHOLD_BALANCE = 4 ever;
    uint128 constant MAX_BALANCE = 10 ever;
    uint64 constant DEPOSIT_STAKE_DEPOOL_FEE = 0.5 ever;
    uint64 constant DEPOSIT_STAKE_STRATEGY_FEE = 0.05 ever;
    // dePoolAnswerStatuses
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

    uint128 minStake = 1 ever;

    address vault;
    address dePool;

    // states for understanding dePool responses
    State state = State.INITIAL;

    // static
    uint128 public static nonce;
    address public static factory;
    uint32 public static strategyVersion;
    constructor(address _vault,address _dePool) public {
        tvm.accept();

        vault = _vault;
        dePool = _dePool;
    }

    modifier onlyVault() {
        require (msg.sender == vault,ErrorCodes.NOT_VAULT);
        _;
    }

    modifier onlyDepool() {
        require (msg.sender == dePool, ErrorCodes.NOT_DEPOOL);
        _;
    }

    modifier onlyFactory() {
        require (msg.sender == factory, ErrorCodes.NOT_FABRIC);
        _;
    }

    modifier onlyDepoolOrVault() {
        require (msg.sender == dePool || msg.sender == vault, ErrorCodes.NOT_DEPOOL_OR_VAULT);
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
        return {value: 0, bounce: false, flag: MsgFlag.REMAINING_GAS, bounce: false} Details(vault, dePool);
    }

    function deposit(uint128 _amount) override external onlyVault {
        tvm.rawReserve(_reserve(), 0);

        state = State.DEPOSITING;

        if (msg.value < _amount + DEPOSIT_STAKE_DEPOOL_FEE + DEPOSIT_STAKE_STRATEGY_FEE) {
           return depositNotHandled(DEPOSIT_FEE_TO_SMALL);
        }
        if (_amount < minStake) {
           return depositNotHandled(STAKE_TO_SMALL);
        }
        depositToDePool(_amount);
    }

    function withdraw(uint128 _amount) override external onlyVault {
        tvm.rawReserve(_reserve(),0);
        
        state = State.WITHDRAWING;
        
        withdrawFromDePool(_amount);
    }

    function depositToDePool(uint128 _amount) internal {
        IDePool(dePool).addOrdinaryStake{value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false}(uint64(_amount));
    }

    function withdrawFromDePool(uint128 _amount) internal {
        IDePool(dePool).withdrawPart{value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false}(uint64(_amount));
    }
// TODO continue here
    function receiveAnswer(uint32 _errcode, uint64 comment) override external onlyDepool {
        tvm.rawReserve(_reserve(),0);

        if (_errcode == 0) {

            if (state == State.DEPOSITING) {
                state = State.INITIAL;
                return depositHandled();
            }

            if (state == State.WITHDRAWING) {
                IStEverVault(vault).onStrategyHandledWithdrawRequest{value: 0, flag:MsgFlag.ALL_NOT_RESERVED, bounce: false}();
                return;
            }
        }

        //  if dePool respond with errors, set state as INITIAL
        if (
            _errcode == STATUS_DEPOOL_CLOSED ||
            _errcode == STATUS_FEE_TOO_SMALL ||
            _errcode == STATUS_STAKE_TOO_SMALL
        ) {
            state = State.INITIAL;
            return depositNotHandled(_errcode);
        }

        if (
            _errcode == STATUS_DEPOOL_CLOSED ||
            _errcode == STATUS_NO_PARTICIPANT ||
            _errcode == STATUS_NO_POOLING_STAKE
        ) {
            state = State.INITIAL;
            return withdrawError(_errcode);
        }
    }

    function depositHandled() internal {
        IStEverVault(vault).onStrategyHandledDeposit{value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false}();
    }

    function depositNotHandled(uint32 _errcode) internal {
        IStEverVault(vault).onStrategyDidntHandleDeposit{value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false}(_errcode);
    }

    function withdrawError(uint32 _errcode) internal {
        IStEverVault(vault).withdrawFromStrategyError{value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false}(_errcode);
    }

    function onTransfer(address source, uint128 amount) override external {

    }

    // receive() external onlyDepoolOrVault {
    //     tvm.rawReserve(_reserve(),0);
    //     if(msg.sender == dePool) {
    //         IStEverVault(vault).receiveFromStrategy{value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false}();
    //     }
    // }

    function onRoundComplete(
        uint64 _roundId,
        uint64 _reward,
        uint64 _ordinaryStake,
        uint64 _vestingStake,
        uint64 _lockStake,
        bool _reinvest,
        uint8 _reason
    ) override external onlyDepool {
        tvm.accept();
        /*
        making free 0.11 ever for evaluating report and full msg.value if report has attached withdraw value
        */ 
        tvm.rawReserve(address(this).balance - 0.11 ever - msg.value, 0);

        uint128 requestedBalance;
        if (address(this).balance < THRESHOLD_BALANCE) {
            requestedBalance = MAX_BALANCE - address(this).balance;
        }
        
        IStEverVault(vault).strategyReport{
            value: 0.1 ever,
            bounce: false
            }(
                _reward,
                0,
                _ordinaryStake,
                requestedBalance
            );

        if (state == State.WITHDRAWING) {
        // if withdraw was requested, then send whole value to the StEverVault
            state = State.INITIAL;
            IStEverVault(vault).receiveFromStrategy{value:0, flag:MsgFlag.ALL_NOT_RESERVED, bounce: false}();
        } 
    }



    function upgrade(TvmCell _newCode, uint32 _newVersion, address _sendGasTo) override external onlyFactory {
        if (_newVersion == strategyVersion) {
            tvm.rawReserve(_reserve(), 0);
            _sendGasTo.transfer({value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false});
            return;
        }

        // should be unpacked in the same order!
        TvmCell data = abi.encode(
            _newVersion,
            minStake,
            vault,
            dePool,
            factory
        );
        // set code after complete this method
        tvm.setcode(_newCode);
        // run onCodeUpgrade from new code
        tvm.setCurrentCode(_newCode);

        onCodeUpgrade(data);
    }

    function onCodeUpgrade(TvmCell _upgradeData) private {}

}
