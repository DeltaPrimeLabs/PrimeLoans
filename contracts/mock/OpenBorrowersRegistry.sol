// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "../interfaces/IBorrowersRegistry.sol";

/**
 * @title OpenBorrowersRegistry
 * It the simpled borrowers registry that allows every account
 * Should be used for test purpose only
 */
contract OpenBorrowersRegistry is IBorrowersRegistry {
    function canBorrow(address _account) external pure override returns (bool) {
        return true;
    }

    function getLoanForOwner(address _user) external pure override returns (address) {
        return address(0);
    }

    function getOwnerOfLoan(address _loan) external pure override returns (address) {
        return address(0);
    }
}
