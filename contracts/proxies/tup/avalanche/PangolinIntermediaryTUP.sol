// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 8c36e18a206b9e6649c00da51c54b92171ce3413;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract PangolinIntermediaryTUP is TransparentUpgradeableProxy {
    constructor(address _logic, address admin_, bytes memory _data) TransparentUpgradeableProxy(_logic, admin_, _data) {}
}
