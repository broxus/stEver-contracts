pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;

import "./interfaces/IStEverAccount.sol";
import "./interfaces/IStEverVault.sol";
import "./utils/ErrorCodes.sol";
import "./utils/Gas.sol";
import "./utils/Constants.sol";

import "@broxus/contracts/contracts/libraries/MsgFlag.sol";
import "locklift/src/console.sol";



contract StEverAccount is IStEverAccount {
    address vault; // setup from initData
    address user; // setup from initData
    // TODO: ты не забираешь его в onCodeUpgrade
    TvmCell platformCode; // setup from initData
    uint32 currentVersion; //setup from _init

    // mappings
    mapping(uint64 => WithdrawRequest) public withdrawRequests;

    //constant
    uint128 constant MAX_PENDING_COUNT = 50;


    constructor() public {
        revert();
    }

    function _init(uint32 _version) internal {
        currentVersion = _version;
    }

    modifier onlyVault() {
        require (msg.sender == vault, ErrorCodes.ONLY_VAULT);
        _;
    }

    function _reserve() internal pure returns (uint128) {
		return
			math.max(address(this).balance - msg.value, StEverAccountGas.CONTRACT_MIN_BALANCE);
	}

    function getDetails()
		external
		view
		responsible
		override
		returns (AccountDetails)
	{
		return
			{
				value: 0,
				bounce: false,
				flag: MsgFlag.REMAINING_GAS
			} AccountDetails(user, vault, currentVersion);
	}


    function addPendingValue(uint64 _nonce, uint128 _amount) override external onlyVault {
        tvm.rawReserve(_reserve(), 0);
        if (withdrawRequests.keys().length < MAX_PENDING_COUNT && !withdrawRequests.exists(_nonce)) {

            withdrawRequests[_nonce] = WithdrawRequest({
                amount: _amount,
                timestamp: now
            });

            IStEverVault(vault).onPendingWithdrawAccepted{value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false}(_nonce, user);
            return;
        }
        IStEverVault(vault).onPendingWithdrawRejected{value: 0, flag:MsgFlag.ALL_NOT_RESERVED, bounce: false}(_nonce, user, _amount);
    }

    function resetPendingValues(mapping(uint64 => WithdrawRequest) rejectedWithdrawals, address sendGasTo) override external onlyVault {
        tvm.rawReserve(_reserve(), 0);

        for ((uint64 nonce, WithdrawRequest rejectedWithdrawRequest) : rejectedWithdrawals) {
            withdrawRequests[nonce] = rejectedWithdrawRequest;
        }

        sendGasTo.transfer({value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false});
    }

    function removePendingWithdraw(uint64 _nonce) override external onlyVault {
        tvm.rawReserve(_reserve(), 0);
        if (withdrawRequests.exists(_nonce)) {
            WithdrawRequest withdrawRequest = withdrawRequests[_nonce];
            delete withdrawRequests[_nonce];
            IStEverVault(vault).onPendingWithdrawRemoved{
                value: 0,
                flag:MsgFlag.ALL_NOT_RESERVED,
                bounce: false
            }(user, _nonce, withdrawRequest.amount);
            return;
        }
        user.transfer({value:0, flag:MsgFlag.ALL_NOT_RESERVED, bounce: false});
    }

    function createAndSendWithdrawToUserRequest(uint64[] _satisfiedWithdrawRequests) internal {

        uint128 totalAmount = 0;
        mapping(uint64 => WithdrawRequest) withdrawals;

        for (uint256 i = 0; i < _satisfiedWithdrawRequests.length; i++) {
            uint64 withdrawRequestKey = _satisfiedWithdrawRequests[i];
            if (withdrawRequests.exists(withdrawRequestKey)) {
                WithdrawRequest withdrawRequest = withdrawRequests[withdrawRequestKey];
                withdrawals[withdrawRequestKey] = withdrawRequest;
                delete withdrawRequests[withdrawRequestKey];
                totalAmount += withdrawRequest.amount;
            }
        }

        IStEverVault(vault).withdrawToUser{
            value: 0,
            flag: MsgFlag.ALL_NOT_RESERVED,
            bounce: false
        }(
            totalAmount, user, withdrawals
        );
    }

    function processWithdraw(uint64[] _satisfiedWithdrawRequests) override external onlyVault {
        tvm.rawReserve(_reserve(), 0);
        createAndSendWithdrawToUserRequest(_satisfiedWithdrawRequests);
    }

    function onEmergencyWithdrawToUser() override external onlyVault {
        tvm.rawReserve(_reserve(), 0);
        uint64[] satisfiedWithdrawRequests;
        for((uint64 nonce,) : withdrawRequests) {
            satisfiedWithdrawRequests.push(nonce);
        }
        createAndSendWithdrawToUserRequest(satisfiedWithdrawRequests);
    }

    function onStartEmergency(uint64 _proofNonce) override external onlyVault {
        tvm.rawReserve(_reserve(), 0);
        if (!withdrawRequests.exists(_proofNonce)) {
            IStEverVault(vault).startEmergencyRejected{value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false}(user, ErrorCodes.REQUEST_NOT_EXISTS);
            return;
        }

        WithdrawRequest withdrawRequest = withdrawRequests[_proofNonce];
        if ((withdrawRequest.timestamp + Constants.TIME_AFTER_EMERGENCY_CAN_BE_ACTIVATED) > now) {
            IStEverVault(vault).startEmergencyRejected{value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false}(user, ErrorCodes.EMERGENCY_CANT_BE_ACTIVATED);
            return;
        }

        IStEverVault(vault).emergencyWithdrawFromStrategiesProcess{value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false}(user);
    }

    function upgrade(TvmCell _newCode, uint32 _newVersion, address _sendGasTo) external virtual override onlyVault {
        

        if (_newVersion == currentVersion) {
            tvm.rawReserve(_reserve(), 0);
            _sendGasTo.transfer({ value: 0, bounce: false, flag: MsgFlag.ALL_NOT_RESERVED });
            return;
        }


        TvmBuilder mainBuilder;
        mainBuilder.store(vault);
        mainBuilder.store(uint8(0));
        mainBuilder.store(_sendGasTo);

        mainBuilder.store(platformCode);

        TvmBuilder initialData;
        initialData.store(user);

        TvmBuilder constructorParams;
        constructorParams.store(_newVersion);
        constructorParams.store(currentVersion);

        mainBuilder.storeRef(initialData);
        mainBuilder.storeRef(constructorParams);

        TvmCell storageData = abi.encode(
            vault,              //address
            user,               //address
            currentVersion,     //uint32
            withdrawRequests    //mapping(uint64 => WithdrawRequest)
        );

        mainBuilder.storeRef(storageData);


        // set code after complete this method
        tvm.setcode(_newCode);
        // run onCodeUpgrade from new code
        tvm.setCurrentCode(_newCode);

        onCodeUpgrade(mainBuilder.toCell());
    }

    function onCodeUpgrade(TvmCell _upgrade_data) private {
        tvm.resetStorage();
        tvm.rawReserve(_reserve(), 0);
        TvmSlice s = _upgrade_data.toSlice();

        (address root_, , address send_gas_to, ) = s.decode(address, uint8, address,TvmCell);
        vault = root_;

        TvmSlice initialData = s.loadRefAsSlice();
        user = initialData.decode(address);

        TvmSlice constructorParams = s.loadRefAsSlice();
        (uint32 _current_version,) = constructorParams.decode(uint32, uint32);
        _init(_current_version);

        send_gas_to.transfer({value: 0, bounce: false, flag: MsgFlag.ALL_NOT_RESERVED});
    }
}
