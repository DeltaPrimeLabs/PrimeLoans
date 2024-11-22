// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.17;

interface ICaiFacet {
    function mintCai(
        bytes4 selector,
        bytes memory data,
        address fromToken,
        uint256 fromAmount,
        uint256 minOut
    ) external;

    function burnCai(
        bytes4 selector,
        bytes memory data,
        uint256 shares,
        address toToken,
        uint256 minOut
    ) external;
}
