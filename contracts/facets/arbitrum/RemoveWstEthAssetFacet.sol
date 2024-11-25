// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 2ff7031532d38b344def3a4b8a953f80f29d0b00;
pragma solidity 0.8.17;

import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";

contract RemoveWstEthAssetFacet  {
    function RemoveWstEthAsset() external {
        require(msg.sender == 0x5D80a1c0a5084163F1D2620c1B1F43209cd4dB12, "Wrong msg.sender");
        DiamondStorageLib.removeOwnedAsset("wstETH");
    }
}
