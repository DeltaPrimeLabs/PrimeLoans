// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

interface IWombatRouter {
    function addLiquidityNative(
        address pool,
        uint256 minimumLiquidity,
        address to,
        uint256 deadline,
        bool shouldStake
    ) external payable returns (uint256 liquidity);

    function removeLiquidityNative(
        address pool,
        uint256 liquidity,
        uint256 minimumAmount,
        address to,
        uint256 deadline
    ) external returns (uint256 amount);

    function removeLiquidityFromOtherAssetAsNative(
        address pool,
        address fromToken,
        uint256 liquidity,
        uint256 minimumAmount,
        address to,
        uint256 deadline
    ) external returns (uint256 amount);
}
