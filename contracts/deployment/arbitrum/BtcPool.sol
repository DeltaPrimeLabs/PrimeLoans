// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 3711b8ab78a04d27fa4cdc43b2c308eb5e51c6c6;
pragma solidity 0.8.17;

import "../../Pool.sol";


/**
 * @title BtcPool
 * @dev Contract allowing user to deposit to and borrow BTC.b from a dedicated user account
 */
contract BtcPool is Pool {
    function getMaxPoolUtilisationForBorrowing() override public view returns (uint256) {
        return 0.925e18;
    }

    function name() public virtual override pure returns(string memory _name){
        _name = "DeltaPrimeBitcoin";
    }

    function symbol() public virtual override pure returns(string memory _symbol){
        _symbol = "DPWBTC";
    }

    function decimals() public virtual override pure returns(uint8 decimals){
        decimals = 8;
    }
}