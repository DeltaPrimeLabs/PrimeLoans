// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 8dfae91fb3e7a7c6c31e4b486f504b0b68e1502d;
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