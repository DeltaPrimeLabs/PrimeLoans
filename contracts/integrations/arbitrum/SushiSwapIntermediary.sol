// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 48601850463d2b56407c5b1e6a596b5a87c4e428;
pragma solidity 0.8.17;

import "../UniswapV2Intermediary.sol";
import "../../lib/local/DeploymentConstants.sol";

/**
 * @title SushiSwapIntermediary
 * @dev Contract allows user to swap ERC20 tokens on DEX
 * This implementation uses the SushiSwap DEX
 */
contract SushiSwapIntermediary is UniswapV2Intermediary {
    function getNativeTokenAddress() override internal pure returns (address) {
        return DeploymentConstants.getNativeToken();
    }
}
