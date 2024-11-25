// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.17;

import "./ISPrime.sol";
import "./joe-v2/ILBPair.sol";
import "./IPositionManager.sol";

interface ISPrimeTraderJoe is ISPrime {
  struct DepositForm{
    int256 deltaId;
    uint64 distributionX;
    uint64 distributionY;
  }

  /**
    * @dev Users can use deposit function for depositing tokens to the specific bin.
    * @param activeIdDesired The active id that user wants to add liquidity from
    * @param idSlippage The number of id that are allowed to slip
    * @param amountX The amount of token X to deposit.
    * @param amountY The amount of token Y to deposit.
    * @param isRebalance Rebalance the existing position with deposit.
    * @param swapSlippage Slippage for the rebalance.
    */
    function deposit(
        uint256 activeIdDesired,
        uint256 idSlippage,
        uint256 amountX,
        uint256 amountY,
        bool isRebalance,
        uint256 swapSlippage
    ) external;
    
  function getLBPair() external view returns(ILBPair);
  function positionManager() external view returns(IPositionManager);
}
