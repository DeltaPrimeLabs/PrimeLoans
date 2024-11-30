// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: bb3a8393aac4369556cb4994ae10ca862ed2a135;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract ArbPoolTUP is TransparentUpgradeableProxy {
    constructor(address _logic, address admin_, bytes memory _data) TransparentUpgradeableProxy(_logic, admin_, _data) {}
}
