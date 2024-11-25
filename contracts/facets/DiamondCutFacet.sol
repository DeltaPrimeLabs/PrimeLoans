// SPDX-License-Identifier: MIT
// Last deployed from commit: ;
pragma solidity 0.8.17;

/******************************************************************************\
* Author: Nick Mudge <nick@perfectabstractions.com> (https://twitter.com/mudgen)
* EIP-2535 Diamonds: https://eips.ethereum.org/EIPS/eip-2535
/******************************************************************************/

import {IDiamondCut} from "../interfaces/IDiamondCut.sol";
import {DiamondStorageLib} from "../lib/DiamondStorageLib.sol";

// Remember to add the loupe functions from DiamondLoupeFacet to the diamond.
// The loupe functions are required by the EIP2535 Diamonds standard

contract DiamondCutFacet is IDiamondCut {
    /// @notice Add/replace/remove any number of functions and optionally execute
    ///         a function with delegatecall
    /// @param _diamondCut Contains the facet addresses and function selectors
    /// @param _init The address of the contract or facet to execute _calldata
    /// @param _calldata A function call, including function selector and arguments
    ///                  _calldata is executed with delegatecall on _init
    function diamondCut(
        FacetCut[] calldata _diamondCut,
        address _init,
        bytes calldata _calldata
    ) external override paused {
        require(address(this) == 0x62Cf82FB0484aF382714cD09296260edc1DC0c6c, "This can be called only on the DiamondBeacon contract"); // DiamondBeacon address on Arbitrum TODO: Replace with relevant address prior to deploying
        DiamondStorageLib.enforceIsContractOwner();
        DiamondStorageLib.diamondCut(_diamondCut, _init, _calldata);
    }

    function unpause() external override {
        DiamondStorageLib.enforceIsPauseAdmin();

        DiamondStorageLib.DiamondStorage storage ds = DiamondStorageLib.diamondStorage();
        require(!ds._active, "ProtocolUpgrade: already unpaused.");
        ds._active = true;
    }

    function pause() external override {
        DiamondStorageLib.enforceIsPauseAdmin();

        DiamondStorageLib.DiamondStorage storage ds = DiamondStorageLib.diamondStorage();
        require(ds._active, "ProtocolUpgrade: already paused.");
        ds._active = false;
    }

    modifier paused() {
        DiamondStorageLib.DiamondStorage storage ds;
        bytes32 position = DiamondStorageLib.DIAMOND_STORAGE_POSITION;
        // get diamond storage
        assembly {
            ds.slot := position
        }
        require(!ds._active, "ProtocolUpgrade: not paused.");

        _;
    }
}