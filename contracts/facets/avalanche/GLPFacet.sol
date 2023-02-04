// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 0007ebfc33e952d25041195365074b4a72859937;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "../../interfaces/facets/avalanche/IGLPRewarder.sol";
import "../../ReentrancyGuardKeccak.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";
import "../../OnlyOwnerOrInsolvent.sol";
import "../../interfaces/ITokenManager.sol";

//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";

contract GLPFacet is ReentrancyGuardKeccak, OnlyOwnerOrInsolvent {
    // Used to mint/redeem GLP
    address private constant GLP_REWARDER_ADDRESS = 0xB70B91CE0771d3f4c81D87660f71Da31d48eB3B3;
    // Used to approve tokens to mint GLP with
    address private constant GLP_MANAGER_ADDRESS = 0xD152c7F25db7F4B95b7658323c5F33d176818EE4;
    // fsGLP
    address private constant GLP_TOKEN_ADDRESS = 0x9e295B5B976a184B14aD8cd72413aD846C299660;

    function mintAndStakeGlp(address _token, uint256 _amount, uint256 _minUsdg, uint256 _minGlp) external nonReentrant onlyOwner noBorrowInTheSameBlock recalculateAssetsExposure remainsSolvent{
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        require(tokenManager.isTokenAssetActive(GLP_TOKEN_ADDRESS), "GLP not supported.");
        require(tokenManager.isTokenAssetActive(_token), "Asset not supported.");

        require(_amount > 0, "Amount of GLP to mint  has to be greater than 0");

        IERC20Metadata tokenToMintWith = IERC20Metadata(_token);
        bytes32 tokenToMintWithSymbol = tokenManager.tokenAddressToSymbol(_token);
        IGLPRewarder glpRewarder = IGLPRewarder(GLP_REWARDER_ADDRESS);
        IERC20Metadata glpToken = IERC20Metadata(GLP_TOKEN_ADDRESS);

        uint256 glpInitialBalance = glpToken.balanceOf(address(this));

        _amount = Math.min(tokenToMintWith.balanceOf(address(this)), _amount);

        tokenToMintWith.approve(GLP_MANAGER_ADDRESS, _amount);

        uint256 glpOutputAmount = glpRewarder.mintAndStakeGlp(_token, _amount, _minUsdg, _minGlp);

        require((glpToken.balanceOf(address(this)) - glpInitialBalance) == glpOutputAmount, "GLP minted and balance difference mismatch");
        require(glpOutputAmount >=_minGlp, "Insufficient output amount");

        // Add asset to ownedAssets
        if (glpToken.balanceOf(address(this)) > 0) {
            DiamondStorageLib.addOwnedAsset("GLP", GLP_TOKEN_ADDRESS);
        }

        // Remove asset from ownedAssets if the asset balance is 0 after the mint
        if (tokenToMintWith.balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(tokenToMintWithSymbol);
        }

        emit GLPMint(
            msg.sender,
            tokenToMintWithSymbol,
            _amount,
            glpOutputAmount,
            block.timestamp
        );

    }

    function unstakeAndRedeemGlp(address _tokenOut, uint256 _glpAmount, uint256 _minOut) external nonReentrant onlyOwnerOrInsolvent noBorrowInTheSameBlock recalculateAssetsExposure    {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        require(tokenManager.isTokenAssetActive(_tokenOut), "Asset not supported.");

        require(_glpAmount > 0, "Amount of GLP to redeem has to be greater than 0");

        IERC20Metadata redeemedToken = IERC20Metadata(_tokenOut);
        bytes32 redeemedTokenSymbol = tokenManager.tokenAddressToSymbol(_tokenOut);
        IGLPRewarder glpRewarder = IGLPRewarder(GLP_REWARDER_ADDRESS);
        IERC20Metadata glpToken = IERC20Metadata(GLP_TOKEN_ADDRESS);

        uint256 redeemedTokenInitialBalance = redeemedToken.balanceOf(address(this));
        _glpAmount = Math.min(glpToken.balanceOf(address(this)), _glpAmount);

        uint256 redeemedAmount = glpRewarder.unstakeAndRedeemGlp(_tokenOut, _glpAmount, _minOut, address(this));

        require((redeemedToken.balanceOf(address(this)) - redeemedTokenInitialBalance) == redeemedAmount, "Redeemed token amount and balance difference mismatch");
        require(redeemedAmount >= _minOut, "Insufficient output amount");

        // Add asset to ownedAssets
        if (redeemedToken.balanceOf(address(this)) > 0) {
            DiamondStorageLib.addOwnedAsset(redeemedTokenSymbol, _tokenOut);
        }

        // Remove asset from ownedAssets if the asset balance is 0 after the redemption
        if (glpToken.balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset("GLP");
        }

        emit GLPRedemption(
            msg.sender,
            redeemedTokenSymbol,
            _glpAmount,
            redeemedAmount,
            block.timestamp
        );

    }

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    /**
     * @dev emitted after a GLP token mint
     * @param user the address of user minting GLP
     * @param tokenToMintWith token which GLP was minted with
     * @param tokenToMintWithAmount amount of token used to mint GLP
     * @param glpOutputAmount amount of GLP minted
     * @param timestamp time of the mint
     **/
    event GLPMint(address indexed user, bytes32 indexed tokenToMintWith, uint256 tokenToMintWithAmount, uint256 glpOutputAmount, uint256 timestamp);

    /**
  * @dev emitted after a GLP token redemption
  * @param user the address of user redeeming GLP
  * @param redeemedToken token which GLP was redeemed into
  * @param glpRedeemedAmount amount of GLP redeemed
  * @param redeemedTokenAmount amount of redeemedToken redeemed
  * @param timestamp time of the redemption
  **/
    event GLPRedemption(address indexed user, bytes32 indexed redeemedToken, uint256 glpRedeemedAmount, uint256 redeemedTokenAmount, uint256 timestamp);
}
