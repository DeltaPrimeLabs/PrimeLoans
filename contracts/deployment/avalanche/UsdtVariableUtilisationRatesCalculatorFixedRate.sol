// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 83717555c511b82ae0d517b5f6fd5e09b7728852;
pragma solidity 0.8.17;

import "./UsdtVariableUtilisationRatesCalculator.sol";

contract UsdtVariableUtilisationRatesCalculatorFixedRate is UsdtVariableUtilisationRatesCalculator {
    /**
     **/
    function calculateDepositRate(uint256 _totalLoans, uint256 _totalDeposits) external view override returns (uint256) {
        return 0.1082e18;
    }

    /**
     * Always return fixed deposit rate
     **/
    function calculateBorrowingRate(uint256 totalLoans, uint256 totalDeposits) external pure override returns (uint256) {
        return 0.1413e18;
    }
}