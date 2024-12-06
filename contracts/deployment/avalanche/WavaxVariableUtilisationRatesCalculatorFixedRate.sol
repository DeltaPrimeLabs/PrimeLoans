// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 5cf28801765938c1a9376cbe00c1aad6cb21c3fd;
pragma solidity 0.8.17;

import "./WavaxVariableUtilisationRatesCalculator.sol";

contract WavaxVariableUtilisationRatesCalculatorFixedRate is WavaxVariableUtilisationRatesCalculator {
    /**
     * Always return fixed deposit rate
     **/
    function calculateBorrowingRate(uint256 totalLoans, uint256 totalDeposits) external pure override returns (uint256) {
        return 0.0438e18;
    }
}