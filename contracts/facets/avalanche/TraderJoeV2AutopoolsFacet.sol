// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: a33c92df6b73b24f43fe2acf6c3faf2d4ed3e03c;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "../../ReentrancyGuardKeccak.sol";
import "../../OnlyOwnerOrInsolvent.sol";
import "../../interfaces/ITokenManager.sol";
import "../../interfaces/facets/avalanche/ITraderJoeV2Autopool.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";

//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";
import "../../interfaces/facets/avalanche/ITraderJoeV2AutopoolsFacet.sol";

contract TraderJoeV2AutopoolsFacet is ITraderJoeV2AutopoolsFacet, ReentrancyGuardKeccak, OnlyOwnerOrInsolvent {
    using TransferHelper for address;

    /**
     * Stakes in TraderJoe V2 AVAX/USDC auto-pool
     * @param amount0Desired amount of AVAX to be staked
     * @param amount1Desired amount of USDC to be staked
     * @param amount0Min minimum amount of AVAX to be staked
     * @param amount1Min minimum amount of USDC to be staked
     **/
    function stakeTraderJoeV2AutopoolAVAXUSDC(uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min) external {
        stakeTokenTraderJoeV2Autopool(ITraderJoeV2Autopool.StakingDetails({
            token0Symbol: "AVAX",
            token1Symbol: "USDC",
            vaultTokenSymbol: "TJ_AVAX_USDC_AUTO",
            amount0Desired: amount0Desired,
            amount1Desired: amount1Desired,
            amount0Min: amount0Min,
            amount1Min: amount1Min
        }));
    }

    /**
     * Unstakes from SteakHut AVAX/USDC balanced-wide pool
     * @param liquidity amount of shares to be unstaked
     * @param amount0Min minimum amount of AVAX to be unstaked
     * @param amount1Min minimum amount of USDC to be unstaked
     **/
    function unstakeTraderJoeV2AutopoolAVAXUSDC(uint256 liquidity, uint256 amount0Min, uint256 amount1Min) external {
        unstakeTokenTraderJoeV2Autopool(ITraderJoeV2Autopool.UnstakingDetails({
            token0Symbol: "AVAX",
            token1Symbol: "USDC",
            vaultTokenSymbol: "TJ_AVAX_USDC_AUTO",
            liquidity: liquidity,
            amount0Min: amount0Min,
            amount1Min: amount1Min
        }));
    }

    // ----- PRIVATE METHODS -----

    /**
     * Stakes {stakingDetails.token0Address}, {stakingDetails.token1Address} token in the SteakHut pool
     * @param stakingDetails ITraderJoeV2Autopool.StakingDetails staking details
     **/
    function stakeTokenTraderJoeV2Autopool(ITraderJoeV2Autopool.StakingDetails memory stakingDetails) private nonReentrant onlyOwner remainsSolvent {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        address vaultAddress = tokenManager.getAssetAddress(stakingDetails.vaultTokenSymbol, false);
        IERC20 vaultToken = IERC20(vaultAddress);
        uint256 initialVaultBalance = vaultToken.balanceOf(address(this));

        IERC20 token0 = IERC20(tokenManager.getAssetAddress(stakingDetails.token0Symbol, false));
        IERC20 token1 = IERC20(tokenManager.getAssetAddress(stakingDetails.token1Symbol, false));

        stakingDetails.amount0Desired = Math.min(token0.balanceOf(address(this)), stakingDetails.amount0Desired);
        stakingDetails.amount1Desired = Math.min(token1.balanceOf(address(this)), stakingDetails.amount1Desired);
        require(stakingDetails.amount0Desired > 0 && stakingDetails.amount1Desired > 0, "Cannot stake 0 tokens");

        address(token0).safeApprove(vaultAddress, 0);
        address(token0).safeApprove(vaultAddress, stakingDetails.amount0Desired);
        address(token1).safeApprove(vaultAddress, 0);
        address(token1).safeApprove(vaultAddress, stakingDetails.amount1Desired);
        (, uint256 amount0Actual, uint256 amount1Actual) = ITraderJoeV2Autopool(vaultAddress).deposit(stakingDetails.amount0Desired, stakingDetails.amount1Desired);

        //TODO: difference to Steakhut
        require(amount0Actual >= stakingDetails.amount0Min && amount1Actual >= stakingDetails.amount1Min, "Staked less tokens than expected");

        _decreaseExposure(tokenManager, address(token0), amount0Actual);
        _decreaseExposure(tokenManager, address(token1), amount1Actual);

        uint256 vaultTokenReceived = vaultToken.balanceOf(address(this)) - initialVaultBalance;
        _increaseExposure(tokenManager, address(vaultToken), vaultTokenReceived);

        emit Staked(
            msg.sender,
            stakingDetails.token0Symbol,
            stakingDetails.token1Symbol,
            vaultAddress,
            amount0Actual,
            amount1Actual,
            vaultTokenReceived,
            block.timestamp
        );
    }

    /**
     * Unstakes {UnstakingDetails.token0Address}, {UnstakingDetails.token1Address} token from the SteakHut pool
     * @param unstakingDetails ITraderJoeV2Autopool.UnstakingDetails unstaking details
     **/
    function unstakeTokenTraderJoeV2Autopool(ITraderJoeV2Autopool.UnstakingDetails memory unstakingDetails) private nonReentrant onlyOwnerOrInsolvent {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        address vaultAddress = tokenManager.getAssetAddress(unstakingDetails.vaultTokenSymbol, true);
        uint256 vaultTokenBalance = IERC20(vaultAddress).balanceOf(address(this));

        uint256 amount0Unstaked;
        uint256 amount1Unstaked;
        {
            IERC20 depositToken0 = IERC20(tokenManager.getAssetAddress(unstakingDetails.token0Symbol, false));
            IERC20 depositToken1 = IERC20(tokenManager.getAssetAddress(unstakingDetails.token1Symbol, false));
            {
                uint256 initialDepositTokenBalance0 = depositToken0.balanceOf(address(this));
                uint256 initialDepositTokenBalance1 = depositToken1.balanceOf(address(this));
                unstakingDetails.liquidity = Math.min(IERC20(vaultAddress).balanceOf(address(this)), unstakingDetails.liquidity);

                //TODO: replace with the immediate withdrawal, that code CAN'T GO TO PROD
                ITraderJoeV2Autopool(vaultAddress).queueWithdrawal(unstakingDetails.liquidity, address(this));

                amount0Unstaked = depositToken0.balanceOf(address(this)) - initialDepositTokenBalance0;
                amount1Unstaked = depositToken1.balanceOf(address(this)) - initialDepositTokenBalance1;
                require(amount0Unstaked >= unstakingDetails.amount0Min && amount1Unstaked >= unstakingDetails.amount1Min, "Unstaked less tokens than expected");
            }
            _increaseExposure(tokenManager, address(depositToken0), amount0Unstaked);
            _increaseExposure(tokenManager, address(depositToken1), amount1Unstaked);
        }
        uint256 newVaultTokenBalance = IERC20(vaultAddress).balanceOf(address(this));

        _decreaseExposure(tokenManager, vaultAddress, vaultTokenBalance - newVaultTokenBalance);

        emit Unstaked(
            msg.sender,
            unstakingDetails.token0Symbol,
            unstakingDetails.token1Symbol,
            vaultAddress,
            amount0Unstaked,
            amount1Unstaked,
            vaultTokenBalance - newVaultTokenBalance,
            block.timestamp
        );
    }

    // MODIFIERS

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    // EVENTS

    /**
        * @dev emitted when user stakes an asset
        * @param user the address executing staking
        * @param asset0 the asset that was unstaked
        * @param asset1 the asset that was unstaked
        * @param vault address of the vault token
        * @param depositTokenAmount0 how much deposit token0 was received
        * @param depositTokenAmount1 how much deposit token1 was received
        * @param receiptTokenAmount how much of receipt token was received
        * @param timestamp of staking
    **/
    event Staked(address indexed user, bytes32 asset0, bytes32 asset1, address indexed vault, uint256 depositTokenAmount0, uint256 depositTokenAmount1, uint256 receiptTokenAmount, uint256 timestamp);

    /**
        * @dev emitted when user unstakes an asset
        * @param user the address executing unstaking
        * @param vault address of the vault token
        * @param asset0 the asset that was unstaked
        * @param asset1 the asset that was unstaked
        * @param depositTokenAmount0 how much deposit token0 was received
        * @param depositTokenAmount1 how much deposit token1 was received
        * @param receiptTokenAmount how much receipt token was unstaked
        * @param timestamp of unstaking
    **/
    event Unstaked(address indexed user, bytes32 asset0, bytes32 asset1, address indexed vault, uint256 depositTokenAmount0, uint256 depositTokenAmount1, uint256 receiptTokenAmount, uint256 timestamp);
}
