// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 5cf28801765938c1a9376cbe00c1aad6cb21c3fd;
pragma solidity 0.8.17;

import "../../WrappedNativeTokenPool.sol";
import "../../AddressBlacklist.sol";


/**
 * @title WavaxPool
 * @dev Contract allowing user to deposit to and borrow WAVAX from a dedicated user account
 */
contract WavaxPool is WrappedNativeTokenPool {
    AddressBlacklist public constant BLACKLIST = AddressBlacklist(0x3a77375988667fB4EA5d7AeD0696f606741F5e84); // Replace with actual deployment address

    // Returns max. acceptable pool utilisation after borrow action
    function getMaxPoolUtilisationForBorrowing() override public view returns (uint256) {
        return 0.925e18;
    }

    function name() public virtual override pure returns(string memory _name){
        _name = "DeltaPrimeWrappedAVAX";
    }

    function symbol() public virtual override pure returns(string memory _symbol){
        _symbol = "DPWAVAX";
    }

    function decimals() public virtual override pure returns(uint8 decimals){
        decimals = 18;
    }

    /**
     * @dev Overrides the withdraw function to add blacklist checking
     * @param _amount the total amount to be withdrawn
     * @param intentIndices array of intent indices to be used for withdrawal
     */
    function withdraw(uint256 _amount, uint256[] calldata intentIndices) public override nonReentrant {
        // Check if the sender is blacklisted
        require(!BLACKLIST.isBlacklisted(msg.sender), "Pool: sender is blacklisted");

        // Call the parent contract's withdraw function
        super.withdraw(_amount, intentIndices);
    }

    /**
     * @dev Overrides the withdrawNativeToken function to add blacklist checking
     * @param _amount the total amount to be withdrawn
     * @param intentIndices array of intent indices to be used for withdrawal
     */
    function withdrawNativeToken(uint256 _amount, uint256[] calldata intentIndices) public override nonReentrant {
        // Check if the sender is blacklisted
        require(!BLACKLIST.isBlacklisted(msg.sender), "Pool: sender is blacklisted");

        // Call the parent contract's withdraw function
        super.withdrawNativeToken(_amount, intentIndices);
    }

    function transfer(address _to, uint256 _amount) public override nonReentrant returns (bool) {
        // Check if the sender is blacklisted
        require(!BLACKLIST.isBlacklisted(msg.sender), "Pool: sender is blacklisted");

        // Call the parent contract's transfer function
        return super.transfer(_to, _amount);
    }

    function transferFrom(address _from, address _to, uint256 _amount) public override nonReentrant returns (bool) {
        // Check if the sender is blacklisted
        require(!BLACKLIST.isBlacklisted(msg.sender), "Pool: sender is blacklisted");

        // Call the parent contract's transferFrom function
        return super.transferFrom(_from, _to, _amount);
    }

    function deposit(uint256 _amount) public override nonReentrant {
        // Check if the sender is blacklisted
        require(!BLACKLIST.isBlacklisted(msg.sender), "Pool: sender is blacklisted");

        // Call the parent contract's deposit function
        super.deposit(_amount);
    }
}