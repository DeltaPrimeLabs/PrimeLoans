// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 5cf28801765938c1a9376cbe00c1aad6cb21c3fd;
pragma solidity 0.8.17;

import "../../Pool.sol";
import "../../AddressBlacklist.sol";


/**
 * @title UsdtPool
 * @dev Contract allowing user to deposit to and borrow USDT from a dedicated user account
 */
contract UsdtPool is Pool {
    AddressBlacklist public constant BLACKLIST = AddressBlacklist(0x3a77375988667fB4EA5d7AeD0696f606741F5e84); // Replace with actual deployment address

    function name() public virtual override pure returns(string memory _name){
        _name = "DeltaPrimeTetherToken";
    }

    function symbol() public virtual override pure returns(string memory _symbol){
        _symbol = "DPUSDt";
    }

    function decimals() public virtual override pure returns(uint8 decimals){
        decimals = 6;
    }

    /**
     * @dev Overrides the withdraw function to add blacklist checking
     * @param _amount the total amount to be withdrawn
     * @param intentIndices array of intent indices to be used for withdrawal
     */
    function withdraw(uint256 _amount, uint256[] calldata intentIndices) external override nonReentrant {
        // Check if the sender is blacklisted
        require(!BLACKLIST.isBlacklisted(msg.sender), "Pool: sender is blacklisted");

        // Call the parent contract's withdraw function
        super.withdraw(_amount, intentIndices);
    }
}