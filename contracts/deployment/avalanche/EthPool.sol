// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: df4e8663a52ef1d5a18b05efa088f2816405be91;
pragma solidity 0.8.17;

import "../../Pool.sol";
import "../../AddressRecalculationStatus.sol";


/**
 * @title EthPool
 * @dev Contract allowing user to deposit to and borrow WETH.e from a dedicated user account
 */
contract EthPool is Pool {
    AddressRecalculationStatus public constant RECALCULATION_STATUS = AddressRecalculationStatus(0x3a77375988667fB4EA5d7AeD0696f606741F5e84); // Replace with actual deployment address

    function getMaxPoolUtilisationForBorrowing() override public view returns (uint256) {
        return 0.925e18;
    }

    function name() public virtual override pure returns(string memory _name){
        _name = "DeltaPrimeWrappedEther";
    }

    function symbol() public virtual override pure returns(string memory _symbol){
        _symbol = "DPWETHe";
    }

    function decimals() public virtual override pure returns(uint8 decimals){
        decimals = 18;
    }
}