// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: bb3a8393aac4369556cb4994ae10ca862ed2a135;
pragma solidity 0.8.17;

import "./WethVariableUtilisationRatesCalculator.sol";

contract BtcVariableUtilisationRatesCalculatorFixedRate is WethVariableUtilisationRatesCalculator {
    /**
     * Always return fixed deposit rate
     **/
    function calculateBorrowingRate(uint256 totalLoans, uint256 totalDeposits) external pure override returns (uint256) {
        return 0.0782e18;
    }
}