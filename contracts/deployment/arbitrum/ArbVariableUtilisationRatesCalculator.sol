// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 67471c167ea4dcee4590ca5d8289a47373be90e3;
pragma solidity 0.8.17;

import "./WethVariableUtilisationRatesCalculator.sol";
/**
 * @title ArbVariableUtilisationRatesCalculator
 * @dev Contract which calculates the interest rates based on pool utilisation.
 * Utilisation is computed as the ratio between funds borrowed and funds deposited to the pool.
 * Borrowing rates are calculated using a piecewise linear function. The first piece is defined by SLOPE_1
 * and OFFSET (shift). Second piece is defined by SLOPE_2 (calculated off-chain), BREAKPOINT (threshold value above
 * which second piece is considered) and MAX_RATE (value at pool utilisation of 1).
 **/
contract ArbVariableUtilisationRatesCalculator is WethVariableUtilisationRatesCalculator{
}