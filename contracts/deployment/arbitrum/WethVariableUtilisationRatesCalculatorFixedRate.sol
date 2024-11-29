// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: b101692b2752cc38ccb73c912751d8d7aefa03cf;
pragma solidity 0.8.17;

import "./WethVariableUtilisationRatesCalculator.sol";

contract WethVariableUtilisationRatesCalculatorFixedRate is WethVariableUtilisationRatesCalculator {
    /**
     **/
    function calculateDepositRate(uint256 _totalLoans, uint256 _totalDeposits) external view override returns (uint256) {
        return 0.0346e18;
    }

    /**
     * Always return fixed deposit rate
     **/
    function calculateBorrowingRate(uint256 totalLoans, uint256 totalDeposits) external pure override returns (uint256) {
        return 0.049e18;
    }
}