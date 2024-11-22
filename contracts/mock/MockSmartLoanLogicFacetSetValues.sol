// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.17;

contract MockSolvencyFacetConstantDebt {
    /**
    * Always returns 2137 - used in test suits
    **/
    function getDebt() public pure returns (uint256) {
        return 2137;
    }
}
