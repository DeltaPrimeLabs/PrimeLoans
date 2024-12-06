// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 890a81308b0bba10d08665d5a80bef68a2bcb373;
pragma solidity 0.8.17;

import "./WavaxVariableUtilisationRatesCalculator.sol";

contract BtcVariableUtilisationRatesCalculatorFixedRate is WavaxVariableUtilisationRatesCalculator {
    /**
     * Always return fixed deposit rate
     **/
    function calculateBorrowingRate(uint256 totalLoans, uint256 totalDeposits) external pure override returns (uint256) {
        return 0.0605e18;
    }
}