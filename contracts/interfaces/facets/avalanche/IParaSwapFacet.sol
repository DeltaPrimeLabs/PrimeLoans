// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.17;

interface IParaSwapFacet {
    function paraSwapV6(
        bytes4 selector,
        bytes memory data
    ) external;

    function paraSwapBeforeLiquidation(
        bytes4 selector,
        bytes memory data
    ) external;

    // Events
    event SwapExecuted(
        address indexed user,
        bytes32 indexed soldAsset,
        bytes32 indexed boughtAsset,
        uint256 amountSold,
        uint256 amountBought,
        uint256 timestamp
    );
    event SlippageExceeded(
        address indexed user,
        uint256 soldTokenValue,
        uint256 boughtTokenValue,
        uint256 slippage
    );
}
