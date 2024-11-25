// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 84497b01716b53fb360c04d763183339d5599174;
pragma solidity 0.8.17;

import "../../Pool.sol";


/**
 * @title `ArbPool`
 * @dev Contract allowing user to deposit to and borrow ARB from a dedicated user account
 */
contract ArbPool is Pool {
    function getMaxPoolUtilisationForBorrowing() override public view returns (uint256) {
        return 0.925e18;
    }

    function name() public virtual override pure returns(string memory _name){
        _name = "DeltaPrimeArbibtrum";
    }

    function symbol() public virtual override pure returns(string memory _symbol){
        _symbol = "DPARB";
    }

    function decimals() public virtual override pure returns(uint8 decimals){
        decimals = 18;
    }
}