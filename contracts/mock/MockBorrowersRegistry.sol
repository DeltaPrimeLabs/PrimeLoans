// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "../interfaces/IBorrowersRegistry.sol";

/**
 * @title MockBorrowersRegistry
 * Should be used for test purpose only
 */
contract MockBorrowersRegistry is IBorrowersRegistry {

    mapping(address => address) public ownersToLoans;
    mapping(address => address) public loansToOwners;

    address[] loans;

    function updateRegistry(address loan, address owner) public  {
        ownersToLoans[owner] = loan;
        loansToOwners[loan] = owner;
        loans.push(loan);
    }

    function canBorrow(address _account) external view override returns (bool) {
        return loansToOwners[_account] != address(0);
    }

    function getLoanForOwner(address _user) external view override returns (address) {
        return ownersToLoans[_user];
    }

    function getOwnerOfLoan(address _loan) external view override returns (address) {
        return loansToOwners[_loan];
    }
}
