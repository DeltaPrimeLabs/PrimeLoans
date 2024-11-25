pragma solidity ^0.8.17;

import "./IRewarder.sol";

interface IMiniChef {
    struct UserInfo {
        uint256 amount;
        int256 rewardDebt;
    }

    function deposit(uint256 pid, uint256 amount, address to) external;

    function withdraw(uint256 pid, uint256 amount, address to) external;

    function harvest(uint256 pid, address to) external;

    function withdrawAndHarvest(uint256 pid, uint256 amount, address to) external;

    function pendingSushi(uint256 pid, address user) external view returns (uint256);

    function userInfo(uint256 pid, address user) external view returns (UserInfo memory);

    function rewarder(uint256 pid) external view returns (IRewarder);
}
