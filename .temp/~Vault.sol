pragma ton-solidity >=0.61.0;
pragma AbiHeader expire;
import "./interfaces/~IVault.sol";
import "./interfaces/~IStrategy.sol";
import "./~WithdrawUserData.sol";
import "o:/projects/broxus/st-ever/node_modules/@broxus/contracts/contracts/libraries/MsgFlag.sol";
import "o:/projects/broxus/st-ever/node_modules/broxus-ton-tokens-contracts/contracts/interfaces/ITokenRoot.sol";
import "o:/projects/broxus/st-ever/node_modules/broxus-ton-tokens-contracts/contracts/interfaces/ITokenWallet.sol";
import "o:/projects/broxus/st-ever/node_modules/broxus-ton-tokens-contracts/contracts/interfaces/IAcceptTokensBurnCallback.sol";
import "o:/projects/broxus/st-ever/node_modules/broxus-ton-tokens-contracts/contracts/interfaces/IAcceptTokensTransferCallback.sol";
import "o:/projects/broxus/st-ever/node_modules/broxus-ton-tokens-contracts/contracts/abstract/TokenWalletBurnableBase.sol";
import "o:/projects/broxus/st-ever/node_modules/locklift/src/console.sol";

contract Vault is IVault,IAcceptTokensBurnCallback,IAcceptTokensTransferCallback {
    // constant
    uint128 constant CONTRACT_MIN_BALANCE = 1 ton;
    uint128 constant ST_EVER_WALLET_DEPLOY_GRAMS_VALUE = 0.1 ton;
    uint128 constant EXPEREMENTAL_FEE = 0.2 ton;
	uint128 constant ST_EVER_WALLET_DEPLOY_VALUE = 0.5 ton;
    uint128 constant USER_DATA_DEPLOY_VALUE = 0.2 ton;
    uint128 constant DEPOSIT_FEE = 1 ton;
    uint128 constant WITHDRAW_FEE = 1 ton;
    
    // static
    uint128 public static nonce;
    address static governance;
    // balances
    uint128 stEverSupply;
    uint128 everBalance;
    // tokens
    address stEverWallet;
    address stTokenRoot;

    address owner;
    TvmCell public withdrawUserDataCode;
    // mappings
    mapping(address => StrategyParams) strategies;
    mapping(uint64 => PendingWithdraw) pendingWithdrawMap;

    // errors
    uint8 constant NOT_GOVERNANCE = 101;
    uint8 constant BAD_WITHDRAW_CONFIG = 102;
    uint8 constant NOT_ENOUGH_VALUE = 103;
    uint8 constant ONLY_ONE_VALUE_MOVE_PER_STEP = 104;
    uint8 constant NOT_ROOT_WALLET = 105;
    uint8 constant NOT_ENOUGH_ST_EVER = 106;
    uint8 constant STRATEGY_NOT_EXISTS = 107;


    constructor(
        address _owner,
        TvmCell _withdrawUserDataCode
    ) public {
        tvm.accept();
        owner = _owner;
        withdrawUserDataCode = _withdrawUserDataCode;
    }
    //modifiers 
    modifier onlyGovernance() {
        require(msg.sender == governance,NOT_GOVERNANCE);
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    modifier onlyWithdrawUserData() {
        _;
    }

    // utils
    function _reserve() internal pure returns (uint128) {
		return
			math.max(address(this).balance - msg.value, CONTRACT_MIN_BALANCE);
	}

    function _reserveWithValue(uint128 _value) internal pure returns (uint128) {
		return math.max(address(this).balance - msg.value - _value, CONTRACT_MIN_BALANCE);
	}

    function encodeDepositPayload(address deposit_owner, uint64 _nonce) external override pure returns (TvmCell deposit_payload) {
        TvmBuilder builder;
        builder.store(deposit_owner);
        builder.store(_nonce);
        return builder.toCell();
    }

    function decodeDepositPayload(TvmCell payload) public virtual view returns (address deposit_owner, uint64 nonce, bool correct) {
        // check if payload assembled correctly
        TvmSlice slice = payload.toSlice();
        // 1 address and 1 cell
        if (!slice.hasNBitsAndRefs(267 + 32, 0)) {
            return (address.makeAddrNone(), 0, false);
        }

        deposit_owner = slice.decode(address);
        nonce = slice.decode(uint64);

        return (deposit_owner, nonce, true);
    }
        // when the user deposits we should calculate the amount of stEver to send
    function getDepositStEverAmount(uint128 _amount) internal returns(uint128) {
        if(stEverSupply == 0 || everBalance == 0) {
            return _amount;
        }
        return _amount * stEverSupply / everBalance;
    }
        // when the user withdraw we should calculate the amount of ever to send
    function getWithdrawEverAmount(uint128 _amount) internal returns(uint128) {
        if(stEverSupply == 0 || everBalance == 0) {
            return _amount;
        }
        return _amount *  everBalance / stEverSupply;
    }

    // init
    function initVault(address _stTokenRoot) override external onlyOwner {
        stTokenRoot = _stTokenRoot;
        ITokenRoot(stTokenRoot).deployWallet{
			value: ST_EVER_WALLET_DEPLOY_VALUE,
			callback: Vault.receiveTokenWalletAddress
		}(address(this), ST_EVER_WALLET_DEPLOY_GRAMS_VALUE);
    }

    function receiveTokenWalletAddress(address wallet) external virtual {
		tvm.accept();
		stEverWallet = wallet;
	}


    // userdata utils
    function _buildInitWithdrawUserData(address _user)
		internal
		view
		virtual
		returns (TvmCell)
	{
		return
			tvm.buildStateInit({
				contr: WithdrawUserData,
				varInit: {
					vault: address(this),
					user: _user,
					withdrawUserDataCode: withdrawUserDataCode
				},
				pubkey: 0,
				code: withdrawUserDataCode
			});
	}

    function deployWithdrawUserData(address user_data_owner)
		internal
		virtual
		returns (address)
	{
		return
			new WithdrawUserData{
				stateInit: _buildInitWithdrawUserData(user_data_owner),
				value: USER_DATA_DEPLOY_VALUE
			}();
	}

    function getWithdrawUserDataAddress(address user)
		public
		view
		virtual
		responsible
		returns (address)
	{
		return
			{value: 0, flag: MsgFlag.REMAINING_GAS, bounce: false} address(
				tvm.hash(_buildInitWithdrawUserData(user))
			);
	}

    function getDetails() override external responsible view returns(Details) {
        return {value:0, bounce: false, flag: MsgFlag.REMAINING_GAS} Details(
                stTokenRoot,
                stEverWallet,
                stEverSupply,
                everBalance,
                owner
        );
    }


    // strategy
    function addStrategy(address _strategy) override external onlyGovernance {
        strategies[_strategy] = StrategyParams(
            now,
            0,
            0
        );
        emit StrategyAdded(_strategy);
    }

    function dpositToStrategyes(DepositConfig[] depositConfig) override external onlyGovernance {
        for (uint256 i = 0; i < depositConfig.length; i++) {
            DepositConfig depositConfig = depositConfig[i];
            require(strategies.exists(depositConfig.strategy),STRATEGY_NOT_EXISTS);
            strategies[depositConfig.strategy].totalAssets += depositConfig.amount;
        }
    }

    function strategyReport(uint128 gain, uint128 loss, uint128 totalAssets) override external {

    }


    // deposit
    function deposit(uint128 _amount,uint64 _nonce) override external {

        require(msg.value >= _amount+DEPOSIT_FEE,NOT_ENOUGH_VALUE);
        tvm.rawReserve(address(this).balance - (msg.value - _amount),0);
        uint128 amountToSend = getDepositStEverAmount(_amount);
        everBalance += _amount;
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
        requestWithdraw(_sender,_amount,_payload);
    }

    function requestWithdraw(address _user,uint128 _amount,TvmCell _payload) internal {
        tvm.rawReserve(_reserve(), 0);
        address userDataAddr = getWithdrawUserDataAddress(_user);
        (address deposit_owner, uint64 _nonce, bool correct) = decodeDepositPayload(_payload);
        pendingWithdrawMap[_nonce] = PendingWithdraw(_amount,_user);
        addPendingValueToUserData(_nonce,_amount,userDataAddr);
    }

    function handleAddPendingValueError(TvmSlice slice) internal {
        tvm.rawReserve(_reserve(), 0);
        uint64 _withdraw_nonce = slice.decode(uint64);
        PendingWithdraw pendingWithdraw = pendingWithdrawMap[_withdraw_nonce];
        deployWithdrawUserData(pendingWithdraw.user);
        address withdrawUserData = getWithdrawUserDataAddress(pendingWithdraw.user);
        addPendingValueToUserData(_withdraw_nonce,pendingWithdraw.amount,withdrawUserData);
    }

    function addPendingValueToUserData(uint64 _withdraw_nonce,uint128 amount,address withdrawUserData) internal {
        IWithdrawUserData(withdrawUserData).addPendingValue{
            value:0,
            flag: MsgFlag.ALL_NOT_RESERVED
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
        tvm.rawReserve(_reserve(), 0);
        for (uint128 i = 0; i < sendConfig.length; i++) {
            SendToUserConfig config = sendConfig[i];
            address withdrawUserData = getWithdrawUserDataAddress(config.user);
            IWithdrawUserData(withdrawUserData).processWithdraw{value:EXPEREMENTAL_FEE}(config.nonces);
        }
        // TODO
        msg.sender.transfer({value:0,flag:MsgFlag.ALL_NOT_RESERVED});
    }

    function withdrawToUser(
        uint128 amount,
        address user,
        DumpWithdraw[] withdrawDump
    ) override external onlyWithdrawUserData {
        tvm.rawReserve(_reserve(), 0);
        // if not enough balance, reset pending to the UserData;
        uint128 everAmount = getWithdrawEverAmount(amount);
        if(everAmount < amount) {
            for (uint256 i = 0; i < withdrawDump.length; i++) {
                DumpWithdraw dump = withdrawDump[i];
                // TODO add value
                IWithdrawUserData(msg.sender).addPendingValue(dump.nonce,dump.amount);
            }
            return;
        }
       require(stEverSupply >= amount,NOT_ENOUGH_ST_EVER);
       everBalance -= everAmount;
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
        governance.transfer({value:0,flag:MsgFlag.ALL_NOT_RESERVED});
    }


    function onRunBalancer(BalancingConfig[] balancerConfig) override external onlyGovernance {
        for (uint256 i = 0; i < balancerConfig.length; i++) {
          
            BalancingConfig config = balancerConfig[i];
            require(!(config.deposit >= 0 && config.withdraw >=0),ONLY_ONE_VALUE_MOVE_PER_STEP);
            IStrategy strategy = IStrategy(config.strategy);

            if (config.deposit >= 0) {
                strategy.deposit(uint64(config.deposit));
            }

            if (config.withdraw >= 0) {
                 strategy.withdraw(uint64(config.withdraw));
            }
        }
    }



    function processWithdrawFromStrategies(WithdrawConfig[] withdrawConfig) override external onlyGovernance {
        for (uint128 i = 0; i < withdrawConfig.length; i++) {
            WithdrawConfig config  = withdrawConfig[i];
            IStrategy(config.strategy).withdraw(uint64(config.amount));
        }
    }

    onBounce(TvmSlice slice) external {
		tvm.accept();
		uint32 functionId = slice.decode(uint32);
		if (functionId == tvm.functionId(WithdrawUserData.addPendingValue)) {
			handleAddPendingValueError(slice);
		}
	}

}