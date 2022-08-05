pragma ton-solidity >=0.61.0;
pragma AbiHeader expire;

import "./interfaces/IDepoolStrategyFactory.sol";
import "@broxus/contracts/contracts/libraries/MsgFlag.sol";
import "./StrategyBase.sol";


contract DepoolStrategyFactory is IDepoolStrategyFactory {
    address owner;

    // static
    uint128 public static nonce;
    TvmCell public static dePoolStrategyCode;
    // constant
    uint128 constant CONTRACT_MIN_BALANCE = 1 ever;
    uint128 constant UPGRADE_VALUE = 1 ever;
    uint128 constant STRATEGY_DEPLOY_VALUE = 2 ever;


    uint32 public strategyVesrsion;
    uint32 public strategyCount;
    // errors
    uint8 constant NOT_OWNER = 101;
    uint8 constant LOW_MSG_VALUE = 102;


    constructor(address _owner) public {
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

    function installNewStrategyCode(TvmCell _strategyCode,address sendGasTo) override external onlyOwner {
        require (msg.value >= UPGRADE_VALUE, LOW_MSG_VALUE);
        tvm.rawReserve(_reserve(),0);
        dePoolStrategyCode = _strategyCode;
        strategyVesrsion++;
        emit StrategyCodeUpdated(strategyVesrsion - 1,strategyVesrsion);
        sendGasTo.transfer({value:0,bounce:false,flag:MsgFlag.ALL_NOT_RESERVED});
    }

    function deployStrategy(address strategyOwner,address dePool, address vault) override external  {
        require (msg.value >= STRATEGY_DEPLOY_VALUE, LOW_MSG_VALUE);
        tvm.rawReserve(_reserve(), 0);
        TvmCell stateInit = tvm.buildStateInit({
            contr:StrategyBase,
            varInit:{
                nonce:strategyCount,
                fabric:address(this),
                strategyVesrsion:strategyVesrsion
            },
            pubkey: tvm.pubkey(),
            code:dePoolStrategyCode
        });
        strategyCount++;
        address strategy = new StrategyBase{
            stateInit: stateInit,
            value: 0,
            wid: address(this).wid,
            flag:MsgFlag.ALL_NOT_RESERVED
        }(vault,dePool);
        emit NewStrategyDeployed(strategy, strategyVesrsion);
    }

}