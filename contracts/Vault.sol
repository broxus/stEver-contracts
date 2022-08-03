pragma ton-solidity >=0.61.0;
pragma AbiHeader expire;
pragma AbiHeader pubkey;
import "./interfaces/IStrategy.sol";
import "./WithdrawUserData.sol";
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
        TvmCell _withdrawUserDataCode
    ) public {
        tvm.accept();
        owner = _owner;
        withdrawUserDataCode = _withdrawUserDataCode;
    }

    // strategy
    function addStrategy(address _strategy) override external onlyGovernance {
        tvm.accept();
        strategies[_strategy] = StrategyParams(
            now,
            0,
            0,
            0
        );
        emit StrategyAdded(_strategy);
    }

    function depositToStrategies(DepositConfig[] depositConfig) override external onlyGovernance {
        tvm.accept();
        for (uint256 i = 0; i < depositConfig.length; i++) {
            DepositConfig depositConfig = depositConfig[i];
            require(strategies.exists(depositConfig.strategy),STRATEGY_NOT_EXISTS);

            require(strategies[depositConfig.strategy].depositingAmount == 0,CANT_DEPOSIT_UNTILS_STRATEGY_IN_DEPOSIT_STATE);

            strategies[depositConfig.strategy].depositingAmount = depositConfig.amount;
            availableEverBalance -= depositConfig.amount;
            // TODO fix hardcode
            IStrategy(depositConfig.strategy).deposit{value:depositConfig.amount + 0.6 ton}(uint64(depositConfig.amount));
        }
    }

    function onStrategyHandledDeposit() override external onlyStrategy(msg.sender) {
        tvm.accept();
        strategies[msg.sender].totalAssets = strategies[msg.sender].depositingAmount;
        strategies[msg.sender].depositingAmount = 0;
        emit StrategyHandledDeposit(msg.sender,msg.value);
    }

    function onStrategyDidntHandleDeposit() override external onlyStrategy(msg.sender) {
        tvm.accept();
        uint128 deposotingAmount = strategies[msg.sender].depositingAmount;
        strategies[msg.sender].depositingAmount = 0;
        emit StrategyDidintHandleDeposit(msg.sender,deposotingAmount);
    }

    function strategyReport(uint128 gain, uint128 loss, uint128 totalAssets) override external {
        strategies[msg.sender].lastReport = now;
        strategies[msg.sender].totalGain += gain;   
        strategies[msg.sender].totalAssets += totalAssets;
        everBalance += gain;
        emit StrategyReported(msg.sender,StrategyReport(gain,loss,totalAssets));
    }

    function processWithdrawFromStrategies(WithdrawConfig[] withdrawConfig) override external onlyGovernance {
        tvm.accept();
        for (uint128 i = 0; i < withdrawConfig.length; i++) {
            WithdrawConfig config  = withdrawConfig[i];
            IStrategy(config.strategy).withdraw{value:config.fee}(uint64(config.amount),config.fee);
        }
    }

    function receiveFromStrategy(uint128 fee) override external onlyStrategy(msg.sender) {
        tvm.rawReserve(_reserve(),0);
        uint128 amountReceived = msg.value - fee;
        strategies[msg.sender].totalAssets -= amountReceived;
        availableEverBalance += amountReceived;
        emit StrategyWithdrawSuccess(msg.sender,amountReceived);
    }

    function strategyBalanceUpdated(uint128 update,bool isIncreased) override external onlyStrategy(msg.sender) {
        tvm.rawReserve(_reserve(),0);
        if (isIncreased) {
            strategies[msg.sender].totalAssets += update;
            return;
        }
        strategies[msg.sender].totalAssets -= update;
    }


    // deposit
    function deposit(uint128 _amount,uint64 _nonce) override external {
        require(msg.value >= _amount+DEPOSIT_FEE,NOT_ENOUGH_DEPOSIT_VALUE);
        tvm.rawReserve(address(this).balance - (msg.value - _amount),0);
        uint128 amountToSend = getDepositStEverAmount(_amount);
        everBalance += _amount;
        availableEverBalance += _amount;
        stEverSupply += amountToSend;
        TvmBuilder builder;
		builder.store(_nonce);

        emit Deposit(msg.sender,_amount,amountToSend);
        ITokenRoot(stTokenRoot).mint{
                value: 0,
                bounce: false,
                flag:MsgFlag.ALL_NOT_RESERVED
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
        if(msg.value < WITHDRAW_FEE_FOR_GOVERNANCE + WITHDRAW_FEE_FOR_USER_DATA) {
            tvm.rawReserve(_reserve(),0);
            emit BadWithdrawRequest(_sender,_amount,msg.value);
            ITokenWallet(stEverWallet).transfer{value:0,flag:MsgFlag.ALL_NOT_RESERVED}(
                _amount,
                _sender,
                0,
                _sender,
                false,
                _payload
            );
            return;
        }
        tvm.rawReserve(address(this).balance - (msg.value - WITHDRAW_FEE_FOR_GOVERNANCE),0);
        requestWithdraw(_sender,_amount,_payload);
    }

    function requestWithdraw(address _user,uint128 _amount,TvmCell _payload) internal {
        address userDataAddr = getWithdrawUserDataAddress(_user);
        (address deposit_owner, uint64 _nonce, bool correct) = decodeDepositPayload(_payload);
        pendingWithdrawMap[_nonce] = PendingWithdraw(_amount,_user);
        addPendingValueToUserData(_nonce,_amount,userDataAddr,0,MsgFlag.ALL_NOT_RESERVED);
    }

    function handleAddPendingValueError(TvmSlice slice) internal {
        tvm.rawReserve(_reserve(), 0);
        uint64 _withdraw_nonce = slice.decode(uint64);
        PendingWithdraw pendingWithdraw = pendingWithdrawMap[_withdraw_nonce];
        deployWithdrawUserData(pendingWithdraw.user);
        address withdrawUserData = getWithdrawUserDataAddress(pendingWithdraw.user);
        addPendingValueToUserData(_withdraw_nonce,pendingWithdraw.amount,withdrawUserData,0,MsgFlag.ALL_NOT_RESERVED);
    }

    function addPendingValueToUserData(uint64 _withdraw_nonce, uint128 amount, address withdrawUserData, uint128 _value, uint8 _flag) internal {
        IWithdrawUserData(withdrawUserData).addPendingValue{
            value:_value,
            flag: _flag
        }(_withdraw_nonce,amount);
    }

    function onPendingWithdrawAccepted(uint64 _nonce,address user) override external {
       tvm.rawReserve(_reserve(), 0);
       PendingWithdraw pendingWithdraw = pendingWithdrawMap[_nonce];
       emit WithdrawRequest(pendingWithdraw.user,pendingWithdraw.amount,_nonce);
       pendingWithdraw.user.transfer({value:0,flag:MsgFlag.ALL_NOT_RESERVED});
       delete pendingWithdrawMap[_nonce];
    }

    function processSendToUser(SendToUserConfig[] sendConfig) override external onlyGovernance {
        tvm.accept();
        for (uint128 i = 0; i < sendConfig.length; i++) {
            SendToUserConfig config = sendConfig[i];
            address withdrawUserData = getWithdrawUserDataAddress(config.user);
            IWithdrawUserData(withdrawUserData).processWithdraw{value:EXPEREMENTAL_FEE}(config.nonces);
        }

    }

    function withdrawToUser(
        uint128 amount,
        address user,
        DumpWithdraw[] withdrawDump
    ) override external onlyWithdrawUserData {
        tvm.rawReserve(_reserve(), 0);
        // if not enough balance, reset pending to the UserData;
        uint128 everAmount = getWithdrawEverAmount(amount);
        if(availableEverBalance < amount) {
            for (uint256 i = 0; i < withdrawDump.length; i++) {
                DumpWithdraw dump = withdrawDump[i];
                pendingWithdrawMap[dump.nonce] = PendingWithdraw(dump.amount,user);
                emit WithdrawError(user,dump.nonce,amount);
                return addPendingValueToUserData(dump.nonce,dump.amount,msg.sender,0,MsgFlag.ALL_NOT_RESERVED);
            }
        }
       everBalance -= everAmount;
       availableEverBalance -= everAmount;
       stEverSupply -= amount;
       
        TvmBuilder builder;
        builder.store(user);
        builder.store(everAmount);
        TokenWalletBurnableBase(stEverWallet).burn{value:0,flag:MsgFlag.ALL_NOT_RESERVED}(
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
        TvmSlice slice = payload.toSlice();
        address user = slice.decode(address);
        uint128 everAmount = slice.decode(uint128);
        tvm.rawReserve(_reserveWithValue(everAmount), 0);
        emit WithdrawSuccess(user,everAmount);
        user.transfer({value:everAmount});
    }

    // TODO 
    function onRunBalancer(BalancingConfig[] balancerConfig) override external onlyGovernance {
        
    }


    onBounce(TvmSlice slice) external {
		tvm.accept();
		uint32 functionId = slice.decode(uint32);
		if (functionId == tvm.functionId(WithdrawUserData.addPendingValue)) {
			handleAddPendingValueError(slice);
		}
	}

}