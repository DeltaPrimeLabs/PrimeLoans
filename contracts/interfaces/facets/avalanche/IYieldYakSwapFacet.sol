// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.17;

interface IYieldYakSwapFacet {
    function yakSwap(uint256 _amountIn, uint256 _amountOut, address[] calldata _path, address[] calldata _adapters) external;
}