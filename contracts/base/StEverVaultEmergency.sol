pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "./StEverVaultBase.sol";
import "../interfaces/IStrategy.sol";
import "../StEverAccount.sol";
import "../utils/ErrorCodes.sol";
import "../utils/Constants.sol";

import "@broxus/contracts/contracts/libraries/MsgFlag.sol";

abstract contract StEverVaultEmergency is StEverVaultBase {

    function enableEmergencyState(address _emergencyEmitter) internal {
        emergencyState = EmergencyState({
            isEmergency: true,
            emitter: _emergencyEmitter,
            emitTimestamp: now,
            isPaused: false
        });
    }

    modifier onlyEmergencyState() {
        require(isEmergencyProcess(), ErrorCodes.NOT_EMERGENCY_STATE);
        _;
    }

    //predicate
    function isEmergencyProcess() public view returns (bool) {
        return emergencyState.isEmergency && !emergencyState.isPaused;
    }

    function startEmergencyProcess(uint64 _poofNonce) override external minCallValue notPaused {
        require(!emergencyState.isEmergency, ErrorCodes.EMERGENCY_ALREADY_RUN);

        uint128 countOfStrategies = uint128(strategies.keys().length);
        uint128 feeForOneStrategy = StEverVaultGas.MIN_WITHDRAW_FROM_STRATEGY_FEE + StEverVaultGas.EXPERIMENTAL_FEE; // TODO: зафикси грамматику ))))
        uint128 requiredMsgValue = countOfStrategies * feeForOneStrategy;

        require(msg.value >= requiredMsgValue, ErrorCodes.NOT_ENOUGH_VALUE);
        tvm.rawReserve(_reserve(), 0);

        address accountAddress = getAccountAddress(msg.sender);
        IStEverAccount(accountAddress).onStartEmergency{value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false}(_poofNonce);
    }

    function stopEmergencyProcess() override external onlyOwner minCallValue {
        require (emergencyState.isEmergency, ErrorCodes.NOT_EMERGENCY_STATE);
        tvm.rawReserve(_reserve(), 0);

        // set initial emergencyState
        delete emergencyState;

        emit EmergencyStopped();

        msg.sender.transfer({value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false});
    }

    function startEmergencyRejected(address _user, uint16 errcode) override external onlyAccount(_user) {
        tvm.rawReserve(_reserve(), 0);

        emit EmergencyProcessRejectedByAccount(_user, errcode);

        _user.transfer({value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false});
    }

    function emergencyWithdrawFromStrategiesProcess(address _user) override external onlyAccount(_user){
        require (!isEmergencyProcess(), ErrorCodes.EMERGENCY_ALREADY_RUN);

        tvm.rawReserve(_reserve(), 0);
        emit EmergencyProcessStarted(_user);

        enableEmergencyState(_user);
        optional(address, StrategyParams) startPair = strategies.min();
        this._processEmergencyWithdrawFromStrategy{value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false}(_user, startPair);
    }


    function _processEmergencyWithdrawFromStrategy(address _user, optional(address, StrategyParams) _startPair) override external onlySelf {
        uint256 chunkSize = 50;
        tvm.rawReserve(_reserve(), 0);

        optional(address, StrategyParams) pair = _startPair;

        for (uint256 i = 0; i < chunkSize && pair.hasValue(); i++) {

            (address strategy,) = pair.get();
            pair = strategies.next(strategy);

            if (!isStrategyInInitialState(strategy)) {
                emit ProcessWithdrawFromStrategyError(strategy, ErrorCodes.STRATEGY_NOT_IN_INITIAL_STATE);
                continue;
            }

            strategies[strategy].withdrawingAmount = Constants.MAX_UINT_64;

            IStrategy(strategy).withdraw{value: StEverVaultGas.MIN_WITHDRAW_FROM_STRATEGY_FEE, bounce: false}(uint64(Constants.MAX_UINT_64));
        }

        if (pair.hasValue()) {
            this._processEmergencyWithdrawFromStrategy{value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce:false}(_user, pair);
            return;
        }

        _user.transfer({value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false});
    }

    function changeEmergencyPauseState(bool _isPaused) override external onlyOwner minCallValue {
        require(emergencyState.isEmergency, ErrorCodes.NOT_EMERGENCY_STATE);

        tvm.rawReserve(_reserve(), 0);

        emergencyState.isPaused = _isPaused;
        if (_isPaused) {
            emit EmergencyStatePaused();
        } else {
            emit EmergencyStateContinued();
        }

        msg.sender.transfer({value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false});
    }

    function emergencyWithdrawToUser() override external onlyEmergencyState minCallValue {
        tvm.rawReserve(_reserve(), 0);
        address accountAddress = getAccountAddress(msg.sender);
        IStEverAccount(accountAddress).onEmergencyWithdrawToUser{value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false}();
    }
}
