// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit:
pragma solidity 0.8.17;

interface IWithdrawalIntentFacet {
    struct IntentInfo {
        uint256 amount;
        uint256 actionableAt;
        uint256 expiresAt;
        bool isPending;
        bool isActionable;
        bool isExpired;
    }

    function createWithdrawalIntent(bytes32 _asset, uint256 _amount) external;
    function executeWithdrawalIntent(bytes32 _asset, uint256[] calldata intentIndices) external;
    function cancelWithdrawalIntent(bytes32 _asset, uint256 intentIndex) external;
    function clearExpiredIntents(bytes32 _asset) external;
    function getUserIntents(bytes32 _asset) external view returns (IntentInfo[] memory);
    function getTotalIntentAmount(bytes32 _asset) external view returns (uint256);
    function getAvailableBalance(bytes32 _asset) external view returns (uint256);
    function getAvailableBalancePayable(bytes32 _asset) external payable returns (uint256);

    event WithdrawalIntentCreated(bytes32 indexed asset, uint256 amount, uint256 actionableAt, uint256 expiresAt);
    event WithdrawalIntentExecuted(bytes32 indexed asset, uint256 amount, uint256 timestamp);
    event WithdrawalIntentCanceled(bytes32 indexed asset, uint256 amount, uint256 timestamp);
}