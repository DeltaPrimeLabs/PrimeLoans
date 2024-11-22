// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 56e984a39d653fa7262cdbc01a402146643cf309;
pragma solidity ^0.8.17;

import "./DepositRewarderAbstract.sol";

contract DepositRewarderERC20 is DepositRewarderAbstract {
    using SafeERC20 for IERC20;

    /// @notice Reward token
    IERC20 public immutable rewardToken;

    constructor(
        IERC20 rewardToken_,
        address pool_
    ) DepositRewarderAbstract(pool_) {
        if (address(rewardToken_) == address(0)) {
            revert InvalidAddress();
        }

        rewardToken = rewardToken_;
    }

    function getRewardsFor(
        address payable _user
    ) external override nonReentrant updateReward(_user) {
        uint256 reward = rewards[_user];
        if (reward > 0) {
            rewards[_user] = 0;
            rewardToken.safeTransfer(_user, reward);
            emit RewardPaid(_user, reward);
        }
    }

    function notifyRewardAmount(
        uint256 reward
    ) external onlyOwner updateReward(address(0)) {
        if (block.timestamp >= finishAt) {
            rewardRate = reward / duration;
        } else {
            uint256 remainingRewards = (finishAt - block.timestamp) * rewardRate;
            rewardRate = (reward + remainingRewards) / duration;
        }

        require(rewardRate > 0, "reward rate = 0");
        require(
            rewardRate * duration <= rewardToken.balanceOf(address(this)),
            "reward amount > balance"
        );

        finishAt = block.timestamp + duration;
        updatedAt = block.timestamp;

        emit RewardAdded(reward);
    }
}
