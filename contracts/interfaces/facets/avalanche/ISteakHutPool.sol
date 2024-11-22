// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

interface ISteakHutPool {
    function deposit(
        uint256 amountX,
        uint256 amountY,
        uint256 amountXMin,
        uint256 amountYMin
    )
        external
        returns (uint256 shares, uint256 amountXActual, uint256 amountYActual);

    function withdraw(
        uint256 _shares
    ) external returns (uint256 amountX, uint256 amountY);

    // ---INTERFACE-----
    struct StakingDetails {
        bytes32 token0Symbol;
        bytes32 token1Symbol;
        bytes32 vaultTokenSymbol;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
    }

    struct UnstakingDetails {
        bytes32 token0Symbol;
        bytes32 token1Symbol;
        bytes32 vaultTokenSymbol;
        uint256 liquidity;
        uint256 amount0Min;
        uint256 amount1Min;
    }
}
