// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 475e51570b3e480253ce381ecc27c22cb8ea3496;
pragma solidity 0.8.17;

import "./WavaxVariableUtilisationRatesCalculator.sol";

contract BtcVariableUtilisationRatesCalculatorFixedRate is WavaxVariableUtilisationRatesCalculator {
    /**
     **/
    function calculateDepositRate(uint256 _totalLoans, uint256 _totalDeposits) external view override returns (uint256) {
        return 0.0458e18;
    }

    /**
     * Always return fixed deposit rate
     **/
    function calculateBorrowingRate(uint256 totalLoans, uint256 totalDeposits) external pure override returns (uint256) {
        return 0.0605e18;
    }
}