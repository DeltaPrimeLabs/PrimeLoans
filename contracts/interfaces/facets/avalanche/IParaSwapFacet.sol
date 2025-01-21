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
}
