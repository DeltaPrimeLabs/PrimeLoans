// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;


interface ILevelOrderManager {
    function placeAddLiquidityOrder(
        address _tranche,
        address _tokenIn,
        uint256 _amountIn,
        uint256 _minAmountOut,
        uint64 _expiresAt,
        address _to
    ) external payable;

    function placeRemoveLiquidityOrder(
        address _tranche,
        address _tokenOut,
        uint256 _amountIn,
        uint256 _minAmountOut,
        uint64 _expiresAt,
        address _to
    ) external payable;
}