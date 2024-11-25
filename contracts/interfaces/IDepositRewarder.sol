// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.17;

interface IDepositRewarder {

    function getRewardsFor(address payable _user) external;

    function earned(address _account) external view returns (uint);

    function balanceOf(address _account) external view returns (uint);
}
