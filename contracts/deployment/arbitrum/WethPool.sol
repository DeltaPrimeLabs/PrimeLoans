// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 5f9719b7bf102162ee51a7ebce5dc5e0c4c6ab77;
pragma solidity 0.8.17;

import "../../WrappedNativeTokenPool.sol";


/**
 * @title WethPool
 * @dev Contract allowing user to deposit to and borrow WETH from a dedicated user account
 */
contract WethPool is WrappedNativeTokenPool {
    // Returns max. acceptable pool utilisation after borrow action
    function getMaxPoolUtilisationForBorrowing() override public view returns (uint256) {
        return 0.925e18;
    }

    function name() public virtual override pure returns(string memory _name){
        _name = "DeltaPrimeWrappedETH";
    }

    function symbol() public virtual override pure returns(string memory _symbol){
        _symbol = "DPWETH";
    }

    function decimals() public virtual override pure returns(uint8 decimals){
        decimals = 18;
    }
}