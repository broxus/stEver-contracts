pragma ton-solidity >=0.61.0;
pragma AbiHeader expire;
pragma AbiHeader pubkey;
import "./interfaces/IStrategy.sol";
import "./StEverAccount.sol";
import "./base/VaultBase.sol";
import "@broxus/contracts/contracts/libraries/MsgFlag.sol";
import "broxus-ton-tokens-contracts/contracts/interfaces/ITokenRoot.sol";
import "broxus-ton-tokens-contracts/contracts/interfaces/ITokenWallet.sol";
import "broxus-ton-tokens-contracts/contracts/interfaces/IAcceptTokensBurnCallback.sol";
import "broxus-ton-tokens-contracts/contracts/interfaces/IAcceptTokensTransferCallback.sol";
import "broxus-ton-tokens-contracts/contracts/abstract/TokenWalletBurnableBase.sol";
import "locklift/src/console.sol";


contract Vault is VaultBase,IAcceptTokensBurnCallback,IAcceptTokensTransferCallback {
    constructor(
        address _owner,
        uint128 _gainFee
    ) public {
        tvm.accept();
        owner = _owner;
        gainFee = _gainFee;
    }

    // strategy
    function addStrategy(address _strategy) override external onlyGovernanceAndAccept {
        strategies[_strategy] = StrategyParams(
            0,
            0,
            0,
            0,
            0
        );
        emit StrategyAdded(_strategy);
    }

    function depositToStrategies(mapping(uint256 => DepositConfig ) depositConfig) override external onlyGovernanceOrSelfAndAccept {
        uint256 chunkSize = 50;
        for (uint256 i = 0; i < chunkSize && !depositConfig.empty(); i++) {
            (, DepositConfig depositConfig) = depositConfig.delMin().get();
            require(strategies.exists(depositConfig.strategy),STRATEGY_NOT_EXISTS);
            uint128 valueToSend = depositConfig.amount + depositConfig.fee;
            require(availableAssets >= valueToSend,NOT_ENOGH_VALUE_TO_DEPOSIT);
            strategies[depositConfig.strategy].depositingAmount = depositConfig.amount;
            availableAssets -= valueToSend;
            // grab fee from total asssets, then add it back after receiving response from strategy
            totalAssets -= depositConfig.fee;
            IStrategy(depositConfig.strategy).deposit{value: depositConfig.amount + depositConfig.fee, bounce: false}(uint64(depositConfig.amount));
        }
        if(!depositConfig.empty()) {
            this.depositToStrategies{value: SEND_SELF_VALUE, bounce: false}(depositConfig);
        }
    }

    function onStrategyHandledDeposit() override external onlyStrategy {
        uint128 returnedFee = msg.value;
        strategies[msg.sender].totalAssets = strategies[msg.sender].depositingAmount;
        strategies[msg.sender].depositingAmount = 0;
        // add fee back to total assests
        totalAssets += msg.value;
        emit StrategyHandledDeposit(msg.sender,returnedFee);
    }

    function onStrategyDidntHandleDeposit(uint32 errcode) override external onlyStrategy {
        uint128 deposotingAmount = strategies[msg.sender].depositingAmount;
        strategies[msg.sender].depositingAmount = 0;
        availableAssets += msg.value;
        // add fee back to total assests
        uint128 returnedFee = deposotingAmount > msg.value ? deposotingAmount - msg.value : msg.value - deposotingAmount;
        totalAssets += returnedFee;
        emit StrategyDidintHandleDeposit(msg.sender,errcode);
    }

    function strategyReport(uint128 gain, uint128 loss, uint128 _totalAssets,uint128 requestedBalance) override external onlyStrategy {
        uint128 gainWithoutFee = gain - gainFee;
        strategies[msg.sender].lastReport = now;
        strategies[msg.sender].totalGain += gainWithoutFee;
        strategies[msg.sender].totalAssets += gainWithoutFee;
        totalAssets += gainWithoutFee;
        emit StrategyReported(msg.sender,StrategyReport(gainWithoutFee,loss,_totalAssets));

        uint128 sendValueToStrategy;
        if(requestedBalance > 0 && availableAssets > requestedBalance) {
            totalAssets -= requestedBalance;
            availableAssets -= requestedBalance;
            sendValueToStrategy = requestedBalance;
        }
        tvm.rawReserve(_reserveWithValue(sendValueToStrategy),0);
        msg.sender.transfer({value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false});
    }

    function processWithdrawFromStrategies(mapping(uint256 => WithdrawConfig) withdrawConfig) override external onlyGovernanceOrSelfAndAccept {
        uint256 chunkSize = 50;
        for(uint256 i = 0;i < chunkSize && !withdrawConfig.empty(); i++) {
            (,WithdrawConfig config) = withdrawConfig.delMin().get();
            require(strategies.exists(config.strategy),STRATEGY_NOT_EXISTS);
            require(availableAssets >= config.fee,NOT_ENOGH_VALUE_TO_WITHDRAW);
            availableAssets -= config.fee;
            totalAssets -= config.fee;
            strategies[config.strategy].withdrawingAmount = config.amount;
            IStrategy(config.strategy).withdraw{value:config.fee, bounce: false}(uint64(config.amount));
        }
        if(!withdrawConfig.empty()) {
            this.processWithdrawFromStrategies{value: SEND_SELF_VALUE, bounce:false}(withdrawConfig);
        }
    }

    function receiveFromStrategy() override external onlyStrategy {
        uint128 notUsedFee = msg.value - strategies[msg.sender].withdrawingAmount;
        strategies[msg.sender].totalAssets -= strategies[msg.sender].withdrawingAmount;
        availableAssets += msg.value;
        totalAssets += notUsedFee;
        emit StrategyWithdrawSuccess(msg.sender,msg.value - notUsedFee);
    }

    function withdrawFromStrategyError(uint32 errocode) override external onlyStrategy {
        uint128 notUsedFee = msg.value;
        totalAssets += notUsedFee;
        availableAssets += notUsedFee;
        emit StrategyWithdrawError(msg.sender,errocode);
    }
    // deposit
    function deposit(uint128 _amount, uint64 _nonce) override external {
        require(msg.value >= _amount + MIN_CALL_MSG_VALUE ,NOT_ENOUGH_DEPOSIT_VALUE);
        tvm.rawReserve(address(this).balance - (msg.value - _amount), 0);
        uint128 amountToSend = getDepositStEverAmount(_amount);
        totalAssets += _amount;
        availableAssets += _amount;
        stEverSupply += amountToSend;
        TvmBuilder builder;
		builder.store(_nonce);

        emit Deposit(msg.sender,_amount,amountToSend);
        ITokenRoot(stTokenRoot).mint{
                value: 0,
                flag:MsgFlag.ALL_NOT_RESERVED,
                bounce: false
            }(
                uint128(amountToSend),
                msg.sender,
                ST_EVER_WALLET_DEPLOY_VALUE,
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
        require(msg.sender == stEverWallet, NOT_ROOT_WALLET);
        // if not enough value, resend tokens to sender
        if(msg.value < WITHDRAW_FEE + WITHDRAW_FEE_FOR_USER_DATA) {
            tvm.rawReserve(_reserve(),0);
            emit BadWithdrawRequest(_sender,_amount,msg.value);
            ITokenWallet(stEverWallet).transfer{
                value:0,
                flag:MsgFlag.ALL_NOT_RESERVED,
                bounce:false
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
        requestWithdraw(_sender,_amount,_payload);
    }

    function requestWithdraw(address _user,uint128 _amount,TvmCell _payload) internal {
        tvm.rawReserve(address(this).balance - (msg.value - WITHDRAW_FEE),0);
        address accountAddr = getAccountAddress(_user);
        (address deposit_owner, uint64 _nonce, bool correct) = decodeDepositPayload(_payload);
        pendingWithdrawMap[_nonce] = PendingWithdraw(_amount,_user);
        addPendingValueToAccount(_nonce,_amount,accountAddr,0,MsgFlag.ALL_NOT_RESERVED);
    }

    function handleAddPendingValueError(TvmSlice slice) internal {
        tvm.rawReserve(_reserve(), 0);
        uint64 _withdraw_nonce = slice.decode(uint64);
        PendingWithdraw pendingWithdraw = pendingWithdrawMap[_withdraw_nonce];
        deployAccount(pendingWithdraw.user);
        address account = getAccountAddress(pendingWithdraw.user);
        addPendingValueToAccount(_withdraw_nonce,pendingWithdraw.amount,account,0,MsgFlag.ALL_NOT_RESERVED);
    }

    function addPendingValueToAccount(uint64 _withdraw_nonce, uint128 amount, address account, uint128 _value, uint8 _flag) internal {
        IStEverAccount(account).addPendingValue{
            value:_value,
            flag: _flag,
            bounce: true
        }(_withdraw_nonce,amount);
    }

    function onPendingWithdrawAccepted(uint64 _nonce,address user) override external onlyAccount(user) {
       tvm.rawReserve(_reserve(), 0);
       PendingWithdraw pendingWithdraw = pendingWithdrawMap[_nonce];
       emit WithdrawRequest(pendingWithdraw.user,pendingWithdraw.amount,_nonce);
       pendingWithdraw.user.transfer({value:0,flag:MsgFlag.ALL_NOT_RESERVED,bounce:false});
       delete pendingWithdrawMap[_nonce];
    }

    function removePendingWithdraw(uint64 _nonce) override external minCallValue {
        tvm.rawReserve(_reserve(), 0);
        address account = getAccountAddress(msg.sender);
        IStEverAccount(account).removePendingWithdraw{value:0, flag:MsgFlag.ALL_NOT_RESERVED, bounce: false}(_nonce);
    }

    function onPendingWithdrawRemoved(address user,uint64 nonce) override external onlyAccount(user) {
        tvm.rawReserve(_reserveWithValue(WITHDRAW_FEE), 0);
        emit WithdrawRequestRemoved(user, nonce);
        user.transfer({value:0 ,flag:MsgFlag.ALL_NOT_RESERVED, bounce:false});
    }

    function processSendToUsers(mapping(uint256 =>SendToUserConfig) sendConfig) override external onlyGovernanceOrSelfAndAccept {
        uint256 chunkSize = 50;
        for(uint256 i = 0;i < chunkSize && !sendConfig.empty();i++) {
            (,SendToUserConfig config) = sendConfig.delMin().get();
            address account = getAccountAddress(config.user);
            IStEverAccount(account).processWithdraw{value:WITHDRAW_FEE * uint128(config.nonces.length), bounce: false}(config.nonces);
        }
        if(!sendConfig.empty()) {
            this.processSendToUsers{value: SEND_SELF_VALUE, bounce: false}(sendConfig);
        }

    }

    function withdrawToUser(
        uint128 amount,
        address user,
        DumpWithdraw[] withdrawDump
    ) override external onlyAccount(user) {
        tvm.rawReserve(_reserve(), 0);

        uint128 everAmount = getWithdrawEverAmount(amount);
        uint64[] noncesToWithdraw;

        for (uint256 i = 0; i < withdrawDump.length; i++) {
            noncesToWithdraw.push(withdrawDump[i].nonce);
        }
        // if not enough balance, reset pending to the Account;
        if(availableAssets < amount) {
            emit WithdrawError(user,noncesToWithdraw,amount);
            IStEverAccount(msg.sender).resetPendingValues{value:0,flag:MsgFlag.ALL_NOT_RESERVED, bounce: false}(withdrawDump);
            return;
        }
        totalAssets -= everAmount;
        availableAssets -= everAmount;
        stEverSupply -= amount;

        TvmBuilder builder;
        builder.store(user);
        builder.store(everAmount);
        builder.store(noncesToWithdraw);


        TokenWalletBurnableBase(stEverWallet).burn{value:0,flag:MsgFlag.ALL_NOT_RESERVED, bounce: false}(
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
        require(wallet == stEverWallet,NOT_ROOT_WALLET);
        TvmSlice slice = payload.toSlice();
        address user = slice.decode(address);
        uint128 everAmount = slice.decode(uint128);
        uint64[] nonces = slice.decode(uint64[]);
        tvm.rawReserve(_reserveWithValue(everAmount), 0);
        emit WithdrawSuccess(user,everAmount,nonces);
        user.transfer({value:0,flag:MsgFlag.ALL_NOT_RESERVED, bounce: false});
    }

    onBounce(TvmSlice slice) external {
		tvm.accept();
		uint32 functionId = slice.decode(uint32);
		if (functionId == tvm.functionId(StEverAccount.addPendingValue)) {
			handleAddPendingValueError(slice);
		}
	}

}
