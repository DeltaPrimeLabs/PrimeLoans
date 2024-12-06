// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 0271bcacaafa55801a2be34f6d5400a581c0d3b2;
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