// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: bb3a8393aac4369556cb4994ae10ca862ed2a135;
pragma solidity 0.8.17;

import "./WethVariableUtilisationRatesCalculator.sol";

contract ArbVariableUtilisationRatesCalculatorFixedRate is WethVariableUtilisationRatesCalculator {
    /**
     **/
    function calculateDepositRate(uint256 _totalLoans, uint256 _totalDeposits) external view override returns (uint256) {
        return 0.0251e18;
    }

    /**
     * Always return fixed deposit rate
     **/
    function calculateBorrowingRate(uint256 totalLoans, uint256 totalDeposits) external pure override returns (uint256) {
        return 0.0391e18;
    }
}