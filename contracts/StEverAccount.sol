pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;

import "./interfaces/IStEverAccount.sol";
import "./interfaces/IStEverVault.sol";
import "./utils/ErrorCodes.sol";
import "./utils/Gas.sol";

import "@broxus/contracts/contracts/libraries/MsgFlag.sol";
import "locklift/src/console.sol";


struct WithdrawRequest {
    uint128 amount;
}
contract StEverAccount is IStEverAccount {
    address vault; // setup from initData
    address user; // setup from initData

    uint32 currentVersion;
    //constant

    uint128 constant MAX_PENDING_COUNT = 50;


    // mappings
    mapping(uint64 => WithdrawRequest) public withdrawRequests;

    constructor() public {
    }

    // should be called in onCodeUpgrade on platform initialization
    function _init() internal {

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
			} AccountDetails(user, vault);
	}

    function addPendingValue(uint64 _nonce, uint128 _amount) override external onlyVault {
        tvm.rawReserve(_reserve(), 0);
        if (withdrawRequests.keys().length < MAX_PENDING_COUNT && !withdrawRequests.exists(_nonce)) {
            withdrawRequests[_nonce] = WithdrawRequest(_amount);
            IStEverVault(vault).onPendingWithdrawAccepted{value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false}(_nonce, user);
            return;
        }
        IStEverVault(vault).onPendingWithdrawRejected{value: 0, flag:MsgFlag.ALL_NOT_RESERVED, bounce: false}(_nonce, user, _amount);
    }

    function resetPendingValues(mapping(uint64 => uint128) rejectedWithdrawals) override external onlyVault {
        tvm.rawReserve(_reserve(), 0);

        for ((uint64 nonce, uint128 amount) : rejectedWithdrawals) {
            withdrawRequests[nonce] = WithdrawRequest(amount);
        }

        vault.transfer({value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false});
    }

    function removePendingWithdraw(uint64 _nonce) override external onlyVault {
        tvm.rawReserve(_reserve(), 0);
        if (withdrawRequests.exists(_nonce)) {
            WithdrawRequest withdrawRequest = withdrawRequests[_nonce];
            delete withdrawRequests[_nonce];
            IStEverVault(vault).onPendingWithdrawRemoved{
                value:0,
                flag:MsgFlag.ALL_NOT_RESERVED,
                bounce: false
            }(user, _nonce, withdrawRequest.amount);
            return;
        }
        user.transfer({value:0, flag:MsgFlag.ALL_NOT_RESERVED, bounce: false});
    }

    function processWithdraw(uint64[] _satisfiedWithdrawRequests) override external onlyVault {
        tvm.rawReserve(_reserve(), 0);

        uint128 totalAmount = 0;
        mapping(uint64 => uint128) withdrawals;

        for (uint256 i = 0; i < _satisfiedWithdrawRequests.length; i++) {
            uint64 withdrawRequestKey = _satisfiedWithdrawRequests[i];
            if (withdrawRequests.exists(withdrawRequestKey)) {
                WithdrawRequest withdrawRequest = withdrawRequests[withdrawRequestKey];
                withdrawals[withdrawRequestKey] = withdrawRequest.amount;
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

    function onCodeUpgrade(TvmCell _upgrade_data) private {
        tvm.resetStorage();
        tvm.rawReserve(_reserve(), 0);
        TvmSlice s = _upgrade_data.toSlice();
        (address root_, , address send_gas_to, TvmCell platformCode) = s.decode(address, uint8, address,TvmCell);
        vault = root_;

        TvmSlice initialData = s.loadRefAsSlice();
        user = initialData.decode(address);

        send_gas_to.transfer({value: 0, bounce: false, flag: MsgFlag.ALL_NOT_RESERVED});
    }
}
