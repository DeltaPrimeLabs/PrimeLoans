// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 83717555c511b82ae0d517b5f6fd5e09b7728852;
pragma solidity 0.8.17;

import "./UsdcVariableUtilisationRatesCalculator.sol";
/**
 * @title EthVariableUtilisationRatesCalculator
 * @dev Contract which calculates the interest rates based on pool utilisation.
 * Utilisation is computed as the ratio between funds borrowed and funds deposited to the pool.
 * Borrowing rates are calculated using a piecewise linear function. The first piece is defined by SLOPE_1
 * and OFFSET (shift). Second piece is defined by SLOPE_2 (calculated off-chain), BREAKPOINT (threshold value above
 * which second piece is considered) and MAX_RATE (value at pool utilisation of 1).
 **/
contract UsdcVariableUtilisationRatesCalculatorFixedRate is UsdcVariableUtilisationRatesCalculator {
    /**
     **/
    function calculateDepositRate(uint256 _totalLoans, uint256 _totalDeposits) external view override returns (uint256) {
        uint256 rate = this.calculateBorrowingRate(_totalLoans, _totalDeposits) * (1e18 - spread) * _totalLoans / (_totalDeposits * 1e18);
        return rate;
    }

    /**
     * Always return fixed deposit rate
     **/
    function calculateBorrowingRate(uint256 totalLoans, uint256 totalDeposits) external pure override returns (uint256) {
        return 0.1424e18;
    }
}