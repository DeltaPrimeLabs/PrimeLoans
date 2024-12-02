// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: df4e8663a52ef1d5a18b05efa088f2816405be91;
pragma solidity 0.8.17;

import "../../Pool.sol";
import "../../AddressRecalculationStatus.sol";


/**
 * @title UsdcPool
 * @dev Contract allowing user to deposit to and borrow USDC from a dedicated user account
 */
contract UsdcPool is Pool {
    AddressRecalculationStatus public constant RECALCULATION_STATUS = AddressRecalculationStatus(0x46a2CF74C6142CE7568aee5b1eFf77287781cd9D); // Replace with actual deployment address

    function name() public virtual override pure returns(string memory _name){
        _name = "DeltaPrimeUSDCoin";
    }

    function symbol() public virtual override pure returns(string memory _symbol){
        _symbol = "DPUSDC";
    }

    function decimals() public virtual override pure returns(uint8 decimals){
        decimals = 6;
    }

    /**
     * @dev Overrides the withdraw function to add RECALCULATION_STATUS checking
     * @param _amount the total amount to be withdrawn
     * @param intentIndices array of intent indices to be used for withdrawal
     */
    function withdraw(uint256 _amount, uint256[] calldata intentIndices) public override {
        // Check if the sender needs recalculation
        require(!RECALCULATION_STATUS.needsRecalculationCheck(msg.sender), "Pool: sender needs recalculation");

        // Call the parent contract's withdraw function
        super.withdraw(_amount, intentIndices);
    }

    function transfer(address _to, uint256 _amount) public override returns (bool) {
        // Check if the sender needs recalculation
        require(!RECALCULATION_STATUS.needsRecalculationCheck(msg.sender), "Pool: sender needs recalculation");

        // Call the parent contract's transfer function
        return super.transfer(_to, _amount);
    }

    function transferFrom(address _from, address _to, uint256 _amount) public override returns (bool) {
        // Check if the sender needs recalculation
        require(!RECALCULATION_STATUS.needsRecalculationCheck(msg.sender), "Pool: sender needs recalculation");

        // Call the parent contract's transferFrom function
        return super.transferFrom(_from, _to, _amount);
    }

    function deposit(uint256 _amount) public override{
        // Check if the sender needs recalculation
        require(!RECALCULATION_STATUS.needsRecalculationCheck(msg.sender), "Pool: sender needs recalculation");

        // Call the parent contract's deposit function
        super.deposit(_amount);
    }
}