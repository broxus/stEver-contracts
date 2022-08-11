pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;
pragma AbiHeader pubkey;

import "./interfaces/IDepoolStrategyFactory.sol";
import "@broxus/contracts/contracts/libraries/MsgFlag.sol";
import "./StrategyDePool.sol";
import "./interfaces/IStrategy.sol";



contract DepoolStrategyFactory is IDepoolStrategyFactory {
    // static
    uint128 public static nonce;
    TvmCell public static dePoolStrategyCode;
    // constant
    uint128 constant CONTRACT_MIN_BALANCE = 1 ever;
    uint128 constant UPGRADE_VALUE = 1 ever;
    uint128 constant STRATEGY_DEPLOY_VALUE = 2 ever;

    address owner;
    uint32 public strategyVersion;
    uint32 public strategyCount;
    uint32 public factoryVersion;
    // errors
    uint8 constant NOT_OWNER = 101;
    uint8 constant LOW_MSG_VALUE = 102;
    uint8 constant WRONG_PUBKEY = 103;


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
        // utils
    function _reserve() internal pure returns (uint128) {
		return
			math.max(address(this).balance - msg.value, CONTRACT_MIN_BALANCE);
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

    function deployStrategy(address _dePool, address _vault) override external onlyOwner {
        require (msg.value >= STRATEGY_DEPLOY_VALUE, LOW_MSG_VALUE);
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
            value: 0,
            wid: address(this).wid,
            flag: MsgFlag.ALL_NOT_RESERVED
        }(_vault, _dePool);
        emit NewStrategyDeployed(strategy, strategyVersion);
    }

    function upgradeStrategy(address _strategy) override external onlyOwner {
        tvm.rawReserve(_reserve(),0);
        IStrategy(_strategy).upgrade(dePoolStrategyCode, strategyVersion, msg.sender);
    }

    function upgrade(TvmCell _newCode, uint32 _newVersion, address _sendGasTo) override external onlyOwner {
        if (_newVersion == factoryVersion) {
            tvm.rawReserve(_reserve(), 0);
            _sendGasTo.transfer({value: 0, flag: MsgFlag.ALL_NOT_RESERVED, bounce:false});
            return;
        }

        // should be unpacked in the same order!
        TvmCell data = abi.encode(
            _newVersion,
            dePoolStrategyCode,
            owner,
            strategyCount
        );
        
        // set code after complete this method
        tvm.setcode(_newCode);
        // run onCodeUpgrade from new code
        tvm.setCurrentCode(_newCode);

        onCodeUpgrade(data);
    }

    function onCodeUpgrade(TvmCell _upgradeData) private {}

}
