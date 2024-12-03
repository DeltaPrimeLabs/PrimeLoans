// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 47cac92e2aae18ac8937139ac1f8de17bc62f581;
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
    function withdrawGLP(uint256 _amount) public override onlyOwner nonReentrant canRepayDebtFully remainsSolvent{
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

    function isWhitelistedAdapterOptimized(address adapter) public override pure returns (bool) {
        if (adapter == 0x9b96595298a1Ba7b6c389f217d55896960BBB4AE) return true;  // ?
        if (adapter == 0x985d014DA6e6C781ec3FF77E8Fd48c30174F3d96) return true;  // ?
        if (adapter == 0x81544aCDBcFfdc9c0A265CFB220408E1E85AA43D) return true;  // ?
        if (adapter == 0xbf042126c0C0D2c658915C2d21922D3440092F48) return true;  // ?
        if (adapter == 0x784E00Cd961a994eff675E889AF6CA564689BF39) return true;  // ?
        if (adapter == 0xb60CE5bF2A231EDA70825f9cdcD0795102218ab0) return true;  // ?
        if (adapter == 0x3b2378a29F9CbDb1f20A72611C0f000aF05630cb) return true;  // ?
        if (adapter == 0xc5b9041F9748A9A4437Ba90f9806cE8c3F9085Fc) return true;  // ?
        if (adapter == 0x9d8D45Ad3388846e6F0062196e24df4c7654098b) return true;  // LB22Adapter
        if (adapter == 0xc37c9Db4e84163b29996Aa96ADFeC21683aBA017) return true;  // LB22Adapter
        if (adapter == 0x8D82023cA60B904304033E6f990EAbcEDCF9630E) return true;  // WoofiV2Adapter
        if (adapter == 0x9D609aD3c673E2ddB3047C3F3B3efa2Ce14EB436) return true;  // ?
        if (adapter == 0x19eb54ccB443aCED9dcbC960bA98064A13262Ef3) return true;  // ?
        if (adapter == 0x4aacd032a541176CEeb39AB06d67637097819a35) return true;  // RamsesV2Adapter
        if (adapter == 0x3B9645B2432374d9B3Fa766b95D5A793D7241190) return true;  // CurvePlain128Adapter
        if (adapter == 0x8D1a37e346dC5718Cb9a8312F68b37a934Be13Ef) return true;  // CurvePlain128Adapter
        if (adapter == 0x9235E645B845C730026F31bCfeb7f90bcc7Fa78b) return true;  // CurvePlain128Adapter
        if (adapter == 0x4001efe66331587b9e18a1E84bB9584011157c5c) return true;  // CurvePlain128Adapter
        return false;
    }
}
