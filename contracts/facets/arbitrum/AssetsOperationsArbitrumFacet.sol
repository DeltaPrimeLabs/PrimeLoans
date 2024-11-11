// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 84d5aeadfd8810a47f09f0adc4cfdaadd6025092;
pragma solidity 0.8.17;

import "../AssetsOperationsFacet.sol";

contract AssetsOperationsArbitrumFacet is AssetsOperationsFacet {
    using TransferHelper for address payable;
    using TransferHelper for address;

    function YY_ROUTER() internal override pure returns (address) {
        return 0xb32C79a25291265eF240Eb32E9faBbc6DcEE3cE3;
    }

    /**
    * Funds the loan with a specified amount of a GLP
    * @dev Requires approval for stakedGLP token on frontend side
    * @param _amount to be funded
    **/
    function fundGLP(uint256 _amount) public override nonReentrant{
        IERC20Metadata stakedGlpToken = IERC20Metadata(0x5402B5F40310bDED796c7D0F3FF6683f5C0cFfdf);
        _amount = Math.min(_amount, stakedGlpToken.balanceOf(msg.sender));
        address(stakedGlpToken).safeTransferFrom(msg.sender, address(this), _amount);
        if (stakedGlpToken.balanceOf(address(this)) > 0) {
            DiamondStorageLib.addOwnedAsset("GLP", address(stakedGlpToken));
        }

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        tokenManager.increaseProtocolExposure("GLP", _amount);

        emit Funded(msg.sender, "GLP", _amount, block.timestamp);
    }

    /**
        * Withdraws specified amount of a GLP
        * @param _amount to be withdrawn
    **/
    function withdrawGLP(uint256 _amount) public override noOwnershipTransferInLast24hrs onlyOwner nonReentrant canRepayDebtFully remainsSolvent{
        IERC20Metadata token = getERC20TokenInstance("GLP", true);
        IERC20Metadata stakedGlpToken = IERC20Metadata(0x5402B5F40310bDED796c7D0F3FF6683f5C0cFfdf);
        _amount = Math.min(token.balanceOf(address(this)), _amount);

        address(stakedGlpToken).safeTransfer(msg.sender, _amount);
        if (token.balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset("GLP");
        }

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        tokenManager.decreaseProtocolExposure("GLP", _amount);

        emit Withdrawn(msg.sender, "GLP", _amount, block.timestamp);
    }
}
