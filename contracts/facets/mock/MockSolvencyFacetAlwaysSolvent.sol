// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.17;

contract MockSolvencyFacetAlwaysSolvent {
    /**
    * Always returns true - used in test suits
    **/
    function isSolvent() public pure returns (bool) {
        return true;
    }

    function canRepayDebtFully() external view returns (bool) {
        return true;
    }
}
