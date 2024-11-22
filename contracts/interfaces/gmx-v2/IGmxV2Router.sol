// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IGmxV2Router {
    function sendWnt(address receiver, uint256 amount) external payable;

    function sendTokens(address token, address receiver, uint256 amount) external payable;
}