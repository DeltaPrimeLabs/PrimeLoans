// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 9f71f4e4d5f91ea710c0adcd1c04f049891798be;
pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract RTKNDP2 is Initializable, ERC20Upgradeable, OwnableUpgradeable {
    function initialize() public initializer {
        __ERC20_init("ReimbursementTokenDeltaPrime2", "rTKNDP2");
        __Ownable_init();
    }

    constructor(){
        _disableInitializers();
    }
}