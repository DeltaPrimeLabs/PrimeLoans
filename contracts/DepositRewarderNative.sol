// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.17;

import "./DepositRewarderAbstract.sol";

contract DepositRewarderNative is DepositRewarderAbstract {
    constructor(address pool_) DepositRewarderAbstract(pool_) {}

    function getRewardsFor(
        address payable _user
    ) external override nonReentrant updateReward(_user) {
        uint256 reward = rewards[_user];
        if (reward > 0) {
            rewards[_user] = 0;
            (bool success, bytes memory result) = _user.call{value: reward, gas: 5000}("");
            require(success, "Failed to send native token");
        }
    }

    function notifyRewardAmount()
        external
        payable
        onlyOwner
        updateReward(address(0))
    {
        if (block.timestamp >= finishAt) {
            rewardRate = msg.value / duration;
        } else {
            uint256 remainingRewards = (finishAt - block.timestamp) * rewardRate;
            rewardRate = (msg.value + remainingRewards) / duration;
        }

        require(rewardRate > 0, "reward rate = 0");
        require(
            rewardRate * duration <= address(this).balance,
            "reward amount > balance"
        );

        finishAt = block.timestamp + duration;
        updatedAt = block.timestamp;

        emit RewardAdded(msg.value);
    }
}
