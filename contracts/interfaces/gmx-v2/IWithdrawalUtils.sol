// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IWithdrawalUtils {
    struct CreateWithdrawalParams {
        address receiver;
        address callbackContract;
        address uiFeeReceiver;
        address market;
        address[] longTokenSwapPath;
        address[] shortTokenSwapPath;
        uint256 minLongTokenAmount;
        uint256 minShortTokenAmount;
        bool shouldUnwrapNativeToken;
        uint256 executionFee;
        uint256 callbackGasLimit;
    }

    function createWithdrawal(CreateWithdrawalParams calldata params) external payable returns (bytes32);
}