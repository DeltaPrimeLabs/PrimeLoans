// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "../vPrime.sol";


contract vPrimeMock is vPrime {
    /* ========== MODIFIERS ========== */
    modifier onlyVPrimeController() override {
        _;
    }
}
