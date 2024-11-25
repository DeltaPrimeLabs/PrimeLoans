// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ac51526ea73cc486f4527cf20f228688d343110b;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract DaiPoolTUP is TransparentUpgradeableProxy {
    constructor(address _logic, address admin_, bytes memory _data) TransparentUpgradeableProxy(_logic, admin_, _data) {}
}
