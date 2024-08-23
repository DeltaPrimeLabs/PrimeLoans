// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.17;

import "./ISPrime.sol";

interface ISPrimeUniswap is ISPrime {
  /**
   * @dev Struct representing the information for the nft position.
   * @param tokenId NFT Position Token Id.
   * @param lpAmount LP token amount for the specific token id.
   * @param share sPrime token share amount for the nft position
   */
  struct LiquidityInfo {
    uint256 tokenId;
    uint128 lpAmount;
    uint256 share;
  }

  /**
   * @dev Users can use deposit function for depositing tokens to the specific bin.
   * @param tickDesired The tick that user wants to add liquidity from
   * @param tickSlippage The tick slippage that are allowed to slip
   * @param amountX The amount of token X to deposit.
   * @param amountY The amount of token Y to deposit.
   * @param desiredAmountX The desired amount of token X to deposit.
   * @param desiredAmountY The desired amount of token Y to deposit.
   * @param isRebalance Rebalance the existing position with deposit.
   * @param swapSlippage Slippage for the rebalance.
   */
  function deposit(
    int24 tickDesired,
    int24 tickSlippage,
    uint256 amountX,
    uint256 amountY,
    uint256 desiredAmountX,
    uint256 desiredAmountY,
    bool isRebalance,
    uint256 swapSlippage
  ) external;

    /**
     * @dev Users can use withdraw function for withdrawing their share.
     * @param shareWithdraw The amount of share to withdraw.
     * @param amountXMin The minimum amount of token X to receive.
     * @param amountYMin The minimum amount of token Y to receive.
     */
    function withdraw(
        uint256 shareWithdraw,
        uint256 amountXMin,
        uint256 amountYMin
    ) external;
}
