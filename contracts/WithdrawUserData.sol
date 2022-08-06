pragma ton-solidity >=0.61.0;
pragma AbiHeader expire;

import "./interfaces/IWithdrawUserData.sol";
import "./interfaces/IVault.sol";
import "@broxus/contracts/contracts/libraries/MsgFlag.sol";
import "locklift/src/console.sol";


struct WithdrawRequest {
    uint128 amount;
}
contract WithdrawUserData is IWithdrawUserData {

    address vault; // setup from initData

    address user; // setup from initData

    uint128 pendingReturnedTokens;
    uint128 pendingReceiveEver;

    uint32 currentVersion;

    // errors
    uint8 constant ONLY_VAULT = 101;
    uint8 constant RECEIVED_BAD_VALUE = 102;
    uint8 constant REQUEST_NOT_EXISTS = 103;
    uint128 constant CONTRACT_MIN_BALANCE = 0.1 ton;
    // mappings
    mapping(uint64 => WithdrawRequest) public withdrawRequests;

    constructor()public{
    }

    // should be called in onCodeUpgrade on platform initialization
    function _init() internal {
        
    }
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


    function processWithdraw(uint64[] _satisfiedWithdrawRequests) override external onlyVault {
        tvm.rawReserve(_reserve(), 0);
        // ADD check for 1 ton fee
        uint128 amount;
        IVault.DumpWithdraw[] withdrawDump;
        for (uint256 i = 0; i < _satisfiedWithdrawRequests.length; i++) {
            uint64 withdrawRequestKey = _satisfiedWithdrawRequests[i];
            require(withdrawRequests.exists(withdrawRequestKey),REQUEST_NOT_EXISTS);
            WithdrawRequest withdrawRequest = withdrawRequests[withdrawRequestKey];
            withdrawDump.push(IVault.DumpWithdraw(withdrawRequest.amount,withdrawRequestKey));
            delete withdrawRequests[withdrawRequestKey];
            amount+=withdrawRequest.amount;
        }
        IVault(vault).withdrawToUser{value:0,flag:MsgFlag.ALL_NOT_RESERVED}(amount,user,withdrawDump);
    }

    function onCodeUpgrade(TvmCell upgrade_data) private {
        tvm.resetStorage();
        tvm.rawReserve(_reserve(), 0);
        TvmSlice s = upgrade_data.toSlice();
        (address root_, , address send_gas_to,TvmCell platformCode) = s.decode(address, uint8, address,TvmCell);
        vault = root_;


        TvmSlice initialData = s.loadRefAsSlice();
        user = initialData.decode(address);

        send_gas_to.transfer({ value: 0, bounce: false, flag: MsgFlag.ALL_NOT_RESERVED });
    }

}