// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 3711b8ab78a04d27fa4cdc43b2c308eb5e51c6c6;
pragma solidity 0.8.17;

import "../../Pool.sol";
import "../../AddressBlacklist.sol";


/**
 * @title EthPool
 * @dev Contract allowing user to deposit to and borrow WETH.e from a dedicated user account
 */
contract EthPool is Pool {
    AddressBlacklist public constant BLACKLIST = AddressBlacklist(0x3a77375988667fB4EA5d7AeD0696f606741F5e84); // Replace with actual deployment address

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

    /**
     * @dev Overrides the withdraw function to add blacklist checking
     * @param _amount the total amount to be withdrawn
     * @param intentIndices array of intent indices to be used for withdrawal
     */
    function withdraw(uint256 _amount, uint256[] calldata intentIndices) public override{
        // Check if the sender is blacklisted
        require(!BLACKLIST.isBlacklisted(msg.sender), "Pool: sender is blacklisted");

        // Call the parent contract's withdraw function
        super.withdraw(_amount, intentIndices);
    }

    function transfer(address _to, uint256 _amount) public override returns (bool) {
        // Check if the sender is blacklisted
        require(!BLACKLIST.isBlacklisted(msg.sender), "Pool: sender is blacklisted");

        // Call the parent contract's transfer function
        return super.transfer(_to, _amount);
    }

    function transferFrom(address _from, address _to, uint256 _amount) public override returns (bool) {
        // Check if the sender is blacklisted
        require(!BLACKLIST.isBlacklisted(msg.sender), "Pool: sender is blacklisted");

        // Call the parent contract's transferFrom function
        return super.transferFrom(_from, _to, _amount);
    }

    function deposit(uint256 _amount) public override{
        // Check if the sender is blacklisted
        require(!BLACKLIST.isBlacklisted(msg.sender), "Pool: sender is blacklisted");

        // Call the parent contract's deposit function
        super.deposit(_amount);
    }
}