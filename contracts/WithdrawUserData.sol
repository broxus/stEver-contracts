pragma ton-solidity >=0.61.0;
pragma AbiHeader expire;

import "./interfaces/IWithdrawUserData.sol";
import "./interfaces/IVault.sol";
// import "./stLib.sol";
import "@broxus/contracts/contracts/libraries/MsgFlag.sol";
import "locklift/src/console.sol";


struct WithdrawRequest {
    uint128 amount;
}
contract WithdrawUserData is IWithdrawUserData {
    // static
    address static vault;
    address static user; 
    TvmCell public static withdrawUserDataCode;

    uint128 pendingReturnedTokens;
    uint128 pendingReceiveEver;

    // errors
    uint8 constant ONLY_VAULT = 101;
    uint8 constant RECEIVED_BAD_VALUE = 102;
    uint8 constant REQUEST_NOT_EXISTS = 103;
    uint128 constant CONTRACT_MIN_BALANCE = 0.1 ton;
    // mappings
    mapping(uint64 => WithdrawRequest) withdrawRequests;

    constructor()public{}
    modifier onlyVault() {
        require(msg.sender == vault,ONLY_VAULT);
        _;
    }

    function _reserve() internal pure returns (uint128) {
		return
			math.max(address(this).balance - msg.value, CONTRACT_MIN_BALANCE);
	}

    function getDetails()
		external
		view
		responsible
		override
		returns (UserDataDetails)
	{
		return
			{
				value: 0,
				bounce: false,
				flag: MsgFlag.REMAINING_GAS
			} UserDataDetails(pendingReturnedTokens,pendingReceiveEver,user);
	}

    function addPendingValue(uint64 _nonce,uint128 _amount) override external onlyVault {
        tvm.rawReserve(_reserve(), 0);
        withdrawRequests[_nonce] = WithdrawRequest(_amount);
        IVault(vault).onPendingWithdrawAccepted{value:0,flag: MsgFlag.ALL_NOT_RESERVED}(_nonce,user);
    }

    function receiveFromVault(uint128 amount) override external onlyVault {
        tvm.rawReserve(_reserve(), 0);
        require(amount >= pendingReceiveEver && msg.value >= amount,RECEIVED_BAD_VALUE);

        user.transfer({
            value:amount,
            bounce: false,
            flag: 1
        });

        vault.transfer({
			value: 0,
			bounce: false,
			flag: MsgFlag.ALL_NOT_RESERVED
		});

    }
    
    function processWithdraw(uint64[] _satisfiedWithdrawRequests) override external onlyVault {
        tvm.rawReserve(_reserve(), 0);
        uint128 amount;
        DumpWithdraw[] withdrawDump;
        for (uint256 i = 0; i < _satisfiedWithdrawRequests.length; i++) {
            uint64 withdrawRequestKey = _satisfiedWithdrawRequests[i];
            require(withdrawRequests.exists(withdrawRequestKey),REQUEST_NOT_EXISTS);
            WithdrawRequest withdrawRequest = withdrawRequests[withdrawRequestKey];
            withdrawDump.push(DumpWithdraw(withdrawRequest.amount,withdrawRequestKey));
            delete withdrawRequests[withdrawRequestKey];
            amount+=withdrawRequest.amount;
        }
        IVault(vault).withdrawToUser{value:0,flag:MsgFlag.ALL_NOT_RESERVED}(amount,user,withdrawDump);
    }

    function finishWithdraw(uint64[] _satisfiedWithdrawRequests,uint128 everAmount,address send_gas_to) override external onlyVault {   
    }
}