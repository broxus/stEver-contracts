pragma ever-solidity >=0.61.0;
pragma AbiHeader expire;
import "./interfaces/IDePool.sol";
import "./interfaces/IParticipant.sol";
import "@broxus/contracts/contracts/libraries/MsgFlag.sol";
import "locklift/src/console.sol";




struct Depositor {
    uint128 amount;
}

contract TestDepool is IDePool {
    uint64 constant STAKE_FEE = 0.5 ever;
    uint8 constant DEPOSITOR_NOT_EXISTS = 101;
    uint8 constant BAD_DEPOSIT_VALUE = 102;
    uint8 constant STATUS_SUCCESS = 0;
    uint8 constant STATUS_STAKE_TOO_SMALL = 1;
    uint8 constant STATUS_DEPOOL_CLOSED = 3;
    uint8 constant STATUS_FEE_TOO_SMALL = 21;
    uint64 round;
    bool closed = false;
    uint64 m_minStake = 1 ever;

    uint128 public static nonce;

    mapping(address => Depositor) depositors;
    function addOrdinaryStake(uint64 stake) override external {

        if(closed) {
            return _sendError(STATUS_DEPOOL_CLOSED, 0);
        }

        if(msg.value < stake + STAKE_FEE) {
            return _sendError(STATUS_FEE_TOO_SMALL, STAKE_FEE);
        }

        if (stake < m_minStake) {
        console.log(format("addOrdinaryStake msg.value = {}",msg.value));

            return _sendError(STATUS_STAKE_TOO_SMALL, m_minStake);
        }

        uint128 fee = msg.value - stake;
        if (!depositors.exists(msg.sender)) {
            depositors[msg.sender] = Depositor(0);
        }
        depositors[msg.sender].amount += stake;
        sendAcceptAndReturnChange128(uint64(fee));
    }

    function withdrawFromPoolingRound(uint64 withdrawValue) override external {
        require(depositors[msg.sender].amount >= withdrawValue,DEPOSITOR_NOT_EXISTS);
        depositors[msg.sender].amount -= withdrawValue;
        msg.sender.transfer({value: withdrawValue, flag: MsgFlag.REMAINING_GAS, bounce: false});
    }

    function withdrawPart(uint64 withdrawValue) override external {
        require(depositors[msg.sender].amount >= withdrawValue,DEPOSITOR_NOT_EXISTS);
        depositors[msg.sender].amount -= withdrawValue;
        msg.sender.transfer({value: withdrawValue, bounce: false});
    }

    function withdrawAll() override external {
        require(depositors[msg.sender].amount > 0,DEPOSITOR_NOT_EXISTS);
        uint128 amountToSend = depositors[msg.sender].amount;
        delete depositors[msg.sender];
        msg.sender.transfer({value: amountToSend, bounce: false});
    }

    function roundCompelte(uint64 _reward) override external {
        tvm.accept();
        round += 1;
        for ((address key, ) : depositors) {
            depositors[key].amount += _reward;
            IParticipant(key).onRoundComplete(
                round,
                _reward,
                uint64(depositors[key].amount),
                0,
                0,
                true,
                1
            );
        }
    }

    function _sendError(uint32 errcode, uint64 comment) private pure {
        IParticipant(msg.sender).receiveAnswer{value: 0, bounce: false, flag: 64}(errcode, comment);
    }

    function sendAcceptAndReturnChange128(uint64 fee) private view {
        tvm.rawReserve(address(this).balance - fee, 0);
        IParticipant(msg.sender).receiveAnswer{value: 0, bounce: false, flag: 128}(STATUS_SUCCESS, 0);
    }
}
