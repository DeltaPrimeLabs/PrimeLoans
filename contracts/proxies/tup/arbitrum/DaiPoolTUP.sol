// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 8e0f6735b3fe624d9a19c2de21c223fe86edf829;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract DaiPoolTUP is TransparentUpgradeableProxy {
    constructor(address _logic, address admin_, bytes memory _data) TransparentUpgradeableProxy(_logic, admin_, _data) {}
}
