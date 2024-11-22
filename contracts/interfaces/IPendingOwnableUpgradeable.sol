// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

interface IPendingOwnableUpgradeable {
    function transferOwnership(address newOwner) external;
    function acceptOwnership() external;
    function pendingOwner() external view returns (address);
}