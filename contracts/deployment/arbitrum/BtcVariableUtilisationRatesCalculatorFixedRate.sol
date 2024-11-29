// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 475e51570b3e480253ce381ecc27c22cb8ea3496;
pragma solidity 0.8.17;

import "./WethVariableUtilisationRatesCalculator.sol";

contract BtcVariableUtilisationRatesCalculatorFixedRate is WethVariableUtilisationRatesCalculator {
    /**
     **/
    function calculateDepositRate(uint256 _totalLoans, uint256 _totalDeposits) external view override returns (uint256) {
        return 0.0638e18;
    }

    /**
     * Always return fixed deposit rate
     **/
    function calculateBorrowingRate(uint256 totalLoans, uint256 totalDeposits) external pure override returns (uint256) {
        return 0.0782e18;
    }
}