pragma ever-solidity >=0.62.0;
pragma AbiHeader expire;

import "@broxus/contracts/contracts/platform/Platform.sol";

contract RPlatform is Platform {
    constructor(TvmCell code, TvmCell params, address sendGasTo) public Platform(code, params, sendGasTo) {}
}
