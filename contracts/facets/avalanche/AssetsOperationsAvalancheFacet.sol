// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 48436f168cf40ebb8f1ff77f4a20c807a2b11f28;
pragma solidity 0.8.17;

import "../AssetsOperationsFacet.sol";
import "../SmartLoanLiquidationFacet.sol";

contract AssetsOperationsAvalancheFacet is AssetsOperationsFacet {
    using TransferHelper for address payable;
    using TransferHelper for address;

    function YY_ROUTER() internal override pure returns (address) {
        return 0xC4729E56b831d74bBc18797e0e17A295fA77488c;
    }

    /**
    * Funds the loan with a specified amount of a GLP
    * @dev Requires approval for stakedGLP token on frontend side
    * @param _amount to be funded
    **/
    function fundGLP(uint256 _amount) public override nonReentrant {
        IERC20Metadata stakedGlpToken = IERC20Metadata(0xaE64d55a6f09E4263421737397D1fdFA71896a69);
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
    function withdrawGLP(uint256 _amount) public override onlyOwner nonReentrant canRepayDebtFully remainsSolvent{
        IERC20Metadata token = getERC20TokenInstance("GLP", true);
        IERC20Metadata stakedGlpToken = IERC20Metadata(0xaE64d55a6f09E4263421737397D1fdFA71896a69);
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
