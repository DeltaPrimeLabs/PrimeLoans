// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

interface IMasterChefVTX {
    function earned(address account, address rewardToken) external view returns (uint256);
}