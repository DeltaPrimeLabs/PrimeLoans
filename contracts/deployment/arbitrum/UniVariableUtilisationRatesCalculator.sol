// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 58c223f4c83794b2ac9477fb697e0632d59efff8;
pragma solidity 0.8.17;

import "./WethVariableUtilisationRatesCalculator.sol";
/**
 * @title EthVariableUtilisationRatesCalculator
 * @dev Contract which calculates the interest rates based on pool utilisation.
 * Utilisation is computed as the ratio between funds borrowed and funds deposited to the pool.
 * Borrowing rates are calculated using a piecewise linear function. The first piece is defined by SLOPE_1
 * and OFFSET (shift). Second piece is defined by SLOPE_2 (calculated off-chain), BREAKPOINT (threshold value above
 * which second piece is considered) and MAX_RATE (value at pool utilisation of 1).
 **/
contract UniVariableUtilisationRatesCalculator is WethVariableUtilisationRatesCalculator {
}