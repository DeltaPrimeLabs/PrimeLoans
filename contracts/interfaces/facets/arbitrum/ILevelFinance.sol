// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "./IRewarder.sol";

interface ILevelFinance {
    struct UserInfo {
        uint256 amount;
        int256 rewardDebt;
    }

    function userInfo(
        uint256 pid,
        address user
    ) external view returns (UserInfo memory);

    function pendingReward(
        uint256 pid,
        address user
    ) external view returns (uint256 pending);

    function rewarder(uint256 pid) external view returns (IRewarder);

    function deposit(
        uint256 pid,
        uint256 amount,
        address to
    ) external;

    function withdraw(
        uint256 pid,
        uint256 amount,
        address to
    ) external;

    function addLiquidity(
        uint256 pid,
        address assetToken,
        uint256 assetAmount,
        uint256 minLpAmount,
        address to
    ) external;

    function addLiquidityETH(
        uint256 pid,
        uint256 minLpAmount,
        address to
    ) external payable;

    function removeLiquidity(
        uint256 pid,
        uint256 lpAmount,
        address toToken,
        uint256 minOut,
        address to
    ) external;

    function removeLiquidityETH(
        uint256 pid,
        uint256 lpAmount,
        uint256 minOut,
        address to
    ) external;

    function harvest(uint256 pid, address to) external;
}
