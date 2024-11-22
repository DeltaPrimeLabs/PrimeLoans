// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 67471c167ea4dcee4590ca5d8289a47373be90e3;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract LinkPoolTUP is TransparentUpgradeableProxy {
    constructor(address _logic, address admin_, bytes memory _data) TransparentUpgradeableProxy(_logic, admin_, _data) {}
}
