// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "../../ReentrancyGuardKeccak.sol";
import "../../lib/SolvencyMethods.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";
import "../../interfaces/ITokenManager.sol";

//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";
import "../../interfaces/arbitrum/IConvexPool.sol";
import "../../interfaces/arbitrum/IConvexRewarder.sol";

contract ConvexFacetArbi is ReentrancyGuardKeccak, SolvencyMethods {
    using TransferHelper for address;

    // Curve
    // TODO: Add to TokenManager
    address public constant CRV_USD_BTC_ETH_LP_TOKEN_ADDRESS = 0x8e0B8c8BB9db49a46697F3a5Bb8A308e744821D2;
    // TODO: Add to TokenManager
    address public constant CRV_TOKEN_ADDRESS = 0x11cDb42B0EB46D95f990BeDD4695A6e3fA034978;

    // Convex
    // TODO: Add to TokenManager
    address public constant CVX_TOKEN_ADDRESS = 0xb952A807345991BD529FDded05009F5e80Fe8F45;
    // TODO: Add to TokenManager
    address public constant CVX_USD_BTC_ETH_LP_TOKEN_ADDRESS = 0xA9249f8667cb120F065D9dA1dCb37AD28E1E8FF0;

    address public constant DEPOSIT_CONTRACT_USD_BTC_ETH_ADDRESS = 0xF403C135812408BFbE8713b5A23a04b3D48AAE31;
    uint256 public constant USD_BTC_ETH_POOL_ID = 8;

    function depositAndStakeUsdBtcEth(uint256 lpTokensAmount) external returns (uint256){
        return _depositAndStake(IConvexPool.DepositDetails({
            crvLpTokenAmount: lpTokensAmount,
            depositPoolId: USD_BTC_ETH_POOL_ID,
            depositPoolAddress: DEPOSIT_CONTRACT_USD_BTC_ETH_ADDRESS,
            crvLpTokenAddress: CRV_USD_BTC_ETH_LP_TOKEN_ADDRESS,
            crvLpTokenIdentifier: "CRV_USD_BTC_ETH",
            cvxPoolLPTokenAddress: CVX_USD_BTC_ETH_LP_TOKEN_ADDRESS,
            cvxPoolIdentifier: "CVX_USD_BTC_ETH"
        }));

    }

    function withdrawAndClaimUsdBtcEth(uint256 receiptTokenAmount) external returns(uint256){
        return _withdrawAndClaim(IConvexPool.WithdrawalDetails({
            receiptTokenAmount: receiptTokenAmount,
            crvLpTokenAddress: CRV_USD_BTC_ETH_LP_TOKEN_ADDRESS,
            crvLpTokenIdentifier: "CRV_USD_BTC_ETH",
            cvxPoolLPTokenAddress: CVX_USD_BTC_ETH_LP_TOKEN_ADDRESS,
            cvxPoolIdentifier: "CVX_USD_BTC_ETH"
        }));
    }

    function _depositAndStake(IConvexPool.DepositDetails memory depositDetails) internal onlyOwner nonReentrant recalculateAssetsExposure remainsSolvent returns (uint256){
        IERC20Metadata crvLpToken = IERC20Metadata(depositDetails.crvLpTokenAddress);
        IERC20Metadata cvxLpToken = IERC20Metadata(depositDetails.cvxPoolLPTokenAddress);
        IConvexPool cvxPool = IConvexPool(depositDetails.depositPoolAddress);

        uint256 initialReceiptTokenBalance = cvxLpToken.balanceOf(address(this));

        depositDetails.crvLpTokenAmount = Math.min(crvLpToken.balanceOf(address(this)), depositDetails.crvLpTokenAmount);
        require(depositDetails.crvLpTokenAmount > 0, "Cannot stake 0 tokens");

        address(crvLpToken).safeApprove(address(cvxPool), 0);
        address(crvLpToken).safeApprove(address(cvxPool), depositDetails.crvLpTokenAmount);

        cvxPool.deposit(depositDetails.depositPoolId, depositDetails.crvLpTokenAmount);

        // Add/remove owned tokens
        DiamondStorageLib.addOwnedAsset(depositDetails.cvxPoolIdentifier, depositDetails.cvxPoolLPTokenAddress);
        if(crvLpToken.balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(depositDetails.crvLpTokenIdentifier);
        }

        uint256 receiptTokenReceivedAmount = cvxLpToken.balanceOf(address(this)) - initialReceiptTokenBalance;
        emit Staked(
            msg.sender,
            depositDetails.crvLpTokenIdentifier,
            depositDetails.depositPoolAddress,
            depositDetails.crvLpTokenAmount,
            receiptTokenReceivedAmount,
            block.timestamp);

        return receiptTokenReceivedAmount;
    }

    function _withdrawAndClaim(IConvexPool.WithdrawalDetails memory withdrawalDetails) internal onlyOwner nonReentrant recalculateAssetsExposure remainsSolvent returns (uint256){
        IERC20Metadata crvLpToken = IERC20Metadata(withdrawalDetails.crvLpTokenAddress);
        IConvexRewarder cvxRewarder = IConvexRewarder(withdrawalDetails.cvxPoolLPTokenAddress);
        IERC20Metadata crvToken = IERC20Metadata(CRV_TOKEN_ADDRESS);
        IERC20Metadata cvxToken = IERC20Metadata(CVX_TOKEN_ADDRESS);

        uint256 initialDepositTokenBalance = crvLpToken.balanceOf(address(this));
        withdrawalDetails.receiptTokenAmount = Math.min(cvxRewarder.balanceOf(address(this)), withdrawalDetails.receiptTokenAmount);

        // Always claim (true) rewards upon withdrawal
        cvxRewarder.withdraw(withdrawalDetails.receiptTokenAmount, true);

        // Curve LP token
        DiamondStorageLib.addOwnedAsset(withdrawalDetails.crvLpTokenIdentifier, withdrawalDetails.crvLpTokenAddress);

        // Add reward tokens if any were claimed
        if(crvToken.balanceOf(address(this)) > 0) {
            DiamondStorageLib.addOwnedAsset("CRV", CRV_TOKEN_ADDRESS);
        }
        if(cvxToken.balanceOf(address(this)) > 0) {
            DiamondStorageLib.addOwnedAsset("CVX", CVX_TOKEN_ADDRESS);
        }

        // Convex LP token and rewarder are the same contract
        if(cvxRewarder.balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(withdrawalDetails.cvxPoolIdentifier);
        }

        uint256 depositTokenReceivedAmount = crvLpToken.balanceOf(address(this)) - initialDepositTokenBalance;

        emit Unstaked(
            msg.sender,
            withdrawalDetails.crvLpTokenIdentifier,
            withdrawalDetails.cvxPoolLPTokenAddress,
            depositTokenReceivedAmount,
            withdrawalDetails.receiptTokenAmount,
            block.timestamp);


        return depositTokenReceivedAmount;
    }

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    /**
        * @dev emitted when user stakes an asset
        * @param user the address executing staking
        * @param asset the asset that was staked
        * @param vault address of the vault token
        * @param depositTokenAmount how much of deposit token was staked
        * @param receiptTokenAmount how much of receipt token was received
        * @param timestamp of staking
    **/
    event Staked(address indexed user, bytes32 indexed asset, address indexed vault, uint256 depositTokenAmount, uint256 receiptTokenAmount, uint256 timestamp);

    /**
        * @dev emitted when user unstakes an asset
        * @param user the address executing unstaking
        * @param asset the asset that was unstaked
        * @param vault address of the vault token
        * @param depositTokenAmount how much deposit token was received
        * @param receiptTokenAmount how much receipt token was unstaked
        * @param timestamp of unstaking
    **/
    event Unstaked(address indexed user, bytes32 indexed asset, address indexed vault, uint256 depositTokenAmount, uint256 receiptTokenAmount, uint256 timestamp);

}
