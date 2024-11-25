// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.17;

interface IPoolRewarder {

    function stakeFor(uint _amount, address _stakeFor) external;

    function withdrawFor(uint _amount, address _unstakeFor) external returns (uint);

    function getRewardsFor(address _user) external;

    function earned(address _account) external view returns (uint);

    function balanceOf(address _account) external view returns (uint);
}
