// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.17;

import "../AssetsOperationsFacet.sol";

contract AssetsOperationsMock is AssetsOperationsFacet {
    using TransferHelper for address payable;
    using TransferHelper for address;

    /**
    * Withdraws an amount of a defined asset from the loan
    * This method does not perform any solvency check hence allows the user to withdraw whatever is available in the loan
    * @dev This function uses the redstone-evm-connector
    * @param _withdrawnAsset asset to be withdrawn
    * @param _amount to be withdrawn
    **/
    function withdraw(bytes32 _withdrawnAsset, uint256 _amount) public virtual override onlyOwner nonReentrant{
        IERC20Metadata token = getERC20TokenInstance(_withdrawnAsset, true);
        require(getBalance(_withdrawnAsset) >= _amount, "There is not enough funds to withdraw");

        address(token).safeTransfer(msg.sender, _amount);
        if (token.balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(_withdrawnAsset);
        }

        emit Withdrawn(msg.sender, _withdrawnAsset, _amount, block.timestamp);
    }
}
