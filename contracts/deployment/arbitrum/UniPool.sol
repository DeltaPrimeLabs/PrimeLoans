// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 67471c167ea4dcee4590ca5d8289a47373be90e3;
pragma solidity 0.8.17;

import "../../Pool.sol";


/**
 * @title EthPool
 * @dev Contract allowing user to deposit to and borrow WETH.e from a dedicated user account
 */
contract UniPool is Pool {
    function getMaxPoolUtilisationForBorrowing() override public view returns (uint256) {
        return 0.925e18;
    }

    function name() public virtual override pure returns(string memory _name){
        _name = "DeltaPrimeUniswap";
    }

    function symbol() public virtual override pure returns(string memory _symbol){
        _symbol = "DPUNI";
    }

    function decimals() public virtual override pure returns(uint8 decimals){
        decimals = 18;
    }
}