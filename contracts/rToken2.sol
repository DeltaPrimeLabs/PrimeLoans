// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 2f8ed44459fc99825919d399c3e4350b61551b67;
pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract RTKNDP2 is Initializable, ERC20Upgradeable, OwnableUpgradeable {
    function initialize() public initializer {
        __ERC20_init("ReimbursementTokenDeltaPrime2", "rTKNDP2");
        __Ownable_init();
    }

    function mintBatch(address[] memory recipients, uint256[] memory amounts) public onlyOwner {
        require(recipients.length == amounts.length, "Arrays must have the same length");
        for (uint256 i = 0; i < recipients.length; i++) {
            _mint(recipients[i], amounts[i]);
        }
    }

    constructor(){
        _disableInitializers();
    }
}