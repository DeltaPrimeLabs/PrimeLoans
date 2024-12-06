// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 8e0f6735b3fe624d9a19c2de21c223fe86edf829;
pragma solidity 0.8.17;

import "./UsdcVariableUtilisationRatesCalculator.sol";

contract UsdcVariableUtilisationRatesCalculatorFixedRate is UsdcVariableUtilisationRatesCalculator {
    /**
     * Always return fixed deposit rate
     **/
    function calculateBorrowingRate(uint256 totalLoans, uint256 totalDeposits) external pure override returns (uint256) {
        return 0.1817e18;
    }
}