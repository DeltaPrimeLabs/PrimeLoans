// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 2fb058fa4d8089fcdc61eecc5d098914722a8f02;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "../../ReentrancyGuardKeccak.sol";
import "../../OnlyOwnerOrInsolvent.sol";
import "../../interfaces/ITokenManager.sol";
import "../../interfaces/facets/avalanche/ISteakHutPool.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";

//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";

contract SteakHutFinanceFacet is ReentrancyGuardKeccak, OnlyOwnerOrInsolvent {
    using TransferHelper for address;

    /**
     * Stakes in SteakHut JOE/AVAX balanced-wide pool
     * @param amount0Desired amount of JOE to be staked
     * @param amount1Desired amount of AVAX to be staked
     * @param amount0Min minimum amount of JOE to be staked
     * @param amount1Min minimum amount of AVAX to be staked
     **/
    function stakeSteakHutJOEAVAX(uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min) external {
        _stakeTokenSteakHut(ISteakHutPool.StakingDetails({
            token0Symbol: "JOE",
            token1Symbol: "AVAX",
            vaultTokenSymbol: "SHLB_JOE-AVAX_B",
            amount0Desired: amount0Desired,
            amount1Desired: amount1Desired,
            amount0Min: amount0Min,
            amount1Min: amount1Min
        }));
    }

    /**
     * Unstakes from SteakHut JOE/AVAX balanced-wide pool
     * @param liquidity amount of shares to be unstaked
     * @param amount0Min minimum amount of JOE to be unstaked
     * @param amount1Min minimum amount of AVAX to be unstaked
     **/
    function unstakeSteakHutJOEAVAX(uint256 liquidity, uint256 amount0Min, uint256 amount1Min) external {
        _unstakeTokenSteakHut(ISteakHutPool.UnstakingDetails({
            token0Symbol: "JOE",
            token1Symbol: "AVAX",
            vaultTokenSymbol: "SHLB_JOE-AVAX_B",
            liquidity: liquidity,
            amount0Min: amount0Min,
            amount1Min: amount1Min
        }));
    }

    /**
     * Stakes in SteakHut EUROC/USDC balanced-wide pool
     * @param amount0Desired amount of EUROC to be staked
     * @param amount1Desired amount of USDC to be staked
     * @param amount0Min minimum amount of EUROC to be staked
     * @param amount1Min minimum amount of USDC to be staked
     **/
    function stakeSteakHutEUROCUSDC(uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min) external {
        _stakeTokenSteakHut(ISteakHutPool.StakingDetails({
            token0Symbol: "EUROC",
            token1Symbol: "USDC",
            vaultTokenSymbol: "SHLB_EUROC-USDC_V2_1_B",
            amount0Desired: amount0Desired,
            amount1Desired: amount1Desired,
            amount0Min: amount0Min,
            amount1Min: amount1Min
        }));
    }

    /**
     * Unstakes from SteakHut EUROC/USDC balanced-wide pool
     * @param liquidity amount of shares to be unstaked
     * @param amount0Min minimum amount of EUROC to be unstaked
     * @param amount1Min minimum amount of USDC to be unstaked
     **/
    function unstakeSteakHutEUROCUSDC(uint256 liquidity, uint256 amount0Min, uint256 amount1Min) external {
        _unstakeTokenSteakHut(ISteakHutPool.UnstakingDetails({
            token0Symbol: "EUROC",
            token1Symbol: "USDC",
            vaultTokenSymbol: "SHLB_EUROC-USDC_V2_1_B",
            liquidity: liquidity,
            amount0Min: amount0Min,
            amount1Min: amount1Min
        }));
    }

    /**
     * Stakes in SteakHut AVAX/USDC balanced-wide pool
     * @param amount0Desired amount of AVAX to be staked
     * @param amount1Desired amount of USDC to be staked
     * @param amount0Min minimum amount of AVAX to be staked
     * @param amount1Min minimum amount of USDC to be staked
     **/
    function stakeSteakHutAVAXUSDC(uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min) external {
        _stakeTokenSteakHut(ISteakHutPool.StakingDetails({
            token0Symbol: "AVAX",
            token1Symbol: "USDC",
            vaultTokenSymbol: "SHLB_AVAX-USDC_B",
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
    function unstakeSteakHutAVAXUSDC(uint256 liquidity, uint256 amount0Min, uint256 amount1Min) external {
        _unstakeTokenSteakHut(ISteakHutPool.UnstakingDetails({
            token0Symbol: "AVAX",
            token1Symbol: "USDC",
            vaultTokenSymbol: "SHLB_AVAX-USDC_B",
            liquidity: liquidity,
            amount0Min: amount0Min,
            amount1Min: amount1Min
        }));
    }

    /**
     * Stakes in SteakHut BTC/AVAX balanced-wide pool
     * @param amount0Desired amount of BTC to be staked
     * @param amount1Desired amount of AVAX to be staked
     * @param amount0Min minimum amount of BTC to be staked
     * @param amount1Min minimum amount of AVAX to be staked
     **/
    function stakeSteakHutBTCAVAX(uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min) external {
        _stakeTokenSteakHut(ISteakHutPool.StakingDetails({
            token0Symbol: "BTC",
            token1Symbol: "AVAX",
            vaultTokenSymbol: "SHLB_BTC.b-AVAX_B",
            amount0Desired: amount0Desired,
            amount1Desired: amount1Desired,
            amount0Min: amount0Min,
            amount1Min: amount1Min
        }));
    }

    /**
     * Unstakes from SteakHut BTC/AVAX balanced-wide pool
     * @param liquidity amount of shares to be unstaked
     * @param amount0Min minimum amount of BTC to be unstaked
     * @param amount1Min minimum amount of AVAX to be unstaked
     **/
    function unstakeSteakHutBTCAVAX(uint256 liquidity, uint256 amount0Min, uint256 amount1Min) external {
        _unstakeTokenSteakHut(ISteakHutPool.UnstakingDetails({
            token0Symbol: "BTC",
            token1Symbol: "AVAX",
            vaultTokenSymbol: "SHLB_BTC.b-AVAX_B",
            liquidity: liquidity,
            amount0Min: amount0Min,
            amount1Min: amount1Min
        }));
    }

    /**
     * Stakes in SteakHut USDT.e/USDT concentrated pool
     * @param amount0Desired amount of USDT.e to be staked
     * @param amount1Desired amount of USDT to be staked
     * @param amount0Min minimum amount of USDT.e to be staked
     * @param amount1Min minimum amount of USDT to be staked
     **/
    function stakeSteakHutUSDTeUSDT(uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min) external {
        _stakeTokenSteakHut(ISteakHutPool.StakingDetails({
            token0Symbol: "USDT.e",
            token1Symbol: "USDT",
            vaultTokenSymbol: "SHLB_USDT.e-USDt_C",
            amount0Desired: amount0Desired,
            amount1Desired: amount1Desired,
            amount0Min: amount0Min,
            amount1Min: amount1Min
        }));
    }

    /**
     * Unstakes from SteakHut USDT.e/USDT concentrated pool
     * @param liquidity amount of shares to be unstaked
     * @param amount0Min minimum amount of USDT.e to be unstaked
     * @param amount1Min minimum amount of USDT to be unstaked
     **/
    function unstakeSteakHutUSDTeUSDT(uint256 liquidity, uint256 amount0Min, uint256 amount1Min) external {
        _unstakeTokenSteakHut(ISteakHutPool.UnstakingDetails({
            token0Symbol: "USDT.e",
            token1Symbol: "USDT",
            vaultTokenSymbol: "SHLB_USDT.e-USDt_C",
            liquidity: liquidity,
            amount0Min: amount0Min,
            amount1Min: amount1Min
        }));
    }

    // ----- PRIVATE METHODS -----

    /**
     * Stakes {stakingDetails.token0Address}, {stakingDetails.token1Address} token in the SteakHut pool
     * @param stakingDetails ISteakHutPool.StakingDetails staking details
     **/
    function _stakeTokenSteakHut(ISteakHutPool.StakingDetails memory stakingDetails) private nonReentrant onlyOwner recalculateAssetsExposure remainsSolvent {
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
        (, uint256 amount0Actual, uint256 amount1Actual) = ISteakHutPool(vaultAddress).deposit(stakingDetails.amount0Desired, stakingDetails.amount1Desired, stakingDetails.amount0Min, stakingDetails.amount1Min);

        // Add/remove owned tokens
        DiamondStorageLib.addOwnedAsset(stakingDetails.vaultTokenSymbol, vaultAddress);
        if(token0.balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(stakingDetails.token0Symbol);
        }
        if(token1.balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(stakingDetails.token1Symbol);
        }

        emit Staked(
            msg.sender,
            stakingDetails.token0Symbol,
            stakingDetails.token1Symbol,
            vaultAddress,
            amount0Actual,
            amount1Actual,
            vaultToken.balanceOf(address(this)) - initialVaultBalance,
            block.timestamp
        );
    }

    /**
     * Unstakes {UnstakingDetails.token0Address}, {UnstakingDetails.token1Address} token from the SteakHut pool
     * @param unstakingDetails ISteakHutPool.UnstakingDetails unstaking details
     **/
    function _unstakeTokenSteakHut(ISteakHutPool.UnstakingDetails memory unstakingDetails) private nonReentrant onlyOwnerOrInsolvent recalculateAssetsExposure {
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

                ISteakHutPool(vaultAddress).withdraw(unstakingDetails.liquidity);

                amount0Unstaked = depositToken0.balanceOf(address(this)) - initialDepositTokenBalance0;
                amount1Unstaked = depositToken1.balanceOf(address(this)) - initialDepositTokenBalance1;
                require(amount0Unstaked >= unstakingDetails.amount0Min && amount1Unstaked >= unstakingDetails.amount1Min, "Unstaked less tokens than expected");
            }

            // Add/remove owned tokens
            DiamondStorageLib.addOwnedAsset(unstakingDetails.token0Symbol, address(depositToken0));
            DiamondStorageLib.addOwnedAsset(unstakingDetails.token1Symbol, address(depositToken1));
        }
        uint256 newVaultTokenBalance = IERC20(vaultAddress).balanceOf(address(this));
        if(newVaultTokenBalance == 0) {
            DiamondStorageLib.removeOwnedAsset(unstakingDetails.vaultTokenSymbol);
        }

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
