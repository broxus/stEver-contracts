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
            isEmergency:true,
            emitter: _emergencyEmitter,
            emitTimestamp: now
        });
    }
    //predicate
    function isEmergencyProcess() internal returns (bool) {
        return emergencyState.isEmergency && (emergencyState.emitTimestamp + Constants.EMERGENCY_DURATION) <= now;
    }

    function emergencyWithdrawProcess(address _user, mapping (address => WithdrawConfig) _emergencyWithdrawConfig) override external onlyAccount(_user){
        require(!isEmergencyProcess(), ErrorCodes.EMERGENCY_ALREADY_RUN);

        uint128 countOfStrategies = uint128(_emergencyWithdrawConfig.keys().length);
        uint128 requiredMsgValue = countOfStrategies * (StEverVaultGas.WITHDRAW_FEE + StEverVaultGas.EXPEREMENTAL_FEE);

        require(msg.value >= requiredMsgValue, ErrorCodes.NOT_ENOUGH_VALUE);

        tvm.rawReserve(_reserve(), 0);

        enableEmergencyState(_user);

        this._processEmergencyWithdraw{value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false}(_user ,_emergencyWithdrawConfig);
    }

    function startEmergencyWithdraw() internal {

    }


    function _processEmergencyWithdraw(address _user, mapping (address => WithdrawConfig) _emergencyWithdrawConfig) override external {
        require(msg.sender == address(this), 9999);
        tvm.rawReserve(_reserve(), 0);
        uint256 chunkSize = 50;
        for (uint256 i = 0; i < chunkSize && !_emergencyWithdrawConfig.empty(); i++) {
            (address strategy, WithdrawConfig config) = _emergencyWithdrawConfig.delMin().get();

            if (!strategies.exists(strategy)) {
                emit ProcessWithdrawFromStrategyError(strategy, ErrorCodes.STRATEGY_NOT_EXISTS);
                continue;
            }

            if (!isStrategyInInitialState(strategy)) {
                emit ProcessWithdrawFromStrategyError(strategy, ErrorCodes.STRATEGY_NOT_IN_INITIAL_STATE);
                continue;
            }
            strategies[strategy].withdrawingAmount = config.amount;

            IStrategy(strategy).withdraw{value:config.fee, bounce: false}(uint64(config.amount));
        }

        if (!_emergencyWithdrawConfig.empty()) {
            this._processEmergencyWithdraw{value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce:false}(_user, _emergencyWithdrawConfig);
        }

        _user.transfer({value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false});
    }

    function getEmergencyWithdrawConfig() override external responsible view returns(mapping (address => WithdrawConfig)) {
        uint128 maxUint128 = 2**128 - 1;

        mapping (address => WithdrawConfig) emergencyWithdrawConfig;
        for ((address strategy,) : strategies) {
            emergencyWithdrawConfig[strategy] = WithdrawConfig({
                amount: maxUint128,
                fee: StEverVaultGas.WITHDRAW_FEE
            });
        }

        return {value:0, bounce: false, flag: MsgFlag.REMAINING_GAS} emergencyWithdrawConfig;
    }
}