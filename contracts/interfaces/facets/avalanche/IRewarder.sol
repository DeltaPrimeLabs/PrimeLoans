// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

interface IRewarder {
    function rewardTokens() external view returns (address[] memory tokens);
}
