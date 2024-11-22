// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.17;

interface IConvexRewarder {
    function withdraw(uint256 _amount, bool _claim) external returns(bool);
    function balanceOf(address account) external view returns (uint256);
}
