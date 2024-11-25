// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 48601850463d2b56407c5b1e6a596b5a87c4e428;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract SushiSwapIntermediaryTUP is TransparentUpgradeableProxy {
    constructor(address _logic, address admin_, bytes memory _data) TransparentUpgradeableProxy(_logic, admin_, _data) {}
}
