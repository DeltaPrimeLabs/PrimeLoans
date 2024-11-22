// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

interface IVectorFinanceCompounder {
    function balanceOf(address account) external view returns (uint256);

    function transfer(address recipient, uint256 amount) external returns (bool);

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);

    function decimals() external view returns (uint256);

    function withdraw(uint256 amount, uint256 minAmount) external;

    function deposit(uint256 amount) external;

    function stakingToken() external view returns (address);

    function depositTracking(address) external view returns (uint256);

    function migrateAllUserDepositsFromManual() external;

    function migrateAllUserDepositsToManual() external;

    function getDepositTokensForShares(uint256 amount) external view returns (uint256);
}