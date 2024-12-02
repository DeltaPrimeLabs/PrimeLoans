// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: df4e8663a52ef1d5a18b05efa088f2816405be91;
pragma solidity 0.8.17;

import "../../Pool.sol";
import "../../AddressBlacklist.sol";


/**
 * @title BtcPool
 * @dev Contract allowing user to deposit to and borrow BTC.b from a dedicated user account
 */
contract BtcPool is Pool {
    AddressBlacklist public constant BLACKLIST = AddressBlacklist(0x3a77375988667fB4EA5d7AeD0696f606741F5e84); // Replace with actual deployment address

    function getMaxPoolUtilisationForBorrowing() override public view returns (uint256) {
        return 0.925e18;
    }

    function name() public virtual override pure returns(string memory _name){
        _name = "DeltaPrimeBitcoin";
    }

    function symbol() public virtual override pure returns(string memory _symbol){
        _symbol = "DPBTCb";
    }

    function decimals() public virtual override pure returns(uint8 decimals){
        decimals = 8;
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