// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: c5c938a0524b45376dd482cd5c8fb83fa94c2fcc;
pragma solidity 0.8.17;

import "../UniswapV2Intermediary.sol";
import "../../lib/local/DeploymentConstants.sol";

/**
 * @title UbeswapIntermediary
 * @dev Contract allows user to swap ERC20 tokens on DEX
 * This implementation uses the Ubeswap DEX
 */
contract UbeswapIntermediary is UniswapV2Intermediary {

  /**
   * Returns a path containing tokens' addresses
   * @dev _token ERC20 token's address
   **/
  function getPath(address _token1, address _token2) internal override pure returns (address[] memory) {
    address[] memory path;
    path = new address[](2);
    path[0] = _token1;
    path[1] = _token2;

    return path;
  }

  function getNativeTokenAddress() override internal pure returns (address) {
    return DeploymentConstants.getNativeToken();
  }
}