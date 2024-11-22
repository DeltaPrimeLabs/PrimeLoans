// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IDepositUtils {
    struct CreateDepositParams {
        address receiver;
        address callbackContract;
        address uiFeeReceiver;
        address market;
        address initialLongToken;
        address initialShortToken;
        address[] longTokenSwapPath;
        address[] shortTokenSwapPath;
        uint256 minMarketTokens;
        bool shouldUnwrapNativeToken;
        uint256 executionFee;
        uint256 callbackGasLimit;
    }

    function createDeposit(CreateDepositParams calldata params) external payable returns (bytes32);
}