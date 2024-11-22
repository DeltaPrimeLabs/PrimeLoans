// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

interface IVectorRewarder {
    function rewardTokens(uint256 index) external view returns (address);

    function earned(address account, address rewardToken) external view returns (uint256);

    function updateFor(address account) external;
}