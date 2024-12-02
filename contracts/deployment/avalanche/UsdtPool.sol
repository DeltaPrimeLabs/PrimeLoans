// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: df4e8663a52ef1d5a18b05efa088f2816405be91;
pragma solidity 0.8.17;

import "../../Pool.sol";


/**
 * @title UsdtPool
 * @dev Contract allowing user to deposit to and borrow USDT from a dedicated user account
 */
contract UsdtPool is Pool {
    function name() public virtual override pure returns(string memory _name){
        _name = "DeltaPrimeTetherToken";
    }

    function symbol() public virtual override pure returns(string memory _symbol){
        _symbol = "DPUSDt";
    }

    function decimals() public virtual override pure returns(uint8 decimals){
        decimals = 6;
    }
}