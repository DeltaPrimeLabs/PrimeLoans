// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 4868651cb1f224e3b50de0be85c2febf87f0e476;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "../../interfaces/facets/avalanche/IGLPRewarder.sol";
import "../../interfaces/facets/avalanche/IRewardRouterV2.sol";
import "../../interfaces/facets/avalanche/IRewardTracker.sol";
import "../../ReentrancyGuardKeccak.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";
import "../../OnlyOwnerOrInsolvent.sol";
import "../../interfaces/ITokenManager.sol";

//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";

contract GLPFacet is ReentrancyGuardKeccak, OnlyOwnerOrInsolvent {
    using TransferHelper for address;

    // Used to claim GLP fees
    address private constant REWARD_ROUTER_ADDRESS = 0x091eD806490Cc58Fd514441499e58984cCce0630;
    // Used to mint/redeem GLP
    address private constant GLP_REWARD_ROUTER_ADDRESS = 0xB70B91CE0771d3f4c81D87660f71Da31d48eB3B3;
    // Used to approve tokens to mint GLP with
    address private constant GLP_MANAGER_ADDRESS = 0xD152c7F25db7F4B95b7658323c5F33d176818EE4;
    // fsGLP
    address private constant GLP_TOKEN_ADDRESS = 0x9e295B5B976a184B14aD8cd72413aD846C299660;

    function claimGLpFees() external nonReentrant onlyOwner noBorrowInTheSameBlock remainsSolvent {
        IRewardRouterV2 rewardRouter = IRewardRouterV2(REWARD_ROUTER_ADDRESS);
        IRewardTracker rewardTracker = IRewardTracker(rewardRouter.feeGlpTracker());
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        require(rewardTracker.claimable(address(this)) > 0, "There are no claimable fees");

        IERC20Metadata wavaxToken = getERC20TokenInstance("AVAX", false);
        uint256 initialWavaxBalance = wavaxToken.balanceOf(address(this));

        rewardRouter.claimFees();

        uint256 postClaimingWavaxBalance = wavaxToken.balanceOf(address(this));
        uint256 wavaxClaimed = postClaimingWavaxBalance-initialWavaxBalance;
        _increaseExposure(tokenManager, address(wavaxToken), wavaxClaimed);

        emit GLPFeesClaim(msg.sender, wavaxClaimed, block.timestamp);
    }

    function mintAndStakeGlp(address _token, uint256 _amount, uint256 _minUsdg, uint256 _minGlp) external nonReentrant onlyOwner noBorrowInTheSameBlock remainsSolvent{
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        require(tokenManager.isTokenAssetActive(GLP_TOKEN_ADDRESS), "GLP not supported.");
        require(tokenManager.isTokenAssetActive(_token), "Asset not supported.");

        IERC20Metadata tokenToMintWith = IERC20Metadata(_token);
        bytes32 tokenToMintWithSymbol = tokenManager.tokenAddressToSymbol(_token);
        IGLPRewarder glpRewarder = IGLPRewarder(GLP_REWARD_ROUTER_ADDRESS);
        IERC20Metadata glpToken = IERC20Metadata(GLP_TOKEN_ADDRESS);

        uint256 glpInitialBalance = glpToken.balanceOf(address(this));

        _amount = Math.min(tokenToMintWith.balanceOf(address(this)), _amount);

        require(_amount > 0, "Amount of GLP to mint  has to be greater than 0");

        _token.safeApprove(GLP_MANAGER_ADDRESS, 0);
        _token.safeApprove(GLP_MANAGER_ADDRESS, _amount);

        uint256 glpOutputAmount = glpRewarder.mintAndStakeGlp(_token, _amount, _minUsdg, _minGlp);

        require((glpToken.balanceOf(address(this)) - glpInitialBalance) == glpOutputAmount, "GLP minted and balance difference mismatch");
        require(glpOutputAmount >=_minGlp, "Insufficient output amount");

        _increaseExposure(tokenManager, GLP_TOKEN_ADDRESS, glpOutputAmount);
        _decreaseExposure(tokenManager, _token, _amount);

        emit GLPMint(
            msg.sender,
            tokenToMintWithSymbol,
            _amount,
            glpOutputAmount,
            block.timestamp
        );

    }

    function unstakeAndRedeemGlp(address _tokenOut, uint256 _glpAmount, uint256 _minOut) external nonReentrant onlyOwnerOrInsolvent noBorrowInTheSameBlock    {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        require(tokenManager.isTokenAssetActive(_tokenOut), "Asset not supported.");

        IERC20Metadata redeemedToken = IERC20Metadata(_tokenOut);
        bytes32 redeemedTokenSymbol = tokenManager.tokenAddressToSymbol(_tokenOut);
        IGLPRewarder glpRewarder = IGLPRewarder(GLP_REWARD_ROUTER_ADDRESS);
        IERC20Metadata glpToken = IERC20Metadata(GLP_TOKEN_ADDRESS);

        uint256 redeemedTokenInitialBalance = redeemedToken.balanceOf(address(this));
        _glpAmount = Math.min(glpToken.balanceOf(address(this)), _glpAmount);

        require(_glpAmount > 0, "Amount of GLP to redeem has to be greater than 0");

        uint256 redeemedAmount = glpRewarder.unstakeAndRedeemGlp(_tokenOut, _glpAmount, _minOut, address(this));

        require((redeemedToken.balanceOf(address(this)) - redeemedTokenInitialBalance) == redeemedAmount, "Redeemed token amount and balance difference mismatch");
        require(redeemedAmount >= _minOut, "Insufficient output amount");

        _decreaseExposure(tokenManager, GLP_TOKEN_ADDRESS, _glpAmount);
        _increaseExposure(tokenManager, _tokenOut, redeemedAmount);

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

    /**
    * @dev emitted after claiming GLP fees
    * @param user the address of user claiming fees
    * @param wavaxAmountClaimed amount of wavax fees that were claimed
    * @param timestamp time of claiming the fees
    **/
    event GLPFeesClaim(address indexed user, uint256 wavaxAmountClaimed, uint256 timestamp);
}
