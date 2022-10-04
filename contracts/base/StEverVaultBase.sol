pragma ever-solidity >=0.62.0;


import "./StEverVaultStorage.sol";
import "../interfaces/IStEverVault.sol";
import "../StEverAccount.sol";
import "../Platform.sol";
import "../utils/ErrorCodes.sol";
import "../utils/Gas.sol";

import "broxus-ton-tokens-contracts/contracts/interfaces/ITokenRoot.sol";
import "@broxus/contracts/contracts/libraries/MsgFlag.sol";

abstract contract StEverVaultBase is StEverVaultStorage {
    //modifiers
    modifier onlyGovernanceAndAccept() {
        require (msg.pubkey() == governance, ErrorCodes.NOT_GOVERNANCE);
        tvm.accept();
        _;
    }

    modifier onlyGovernanceOrSelfAndAccept() {
        require (msg.pubkey() == governance || msg.sender == address(this), ErrorCodes.NOT_GOVERNANCE);
        tvm.accept();
        _;
    }

    modifier onlySelf() {
        require(msg.sender == address(this), ErrorCodes.NOT_SELF);
        _;
    }

    modifier onlyOwner() {
        require (msg.sender == owner,ErrorCodes.NOT_OWNER);
        _;
    }

    modifier onlyAccount(address _user) {
        address account = getAccountAddress(_user);

        require (msg.sender == account, ErrorCodes.NOT_USER_DATA);
        _;
    }

    modifier onlyStrategy() {
        require (strategies.exists(msg.sender), ErrorCodes.STRATEGY_NOT_EXISTS);
        _;
    }

    modifier minCallValue() {
        require (msg.value >= StEverVaultGas.MIN_CALL_MSG_VALUE, ErrorCodes.LOW_MSG_VALUE);
        _;
    }

    modifier notPaused() {
        require(!isPaused, ErrorCodes.ST_EVER_VAULT_PAUSED);
        _;
    }

    // ownership
    function transferOwnership(address _newOwner, address _sendGasTo) override external onlyOwner {
        tvm.rawReserve(_reserve(), 0);

        owner = _newOwner;

        _sendGasTo.transfer({value: 0, flag:MsgFlag.ALL_NOT_RESERVED, bounce: false});
    }

    function transferGovernance(uint256 _newGovernance, address _sendGasTo) override external onlyOwner {
        tvm.rawReserve(_reserve(), 0);

        governance = _newGovernance;

        _sendGasTo.transfer({value: 0, flag:MsgFlag.ALL_NOT_RESERVED, bounce: false});
    }


    function receiveTokenWalletAddress(address _wallet) external virtual {
        require (msg.sender == stTokenRoot, ErrorCodes.NOT_ROOT_WALLET);
		stEverWallet = _wallet;
	}

    // setters
    function setGainFee(uint128 _gainFee) override external onlyOwner {
        tvm.rawReserve(_reserve(), 0);

        gainFee = _gainFee;

        owner.transfer({value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false});
    }

    function setMinStrategyDepositValue(uint128 _minStrategyDepositValue) override external onlyOwner {
        tvm.rawReserve(_reserve(), 0);

        minStrategyDepositValue = _minStrategyDepositValue;

        owner.transfer({value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false});
    }

    function setMinStrategyWithdrawValue(uint128 _minStrategyWithdrawValue) override external onlyOwner {
        tvm.rawReserve(_reserve(), 0);

        minStrategyWithdrawValue = _minStrategyWithdrawValue;

        owner.transfer({value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false});
    }
     
    function setStEverFeePercent(uint32 _stEverFeePercent) override external onlyOwner {
        require (_stEverFeePercent <= Constants.ONE_HUNDRED_PERCENT, ErrorCodes.BAD_FEE_PERCENT);

        tvm.rawReserve(_reserve(), 0);

        stEverFeePercent = _stEverFeePercent;
        msg.sender.transfer({value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce:false});
    }

    function setIsPaused(bool _isPaused) override external onlyOwner minCallValue {
        tvm.rawReserve(_reserve(), 0);

        isPaused = _isPaused;

        emit PausedStateChanged(_isPaused);

        owner.transfer({value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false});
    }

    // predicates
    function canTransferValue(uint128 _amount) internal view returns (bool) {
        return availableAssets > StEverVaultGas.MIN_AVAILABLE_ASSETS_VALUE &&
         availableAssets - StEverVaultGas.MIN_AVAILABLE_ASSETS_VALUE >= _amount;
    }

    function isStrategyInInitialState(address _strategy) internal view returns (bool) {
        StrategyParams strategy = strategies[_strategy];
        return strategy.depositingAmount == 0 &&  strategy.withdrawingAmount == 0;
    }

    // utils
    function _reserve() internal pure returns (uint128) {
		return
			math.max(address(this).balance - msg.value, StEverVaultGas.CONTRACT_MIN_BALANCE);
	}

    function _reserveWithValue(uint128 _value) internal pure returns (uint128) {
		return math.max(address(this).balance - msg.value - _value, StEverVaultGas.CONTRACT_MIN_BALANCE);
	}

    function _reserveExceptFee(uint128 _fee) internal pure returns (uint128) {
		return math.max(address(this).balance - (msg.value - _fee), StEverVaultGas.CONTRACT_MIN_BALANCE);
	}

    function encodeDepositPayload(uint64 _nonce) external override pure returns (TvmCell depositPayload) {
        TvmBuilder builder;
        builder.store(_nonce);
        return builder.toCell();
    }

    function decodeDepositPayload(TvmCell _payload) public virtual pure returns (uint64 nonce, bool correct) {
        // check if payload assembled correctly
        TvmSlice slice = _payload.toSlice();
        // 1 cell
        if (!slice.hasNBitsAndRefs(32, 0)) {
            return (0, false);
        }

        nonce = slice.decode(uint64);

        return (nonce, true);
    }
        // when the user deposits we should calculate the amount of stEver to send
    function getDepositStEverAmount(uint128 _amount) public view returns(uint128) {
        if(stEverSupply == 0 || totalAssets == 0) {
            return _amount;
        }
        return math.muldiv(_amount, stEverSupply, totalAssets);
    }
        // when the user withdraw we should calculate the amount of ever to send
    function getWithdrawEverAmount(uint128 _amount) public view returns(uint128) {
        if(stEverSupply == 0 || totalAssets == 0) {
            return _amount;
        }
        return math.muldiv(_amount, totalAssets, stEverSupply);
    }

    function getWithdrawToUserInfo(mapping(uint64 => IStEverAccount.WithdrawRequest) _withdrawals) internal view returns(mapping(uint64 => WithdrawToUserInfo)) {

        mapping(uint64 => WithdrawToUserInfo) withdrawInfo;

        for ((uint64 nonce, IStEverAccount.WithdrawRequest withdrawRequest) : _withdrawals) {
            withdrawInfo[nonce] = WithdrawToUserInfo({
                stEverAmount: withdrawRequest.amount,
                everAmount: getWithdrawEverAmount(withdrawRequest.amount)
            });
        }

        return withdrawInfo;
    }


    // account utils
    function _buildAccountParams(address _user) internal virtual pure returns (TvmCell) {
        TvmBuilder builder;
        builder.store(_user);
        return builder.toCell();
    }

    function _buildInitAccount(TvmCell _initialData)
		internal
		view
		virtual
		returns (TvmCell)
	{
		return
			tvm.buildStateInit({
				contr: Platform,
				varInit: {
					root: address(this),
                    platformType: 0,
                    initialData: _initialData,
                    platformCode: platformCode
				},
				pubkey: 0,
				code: platformCode
			});
	}

    function deployAccount(address _user)
		internal
		virtual
        view
		returns (address)
	{
        TvmBuilder constructor_params;
        constructor_params.store(accountVersion);
        constructor_params.store(accountVersion);
        return new Platform{
            stateInit: _buildInitAccount(_buildAccountParams(_user)),
            value: StEverVaultGas.USER_DATA_DEPLOY_VALUE
        }(accountCode, constructor_params.toCell(), _user);
	}

    function getAccountAddress(address _user)
		public
		view
		virtual
		responsible
		returns (address)
	{
		return
			{value: 0, flag: MsgFlag.REMAINING_GAS, bounce: false} address(
				tvm.hash(_buildInitAccount(_buildAccountParams(_user)))
			);
	}
    function setNewAccountCode(TvmCell _newAccountCode) override external onlyOwner minCallValue {
        tvm.rawReserve(_reserve(), 0);

        accountCode = _newAccountCode;
        accountVersion += 1;

        emit NewAccountCodeSet(accountVersion);

        owner.transfer({value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false});
    }

    function upgradeStEverAccount() override external minCallValue {
        tvm.rawReserve(_reserve(), 0);

        address userData = getAccountAddress(msg.sender);
        IStEverAccount(userData).upgrade{value: StEverVaultGas.MIN_CALL_MSG_VALUE}(accountCode, accountVersion, msg.sender);
    }

    function upgradeStEverAccounts(address _sendGasTo, address[] _users) override external minCallValue onlyOwner {
        require(msg.value >= _users.length * StEverVaultGas.MIN_CALL_MSG_VALUE + StEverVaultGas.MIN_CALL_MSG_VALUE, ErrorCodes.NOT_ENOUGH_VALUE);
        tvm.rawReserve(_reserve(), 0);
        this._upgradeStEverAccounts{value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false}(_sendGasTo, _users, 0);
    }

    function _upgradeStEverAccounts(address _sendGasTo, address[] _users, uint128 _startIdx) override external onlySelf {
        tvm.rawReserve(_reserve(), 0);
        uint128 batchSize = 50;
        for (; _startIdx < _users.length && batchSize != 0; _startIdx++) {
            address user = _users[_startIdx];
            batchSize--;

            address userData = getAccountAddress(user);

            IStEverAccount(userData).upgrade{value: StEverVaultGas.MIN_CALL_MSG_VALUE}(accountCode, accountVersion, _sendGasTo);
        }

        if (_startIdx < _users.length) {
            this._upgradeStEverAccounts{value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false}(_sendGasTo, _users, _startIdx);
            return;
        }

        _sendGasTo.transfer({value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false});
    }

    function onAccountUpgraded(address _user, address _sendGasTo, uint32 _newVersion) override external onlyAccount(_user) {

        tvm.rawReserve(_reserve(), 0);

        emit AccountUpgraded(_user, _newVersion);
        _sendGasTo.transfer({value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false});
    }

    function getDetails() override external responsible view returns(Details) {
        return {value:0, bounce: false, flag: MsgFlag.REMAINING_GAS} Details(
                stTokenRoot,
                stEverWallet,
                stEverSupply,
                totalAssets,
                availableAssets,
                owner,
                governance,
                gainFee,
                accountVersion,
                stEverVaultVersion,
                minStrategyDepositValue,
                minStrategyWithdrawValue,
                isPaused,
                stEverFeePercent,
                totalStEverFee,
                emergencyState
            );
    }
}
