// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

interface IYYWombatPool {
    function deposit(uint256 amount) external;

    function withdraw(uint256 amount) external;

    function getDepositTokensForShares(
        uint256 shares
    ) external view returns (uint256);
}
