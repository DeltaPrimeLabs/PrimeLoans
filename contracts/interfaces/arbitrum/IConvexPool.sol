// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.17;

interface IConvexPool {
    function deposit(uint256 _pid, uint256 _amount) external returns(bool);

    struct DepositDetails {
        uint256 crvLpTokenAmount;
        uint256 depositPoolId;
        address depositPoolAddress;
        address crvLpTokenAddress;
        bytes32 crvLpTokenIdentifier;
        address cvxPoolLPTokenAddress;
        bytes32 cvxPoolIdentifier;
    }

    struct WithdrawalDetails {
        uint256 receiptTokenAmount;
        address crvLpTokenAddress;
        bytes32 crvLpTokenIdentifier;
        address cvxPoolLPTokenAddress;
        bytes32 cvxPoolIdentifier;
    }
}