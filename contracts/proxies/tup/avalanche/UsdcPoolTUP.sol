// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 2f6b0fb53889a8741a3d7f78a2d5d05ad7a0c76d;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract UsdcPoolTUP is TransparentUpgradeableProxy {
    constructor(address _logic, address admin_, bytes memory _data) TransparentUpgradeableProxy(_logic, admin_, _data) {}
}
