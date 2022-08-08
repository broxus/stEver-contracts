pragma ever-solidity >=0.61.0;
pragma AbiHeader expire;

import "./interfaces/IStEverAccount.sol";
import "./interfaces/IVault.sol";
import "@broxus/contracts/contracts/libraries/MsgFlag.sol";
import "locklift/src/console.sol";


// TODO: struct with one field? we really need it ????
struct WithdrawRequest {
    uint128 amount;
}
contract StEverAccount is IStEverAccount {
    address vault; // setup from initData
    address user; // setup from initData

    uint128 pendingReturnedTokens;
    uint128 pendingReceiveEver;

    uint32 currentVersion;
    //constant
    uint128 constant CONTRACT_MIN_BALANCE = 0.1 ton;
    uint128 constant MAX_PENDING_COUNT = 50;
    // errors
    uint8 constant ONLY_VAULT = 101;
    uint8 constant RECEIVED_BAD_VALUE = 102;
    uint8 constant REQUEST_NOT_EXISTS = 103;

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
		returns (AccountDetails)
	{
		return
			{
				value: 0,
				bounce: false,
				flag: MsgFlag.REMAINING_GAS
			} AccountDetails(pendingReturnedTokens,pendingReceiveEver,user);
	}

    function addPendingValue(uint64 _nonce, uint128 _amount) override external onlyVault {
        tvm.rawReserve(_reserve(), 0);
        if (withdrawRequests.keys().length < MAX_PENDING_COUNT) {
            withdrawRequests[_nonce] = WithdrawRequest(_amount);
            IVault(vault).onPendingWithdrawAccepted{value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false}(_nonce, user);
            return;
        }
        IVault(vault).onPendingWithdrawRejected{value: 0, flag:MsgFlag.ALL_NOT_RESERVED, bounce: false}(_nonce, user, _amount);
    }

    function resetPendingValues(uint128[] _amountsWithdrawn, uint64[] _noncesWithdrawn) override external onlyVault {
        tvm.rawReserve(_reserve(), 0);
        for (uint256 i = 0; i < _amountsWithdrawn.length; i++) {
            withdrawRequests[_noncesWithdrawn[i]] = WithdrawRequest(_amountsWithdrawn[i]);
        }
        vault.transfer({value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false});
    }

    function removePendingWithdraw(uint64 _nonce) override external onlyVault {
        tvm.rawReserve(_reserve(), 0);
        if (withdrawRequests.exists(_nonce)) {
            WithdrawRequest withdrawRequest = withdrawRequests[_nonce];
            delete withdrawRequests[_nonce];
            IVault(vault).onPendingWithdrawRemoved{
                value:0,
                flag:MsgFlag.ALL_NOT_RESERVED, 
                bounce: false
            }(user, _nonce, withdrawRequest.amount);
            return;
        }
        user.transfer({value:0, flag:MsgFlag.ALL_NOT_RESERVED, bounce: false});
    }

    // TODO: add recursive handling for big input array, otherwise gas overflow could occur
    function processWithdraw(uint64[] _satisfiedWithdrawRequests) override external onlyVault {
        tvm.rawReserve(_reserve(), 0);

        uint128 totalAmount = 0;
        uint128[] amountsWithdrawn;
        uint64[] noncesWithdrawn;
        for (uint256 i = 0; i < _satisfiedWithdrawRequests.length; i++) {
            uint64 withdrawRequestKey = _satisfiedWithdrawRequests[i];
            if (withdrawRequests.exists(withdrawRequestKey)) {
                WithdrawRequest withdrawRequest = withdrawRequests[withdrawRequestKey];
                amountsWithdrawn.push(withdrawRequest.amount);
                noncesWithdrawn.push(withdrawRequestKey);
                delete withdrawRequests[withdrawRequestKey];
                totalAmount += withdrawRequest.amount;
            }
        }
        IVault(vault).withdrawToUser{value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false}(
            totalAmount, user, amountsWithdrawn, noncesWithdrawn
        );
    }

    function onCodeUpgrade(TvmCell upgrade_data) private {
        tvm.resetStorage();
        tvm.rawReserve(_reserve(), 0);
        TvmSlice s = upgrade_data.toSlice();
        (address root_, , address send_gas_to, TvmCell platformCode) = s.decode(address, uint8, address,TvmCell);
        vault = root_;

        TvmSlice initialData = s.loadRefAsSlice();
        user = initialData.decode(address);

        send_gas_to.transfer({ value: 0, bounce: false, flag: MsgFlag.ALL_NOT_RESERVED });
    }
}
 