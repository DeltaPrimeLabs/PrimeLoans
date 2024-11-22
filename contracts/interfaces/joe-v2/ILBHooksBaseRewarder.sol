// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title LB Hooks Base Rewarder Interface
 * @dev Interface for the LB Hooks Base Rewarder
 */
interface ILBHooksBaseRewarder {
    error LBHooksBaseRewarder__InvalidDeltaBins();
    error LBHooksBaseRewarder__Overflow();
    error LBHooksBaseRewarder__NativeTransferFailed();
    error LBHooksBaseRewarder__UnlinkedHooks();
    error LBHooksBaseRewarder__InvalidHooksParameters();
    error LBHooksBaseRewarder__ZeroBalance();
    error LBHooksBaseRewarder__LockedRewardToken();
    error LBHooksBaseRewarder__NotNativeRewarder();
    error LBHooksBaseRewarder__NotImplemented();
    error LBHooksBaseRewarder__UnauthorizedCaller();
    error LBHooksBaseRewarder__ExceedsMaxNumberOfBins();

    event DeltaBinsSet(int24 deltaBinA, int24 deltaBinB);
    event Claim(address indexed user, uint256 amount);

    struct Bin {
        uint256 accRewardsPerShareX64;
        mapping(address => uint256) userAccRewardsPerShareX64;
    }

    function getRewardToken() external view returns (IERC20);

    function getLBHooksManager() external view returns (address);

    function isStopped() external view returns (bool);

    function getRewardedRange() external view returns (uint256 binStart, uint256 binEnd);

    function getPendingRewards(address user, uint256[] calldata ids) external view returns (uint256 pendingRewards);

    function claim(address user, uint256[] calldata ids) external;

    function setDeltaBins(int24 deltaBinA, int24 deltaBinB) external;

    function sweep(IERC20 token, address to) external;
}