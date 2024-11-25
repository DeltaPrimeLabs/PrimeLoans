// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 8c36e18a206b9e6649c00da51c54b92171ce3413;
pragma solidity 0.8.17;

import "../UniswapV2Intermediary.sol";
import "../../lib/local/DeploymentConstants.sol";

/**
 * @title PangolinIntermediary
 * @dev Contract allows user to swap ERC20 tokens on DEX
 * This implementation uses the Pangolin DEX
 */
contract PangolinIntermediary is UniswapV2Intermediary {

    function getNativeTokenAddress() override internal pure returns (address) {
        return DeploymentConstants.getNativeToken();
    }
}