pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;
pragma AbiHeader pubkey;


import "./interfaces/IStrategy.sol";
import "./StEverAccount.sol";
import "./base/StEverVaultBase.sol";
import "./utils/ErrorCodes.sol";

import "@broxus/contracts/contracts/libraries/MsgFlag.sol";
import "broxus-ton-tokens-contracts/contracts/interfaces/ITokenRoot.sol";
import "broxus-ton-tokens-contracts/contracts/interfaces/ITokenWallet.sol";
import "broxus-ton-tokens-contracts/contracts/interfaces/IAcceptTokensBurnCallback.sol";
import "broxus-ton-tokens-contracts/contracts/interfaces/IAcceptTokensTransferCallback.sol";
import "broxus-ton-tokens-contracts/contracts/abstract/TokenWalletBurnableBase.sol";
import "locklift/src/console.sol";


contract StEverVault is StEverVaultBase,IAcceptTokensBurnCallback,IAcceptTokensTransferCallback {
    constructor(
        address _owner,
        uint128 _gainFee
    ) public {
        tvm.accept();
        owner = _owner;
        gainFee = _gainFee;
    }


    function addStrategy(address _strategy) override external onlyOwner minCallValue {
        tvm.rawReserve(_reserve(),0);

        strategies[_strategy] = StrategyParams(
            0,
            0,
            0,
            0
        );
        emit StrategyAdded(_strategy);

        owner.transfer({value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false});
    }

    function removeStrategy(address _strategy) override external onlyOwner minCallValue {
        require (strategies.exists(_strategy));

        tvm.rawReserve(_reserve(),0);

        emit StrategyRemoved(_strategy);
        delete strategies[_strategy];

        owner.transfer({value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false});
    }

    function validateDepositRequest(mapping (uint256 => DepositConfig) _depositConfigs) override public view returns(ValidationResult[]) {
        ValidationResult[] validationResults;

        uint128 totalRequiredBalance;

        for (uint256 i = 0; !_depositConfigs.empty(); i++) {

            (, DepositConfig depositConfig) = _depositConfigs.delMin().get();

            address strategy = depositConfig.strategy;

            if(!strategies.exists(strategy)) {
                validationResults.push(ValidationResult(strategy, ErrorCodes.STRATEGY_NOT_EXISTS));
            }

            if(depositConfig.amount < minStrategyDepositValue) {
                validationResults.push(ValidationResult(strategy, ErrorCodes.BAD_DEPOSIT_TO_STRATEGY_VALUE));
            }
            
            uint128 valueToSend = depositConfig.amount + depositConfig.fee;
            totalRequiredBalance += valueToSend;

            if(!isCanTransferValue(totalRequiredBalance)) {
                validationResults.push(ValidationResult(strategy, ErrorCodes.NOT_ENOUGH_VALUE_TO_DEPOSIT));
            }

            if(strategies[depositConfig.strategy].depositingAmount != 0) {
                validationResults.push(ValidationResult(strategy, ErrorCodes.STRATEGY_IN_DEPOSITING_STATE));
            }
        }
        return validationResults;
    }

    function depositToStrategies(mapping (uint256 => DepositConfig) _depositConfigs) override external onlyGovernanceOrSelfAndAccept {
        uint256 chunkSize = 50;

        for (uint256 i = 0; i < chunkSize && !_depositConfigs.empty(); i++) {

            (, DepositConfig depositConfig) = _depositConfigs.delMin().get();

            // calculate required amount to send
            uint128 valueToSend = depositConfig.amount + depositConfig.fee;
            require(isCanTransferValue(valueToSend), ErrorCodes.NOT_ENOUGH_VALUE_TO_DEPOSIT);

            require (strategies.exists(depositConfig.strategy), ErrorCodes.STRATEGY_NOT_EXISTS);

            require (depositConfig.amount >= minStrategyDepositValue, ErrorCodes.BAD_DEPOSIT_TO_STRATEGY_VALUE);

            require (strategies[depositConfig.strategy].depositingAmount == 0, ErrorCodes.STRATEGY_IN_DEPOSITING_STATE);

            // change depositing strategy state
            strategies[depositConfig.strategy].depositingAmount = depositConfig.amount;

            // reduce availableAssets
            availableAssets -= valueToSend;

            // grab fee from total assets, then add it back after receiving response from strategy
            totalAssets -= depositConfig.fee;

            IStrategy(depositConfig.strategy).deposit{value: depositConfig.amount + depositConfig.fee, bounce: false}(uint64(depositConfig.amount));
        }
        if (!_depositConfigs.empty()) {
            this.depositToStrategies{value: StEverVaultGas.SEND_SELF_VALUE, bounce: false}(_depositConfigs);
        }
    }

    function onStrategyHandledDeposit() override external onlyStrategy {
        uint128 depositingAmount = strategies[msg.sender].depositingAmount;
        // set init state for depositing
        strategies[msg.sender].depositingAmount = 0;

        // calculate remaining gas
        uint128 returnedFee = (msg.value - StEverVaultGas.HANDLING_STRATEGY_CB_FEE);

        // add fee back
        availableAssets += returnedFee;
        totalAssets += returnedFee;
        emit StrategyHandledDeposit(msg.sender, depositingAmount);
    }



    function onStrategyDidntHandleDeposit(uint32 _errcode) override external onlyStrategy {
        uint128 depositingAmount = strategies[msg.sender].depositingAmount;
        // set init state for depositing
        strategies[msg.sender].depositingAmount = 0;

        availableAssets += msg.value - StEverVaultGas.HANDLING_STRATEGY_CB_FEE;

        // add fee back to total assets
        if (depositingAmount > msg.value) {
        // if depositing amount gt msg.value therefore we spent more than attached fee
            totalAssets -= depositingAmount - msg.value + StEverVaultGas.HANDLING_STRATEGY_CB_FEE;
        }
        if (msg.value > depositingAmount) {
            totalAssets += msg.value - depositingAmount - StEverVaultGas.HANDLING_STRATEGY_CB_FEE;
        }
        emit StrategyDidntHandleDeposit(msg.sender, _errcode);
    }

    function strategyReport(uint128 _gain, uint128 _loss, uint128 _totalAssets, uint128 _requestedBalance) override external onlyStrategy {
        
        strategies[msg.sender].lastReport = now;
        strategies[msg.sender].totalGain += _gain;
        uint128 gainWithoutFee = _gain > gainFee ? _gain - gainFee : _gain;
        totalAssets += gainWithoutFee;
        emit StrategyReported(msg.sender, StrategyReport(gainWithoutFee, _loss, _totalAssets));

        uint128 sendValueToStrategy;
        if (_requestedBalance > 0 && isCanTransferValue(_requestedBalance)) {
            totalAssets -= _requestedBalance;
            availableAssets -= _requestedBalance;
            sendValueToStrategy = _requestedBalance;
        }
        tvm.rawReserve(_reserveWithValue(sendValueToStrategy), 0);
        msg.sender.transfer({value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false});
    }
    
    function validateWithdrawFromStrategiesRequest(mapping (uint256 => WithdrawConfig) _withdrawConfig) override public view returns (ValidationResult[]) {
        ValidationResult[] validationResults;

        uint128 totalRequiredBalance;
        
        for (uint256 i = 0; !_withdrawConfig.empty(); i++) {
            (,WithdrawConfig config) = _withdrawConfig.delMin().get();

            address strategy = config.strategy;

            if(config.amount < minStrategyWithdrawValue) {
                validationResults.push(ValidationResult(strategy, ErrorCodes.BAD_WITHDRAW_FROM_STRATEGY_VALUE));
            }

            if(!strategies.exists(config.strategy)) {
                validationResults.push(ValidationResult(strategy, ErrorCodes.STRATEGY_NOT_EXISTS));
            }
            totalRequiredBalance += config.fee;
            if(!isCanTransferValue(totalRequiredBalance)) {
                validationResults.push(ValidationResult(strategy, ErrorCodes.NOT_ENOUGH_VALUE_TO_WITHDRAW));
            }

            if(strategies[config.strategy].withdrawingAmount != 0) {
                validationResults.push(ValidationResult(strategy, ErrorCodes.NOT_ENOUGH_VALUE_TO_WITHDRAW));
            }
        }
        return validationResults;
    }

    function processWithdrawFromStrategies(mapping (uint256 => WithdrawConfig) _withdrawConfig) override external onlyGovernanceOrSelfAndAccept {
        uint256 chunkSize = 50;

        for (uint256 i = 0; i < chunkSize && !_withdrawConfig.empty(); i++) {
            (,WithdrawConfig config) = _withdrawConfig.delMin().get();

            require (config.amount >= minStrategyWithdrawValue, ErrorCodes.BAD_WITHDRAW_FROM_STRATEGY_VALUE);

            require (strategies.exists(config.strategy), ErrorCodes.STRATEGY_NOT_EXISTS);

            require (isCanTransferValue(config.fee), ErrorCodes.NOT_ENOUGH_VALUE_TO_WITHDRAW);

            require (strategies[config.strategy].withdrawingAmount == 0, ErrorCodes.STRATEGY_IN_WITHDRAWING_STATE);

            // grab fee, then add it back after receiving response from strategy
            availableAssets -= config.fee;
            totalAssets -= config.fee;

            // change withdrawing strategy state
            strategies[config.strategy].withdrawingAmount = config.amount;

            IStrategy(config.strategy).withdraw{value:config.fee, bounce: false}(uint64(config.amount));
        }
        if (!_withdrawConfig.empty()) {
            this.processWithdrawFromStrategies{value: StEverVaultGas.SEND_SELF_VALUE, bounce:false}(_withdrawConfig);
        }
    }

    function onStrategyHandledWithdrawRequest() override external onlyStrategy {
        // set back remaining gas after withdraw request
        availableAssets += msg.value - StEverVaultGas.HANDLING_STRATEGY_CB_FEE;
        totalAssets += msg.value - StEverVaultGas.HANDLING_STRATEGY_CB_FEE;
        
        emit StrategyHandledWithdrawRequest(msg.sender, strategies[msg.sender].withdrawingAmount);
    }

    function receiveFromStrategy() override external onlyStrategy {
        uint128 withdrawingAmount = strategies[msg.sender].withdrawingAmount;
        // set init state for withdrawing
        strategies[msg.sender].withdrawingAmount = 0;
        
        uint128 receivedAmount = msg.value - StEverVaultGas.HANDLING_STRATEGY_CB_FEE;

        availableAssets += receivedAmount;
        
        emit StrategyWithdrawSuccess(msg.sender, receivedAmount);
        
    }

    function withdrawFromStrategyError(uint32 _errcode) override external onlyStrategy {
        // set init state for withdrawing
        strategies[msg.sender].withdrawingAmount = 0;

        // calculate remaining gas
        uint128 notUsedFee = msg.value - StEverVaultGas.HANDLING_STRATEGY_CB_FEE;

        // set remaining gas
        availableAssets += notUsedFee;

        emit StrategyWithdrawError(msg.sender, _errcode);
    }
    // deposit
    function deposit(uint128 _amount, uint64 _nonce) override external {
        require (msg.value >= _amount + StEverVaultGas.MIN_CALL_MSG_VALUE, ErrorCodes.NOT_ENOUGH_DEPOSIT_VALUE);

        tvm.rawReserve(address(this).balance - (msg.value - _amount), 0);

        uint128 amountToSend = getDepositStEverAmount(_amount);

        totalAssets += _amount;
        availableAssets += _amount;
        stEverSupply += amountToSend;

        TvmBuilder builder;
		builder.store(_nonce);

        emit Deposit(msg.sender, _amount, amountToSend);
        ITokenRoot(stTokenRoot).mint{
            value: 0,
            flag: MsgFlag.ALL_NOT_RESERVED,
            bounce: false
        }(
            amountToSend,
            msg.sender,
            StEverVaultGas.ST_EVER_WALLET_DEPLOY_VALUE,
            msg.sender,
            false,
            builder.toCell()
        );
    }


    // withdraw
    function onAcceptTokensTransfer(
        address _tokenRoot,
        uint128 _amount,
        address _sender,
        address _senderWallet,
        address _remainingGasTo,
        TvmCell _payload
    ) override external {
        require (msg.sender == stEverWallet, ErrorCodes.NOT_ROOT_WALLET);

        // if not enough value, resend tokens to sender
        if (msg.value < StEverVaultGas.WITHDRAW_FEE + StEverVaultGas.WITHDRAW_FEE_FOR_USER_DATA) {
            tvm.rawReserve(_reserve(), 0);
            emit BadWithdrawRequest(_sender, _amount, msg.value);
            ITokenWallet(stEverWallet).transfer{
                value: 0,
                flag: MsgFlag.ALL_NOT_RESERVED,
                bounce: false
            }(
                _amount,
                _sender,
                0,
                _sender,
                false,
                _payload
            );
            return;
        }
        requestWithdraw(_sender, _amount, _payload);
    }

    function requestWithdraw(address _user, uint128 _amount, TvmCell _payload) internal {
        tvm.rawReserve(address(this).balance - (msg.value - StEverVaultGas.WITHDRAW_FEE), 0);

        address accountAddr = getAccountAddress(_user);

        (, uint64 _nonce, bool correct) = decodeDepositPayload(_payload);

        pendingWithdrawals[_nonce] = PendingWithdraw(_amount, _user);

        addPendingValueToAccount(_nonce, _amount, accountAddr, 0, MsgFlag.ALL_NOT_RESERVED);
    }

    function handleAddPendingValueError(TvmSlice slice) internal {
        tvm.rawReserve(_reserve(), 0);

        uint64 _withdraw_nonce = slice.decode(uint64);

        PendingWithdraw pendingWithdraw = pendingWithdrawals[_withdraw_nonce];

        address account = deployAccount(pendingWithdraw.user);

        addPendingValueToAccount(_withdraw_nonce, pendingWithdraw.amount, account, 0, MsgFlag.ALL_NOT_RESERVED);
    }

    function addPendingValueToAccount(uint64 _withdraw_nonce, uint128 amount, address account, uint128 _value, uint8 _flag) internal {
        IStEverAccount(account).addPendingValue{
            value:_value,
            flag: _flag,
            bounce: true
        }(_withdraw_nonce, amount);
    }

    function onPendingWithdrawAccepted(uint64 _nonce,address user) override external onlyAccount(user) {
       tvm.rawReserve(_reserve(), 0);

       PendingWithdraw pendingWithdraw = pendingWithdrawals[_nonce];
       emit WithdrawRequest(pendingWithdraw.user, pendingWithdraw.amount, _nonce);
       delete pendingWithdrawals[_nonce];

       pendingWithdraw.user.transfer({value:0, flag:MsgFlag.ALL_NOT_RESERVED, bounce:false});
    }

    function onPendingWithdrawRejected(uint64 _nonce, address user, uint128 _amount) override external onlyAccount(user) {
        tvm.rawReserve(_reserveWithValue(StEverVaultGas.WITHDRAW_FEE), 0);

        delete pendingWithdrawals[_nonce];

        TvmCell payload;
        ITokenWallet(stEverWallet).transfer{
            value:0,
            flag:MsgFlag.ALL_NOT_RESERVED,
            bounce:false
        }(
            _amount,
            user,
            0,
            user,
            false,
            payload
        );
    }

    function removePendingWithdraw(uint64 _nonce) override external minCallValue {
        tvm.rawReserve(_reserve(), 0);
        address account = getAccountAddress(msg.sender);
        IStEverAccount(account).removePendingWithdraw{value:0, flag:MsgFlag.ALL_NOT_RESERVED, bounce: false}(_nonce);
    }

    function onPendingWithdrawRemoved(address user, uint64 nonce, uint128 _amount) override external onlyAccount(user) {
        tvm.rawReserve(_reserveWithValue(StEverVaultGas.WITHDRAW_FEE), 0);

        emit WithdrawRequestRemoved(user, nonce);

        TvmCell payload;
        ITokenWallet(stEverWallet).transfer{
            value:0,
            flag:MsgFlag.ALL_NOT_RESERVED,
            bounce:false
        }(
            _amount,
            user,
            0,
            user,
            false,
            payload
        );
    }

    function processSendToUsers(mapping (uint256 => SendToUserConfig) sendConfig) override external onlyGovernanceOrSelfAndAccept {
        uint256 chunkSize = 50;

        for (uint256 i = 0; i < chunkSize && !sendConfig.empty(); i++) {
            (,SendToUserConfig config) = sendConfig.delMin().get();
            address account = getAccountAddress(config.user);
            IStEverAccount(account).processWithdraw{value: StEverVaultGas.WITHDRAW_FEE * uint128(config.nonces.length), bounce: false}(config.nonces);
        }

        if (!sendConfig.empty()) {
            this.processSendToUsers{value: StEverVaultGas.SEND_SELF_VALUE, bounce: false}(sendConfig);
        }
    }

    function withdrawToUser(
        uint128 amount,
        address user,
        uint128[] amountsWithdrawn,
        uint64[] noncesWithdrawn
    ) override external onlyAccount(user) {
        tvm.rawReserve(_reserve(), 0);
        
        if(amountsWithdrawn.length == 0 || noncesWithdrawn.length == 0) {
            return;
        }

        uint128 everAmount = getWithdrawEverAmount(amount);
        // if not enough balance, reset pending to the Account;
        if (availableAssets < everAmount) {
            emit WithdrawError(user, noncesWithdrawn, amount);
            IStEverAccount(msg.sender).resetPendingValues{value:0, flag:MsgFlag.ALL_NOT_RESERVED, bounce: false}(amountsWithdrawn, noncesWithdrawn);
            return;
        }
        totalAssets -= everAmount;
        availableAssets -= everAmount;
        stEverSupply -= amount;

        TvmBuilder builder;
        builder.store(user);
        builder.store(everAmount);
        builder.store(noncesWithdrawn);

        TokenWalletBurnableBase(stEverWallet).burn{value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false}(
            amount,
            address(this),
            address(this),
            builder.toCell()
        );
    }

    function onAcceptTokensBurn(
        uint128 amount,
        address walletOwner,
        address wallet,
        address remainingGasTo,
        TvmCell payload
    ) override external {
        require (wallet == stEverWallet, ErrorCodes.NOT_ROOT_WALLET);

        TvmSlice slice = payload.toSlice();
        address user = slice.decode(address);
        uint128 everAmount = slice.decode(uint128);
        uint64[] nonces = slice.decode(uint64[]);

        tvm.rawReserve(_reserveWithValue(everAmount), 0);

        emit WithdrawSuccess(user, everAmount, nonces);
        user.transfer({value: 0, flag :MsgFlag.ALL_NOT_RESERVED, bounce: false});
    }

    onBounce(TvmSlice slice) external {
		tvm.accept();
        
		uint32 functionId = slice.decode(uint32);
		if (functionId == tvm.functionId(StEverAccount.addPendingValue)) {
			handleAddPendingValueError(slice);
		}
	}

    // upgrade
    function upgrade(TvmCell _newCode, uint32 _newVersion, address _sendGasTo) override external onlyOwner {
        if (_newVersion == stEverVaultVersion) {
            tvm.rawReserve(_reserve(), 0);
            _sendGasTo.transfer({value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce:false});
            return;
        }

        // should be unpacked in the same order!
        TvmCell data = abi.encode(
            _newVersion,
            _sendGasTo,
            governance,
            platformCode,
            accountCode,
            stEverSupply,
            totalAssets,
            availableAssets,
            stEverWallet,
            stTokenRoot,
            gainFee,
            owner,
            accountVersion,
            strategies,
            pendingWithdrawals
        );

        // set code after complete this method
        tvm.setcode(_newCode);
        // run onCodeUpgrade from new code
        tvm.setCurrentCode(_newCode);

        onCodeUpgrade(data);

    }

    // upgrade to v2
    function onCodeUpgrade(TvmCell _upgradeData) private {}
}
