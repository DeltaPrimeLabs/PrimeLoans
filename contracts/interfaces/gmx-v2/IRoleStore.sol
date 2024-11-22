// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

/**
 * @title IRoleStore
 * @dev Stores roles and their members.
 */
interface IRoleStore {
    /**
     * @dev Returns true if the given account has the specified role.
     *
     * @param account The address of the account.
     * @param roleKey The key of the role.
     * @return True if the account has the role, false otherwise.
     */
    function hasRole(address account, bytes32 roleKey) external view returns (bool);
}