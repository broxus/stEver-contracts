pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "./interfaces/IDepoolStrategyFactory.sol";
import "@broxus/contracts/contracts/libraries/MsgFlag.sol";
import "./StrategyDePool.sol";
import "./interfaces/IStrategy.sol";
import "./utils/Constants.sol";
import "./utils/ErrorCodes.sol";
import "./utils/Gas.sol";





contract DepoolStrategyFactory is IDepoolStrategyFactory {
    // static
    uint128 public static nonce;
    TvmCell public static dePoolStrategyCode;
    address public static stEverVault;

    // state
    address owner;
    uint32 public strategyVersion;
    uint32 public strategyCount;
    uint32 public factoryVersion;

    // constant
    uint128 constant CONTRACT_MIN_BALANCE = 1 ever;
    uint128 constant UPGRADE_VALUE = 1 ever;
    uint128 constant STRATEGY_DEPLOY_VALUE = 20 ever;
    uint128 constant MIN_CALL_VALUE = 1 ever;

    // errors
    uint16 constant NOT_OWNER = 5001;
    uint16 constant LOW_MSG_VALUE = 5002;
    uint16 constant WRONG_PUBKEY = 5003;


    constructor(address _owner) public {
        require (tvm.pubkey() != 0, WRONG_PUBKEY);
        require (tvm.pubkey() == msg.pubkey(), WRONG_PUBKEY);

        tvm.accept();

        owner = _owner;
    }

    modifier onlyOwner() {
        require(msg.sender == owner,NOT_OWNER);
        _;
    }

    modifier minCallValue() {
        require (msg.value >= DePoolStrategyFactoryGas.MIN_CALL_MSG_VALUE, ErrorCodes.NOT_ENOUGH_VALUE_FACTORY);
        _;
    }
        // utils
    function _reserve() internal pure returns (uint128) {
		return
			math.max(address(this).balance - msg.value, CONTRACT_MIN_BALANCE);
	}

    function getDetails() override external responsible view returns (FactoryDetails) {
        return {value:0, bounce: false, flag: MsgFlag.REMAINING_GAS} FactoryDetails({
            stEverVault: stEverVault,
            owner: owner,
            strategyVersion: strategyVersion,
            strategyCount: strategyCount,
            factoryVersion: factoryVersion
        });
    }

    function transferOwnership(address _newOwner, address _sendGasTo) override external onlyOwner {
        tvm.rawReserve(_reserve(), 0);

        owner = _newOwner;

        _sendGasTo.transfer({value: 0, flag:MsgFlag.ALL_NOT_RESERVED, bounce: false});
    }

    function installNewStrategyCode(TvmCell _strategyCode, address _sendGasTo) override external onlyOwner {
        require (msg.value >= UPGRADE_VALUE, LOW_MSG_VALUE);
        tvm.rawReserve(_reserve(),0);

        dePoolStrategyCode = _strategyCode;
        strategyVersion++;
        emit StrategyCodeUpdated(strategyVersion - 1,strategyVersion);

        _sendGasTo.transfer({value: 0, bounce: false, flag: MsgFlag.ALL_NOT_RESERVED});
    }

    function deployStrategy(address _dePool) override external {
        require (msg.value >= STRATEGY_DEPLOY_VALUE + MIN_CALL_VALUE, LOW_MSG_VALUE);
        tvm.rawReserve(_reserve(), 0);

        TvmCell stateInit = tvm.buildStateInit({
            contr: StrategyDePool,
            varInit: {
                nonce: strategyCount,
                factory: address(this),
                strategyVersion: strategyVersion
            },
            pubkey: tvm.pubkey(),
            code: dePoolStrategyCode
        });
        strategyCount++;
        address strategy = new StrategyDePool{
            stateInit: stateInit,
            value: STRATEGY_DEPLOY_VALUE,
            wid: address(this).wid
        }(stEverVault, _dePool);

        emit NewStrategyDeployed(strategy, strategyVersion);

        msg.sender.transfer({value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false});
    }

    function upgradeStrategies(address[] _strategies) override external onlyOwner {
        require (_strategies.length <= Constants.MAX_STRATEGY_PER_UPGRADE, ErrorCodes.MAX_STRATEGY_THAN_ALLOWED);
        require (
            msg.value >= DePoolStrategyFactoryGas.MIN_CALL_MSG_VALUE * _strategies.length + DePoolStrategyFactoryGas.MIN_CALL_MSG_VALUE,
            ErrorCodes.NOT_ENOUGH_VALUE_FACTORY
        );

        tvm.rawReserve(_reserve(),0);

        for (address strategy : _strategies) {
            IStrategy(strategy).upgrade{value: DePoolStrategyFactoryGas.MIN_CALL_MSG_VALUE, bounce: false}(dePoolStrategyCode, strategyVersion, msg.sender);
        }

        msg.sender.transfer({value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce: false});
    }


    function upgrade(TvmCell _newCode, uint32 _newVersion, address _sendGasTo) override external onlyOwner {
        if (_newVersion == factoryVersion) {
            tvm.rawReserve(_reserve(), 0);
            _sendGasTo.transfer({value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce:false});
            return;
        }

        // should be unpacked in the same order!
        TvmCell data = abi.encode(
            _sendGasTo, // address
            _newVersion, // uint32
            dePoolStrategyCode, // TvmCell
            stEverVault, // address
            owner, // address
            strategyVersion, // uint32
            strategyCount, // uint32
            factoryVersion // uint32
        );

        // set code after complete this method
        tvm.setcode(_newCode);
        // run onCodeUpgrade from new code
        tvm.setCurrentCode(_newCode);

        onCodeUpgrade(data);
    }

    function onCodeUpgrade(TvmCell _upgradeData) private {}

}
