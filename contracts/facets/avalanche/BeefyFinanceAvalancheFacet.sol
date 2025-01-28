// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../../ReentrancyGuardKeccak.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "../../OnlyOwnerOrInsolvent.sol";
import "../../interfaces/facets/IBeefyFinance.sol";

import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";

//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";

contract BeefyFinanceAvalancheFacet is ReentrancyGuardKeccak, OnlyOwnerOrInsolvent {
    using TransferHelper for address payable;
    using TransferHelper for address;

    // Vaults
    address private constant MOO_PNG_AVAX_USDC_LP = 0xf3340EdF16563D52C7E7C576F2fCC8f3D52464aB;
    address private constant MOO_PNG_AVAX_USDCe_LP = 0x9B02209a331c072637C6eBd34cdCD6b6A16987a9;
    address private constant MOO_TJ_AVAX_USDC_LP = 0x7E5bC7088aB3Da3e7fa1Aa7ceF1dC73F5B00681c;

    // LPs
    address private constant PNG_AVAX_USDC_LP = 0x0e0100Ab771E9288e0Aa97e11557E6654C3a9665;
    address private constant PNG_AVAX_USDCe_LP = 0xbd918Ed441767fe7924e99F6a0E0B568ac1970D9;
    address private constant TJ_AVAX_USDC_LP = 0xf4003F4efBE8691B60249E6afbD307aBE7758adb;

    // ----- STAKE -----

    /**
      * Stakes PNG_AVAX_USDC_LP in the Beefy protocol
      * @dev This function uses the redstone-evm-connector
      * @param amount amount of PNG_AVAX_USDC_LP to be staked
    **/
    function stakePngUsdcAvaxLpBeefy(uint256 amount) public onlyOwnerOrInsolvent nonReentrant remainsSolvent {
        _stakeLpBeefy(IBeefyFinance.BeefyStakingDetails({
            lpTokenAddress: PNG_AVAX_USDC_LP,
            vaultAddress: MOO_PNG_AVAX_USDC_LP,
            lpTokenSymbol: "PNG_AVAX_USDC_LP",
            vaultTokenSymbol: "MOO_PNG_AVAX_USDC_LP",
            amount: amount
        }));
    }

    /**
      * Stakes PNG_AVAX_USDCe_LP in the Beefy protocol
      * @dev This function uses the redstone-evm-connector
      * @param amount amount of PNG_AVAX_USDCe_LP to be staked
    **/
    function stakePngUsdceAvaxLpBeefy(uint256 amount) public onlyOwnerOrInsolvent nonReentrant remainsSolvent {
        _stakeLpBeefy(IBeefyFinance.BeefyStakingDetails({
        lpTokenAddress: PNG_AVAX_USDCe_LP,
        vaultAddress: MOO_PNG_AVAX_USDCe_LP,
        lpTokenSymbol: "PNG_AVAX_USDCe_LP",
        vaultTokenSymbol: "MOO_PNG_AVAX_USDCe_LP",
        amount: amount
        }));
    }

    /**
      * Stakes TJ_AVAX_USDC_LP in the Beefy protocol
      * @dev This function uses the redstone-evm-connector
      * @param amount amount of TJ_AVAX_USDC_LP to be staked
    **/
    function stakeTjUsdcAvaxLpBeefy(uint256 amount) public onlyOwnerOrInsolvent nonReentrant remainsSolvent {
        _stakeLpBeefy(IBeefyFinance.BeefyStakingDetails({
        lpTokenAddress: TJ_AVAX_USDC_LP,
        vaultAddress: MOO_TJ_AVAX_USDC_LP,
        lpTokenSymbol: "TJ_AVAX_USDC_LP",
        vaultTokenSymbol: "MOO_TJ_AVAX_USDC_LP",
        amount: amount
        }));
    }

    // ----- UNSTAKE -----

    /**
      * Unstakes PNG_AVAX_USDC_LP from the Beefy protocol
      * @dev This function uses the redstone-evm-connector
      * @param amount amount of PNG_AVAX_USDC_LP to be unstaked
    **/
    function unstakePngUsdcAvaxLpBeefy(uint256 amount) public onlyOwnerOrInsolvent nonReentrant {
        _unstakeLpBeefy(IBeefyFinance.BeefyStakingDetails({
        lpTokenAddress: PNG_AVAX_USDC_LP,
        vaultAddress: MOO_PNG_AVAX_USDC_LP,
        lpTokenSymbol: "PNG_AVAX_USDC_LP",
        vaultTokenSymbol: "MOO_PNG_AVAX_USDC_LP",
        amount: amount
        }));
    }

    /**
      * Unstakes PNG_AVAX_USDCe_LP from the Beefy protocol
      * @dev This function uses the redstone-evm-connector
      * @param amount amount of PNG_AVAX_USDCe_LP to be unstaked
    **/
    function unstakePngUsdceAvaxLpBeefy(uint256 amount) public onlyOwnerOrInsolvent nonReentrant {
        _unstakeLpBeefy(IBeefyFinance.BeefyStakingDetails({
        lpTokenAddress: PNG_AVAX_USDCe_LP,
        vaultAddress: MOO_PNG_AVAX_USDCe_LP,
        lpTokenSymbol: "PNG_AVAX_USDCe_LP",
        vaultTokenSymbol: "MOO_PNG_AVAX_USDCe_LP",
        amount: amount
        }));
    }

    /**
      * Untakes TJ_AVAX_USDC_LP from the Beefy protocol
      * @dev This function uses the redstone-evm-connector
      * @param amount amount of TJ_AVAX_USDC_LP to be unstaked
    **/
    function unstakeTjUsdcAvaxLpBeefy(uint256 amount) public onlyOwnerOrInsolvent nonReentrant {
        _unstakeLpBeefy(IBeefyFinance.BeefyStakingDetails({
        lpTokenAddress: TJ_AVAX_USDC_LP,
        vaultAddress: MOO_TJ_AVAX_USDC_LP,
        lpTokenSymbol: "TJ_AVAX_USDC_LP",
        vaultTokenSymbol: "MOO_TJ_AVAX_USDC_LP",
        amount: amount
        }));
    }

    // ----- PRIVATE METHODS -----


    /**
      * Stakes {stakingDetails.lpTokenAddress} LP token in the Beefy protocol
      * @dev This function uses the redstone-evm-connector
      * @param stakingDetails IBeefyFinance.BeefyStakingDetails staking details
    **/
    function _stakeLpBeefy(IBeefyFinance.BeefyStakingDetails memory stakingDetails) private {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        // _ACTIVE = 2
        require(tokenManager.tokenToStatus(stakingDetails.lpTokenAddress) == 2, "LP token not supported");
        require(tokenManager.tokenToStatus(stakingDetails.vaultAddress) == 2, "Vault token not supported");

        stakingDetails.amount = Math.min(stakingDetails.amount, IERC20(stakingDetails.lpTokenAddress).balanceOf(address(this)));
        require(stakingDetails.amount > 0, "Cannot stake 0 tokens");

        stakingDetails.lpTokenAddress.safeApprove(stakingDetails.vaultAddress, 0);
        stakingDetails.lpTokenAddress.safeApprove(stakingDetails.vaultAddress, stakingDetails.amount);

        IBeefyFinance vaultContract = IBeefyFinance(stakingDetails.vaultAddress);
        uint256 initialVaultToken = vaultContract.balanceOf(address(this));

        vaultContract.deposit(stakingDetails.amount);

        _increaseExposure(tokenManager, stakingDetails.vaultAddress, vaultContract.balanceOf(address(this)) - initialVaultToken);
        _decreaseExposure(tokenManager, stakingDetails.lpTokenAddress, stakingDetails.amount);

        emit Staked(msg.sender, stakingDetails.lpTokenSymbol, stakingDetails.vaultAddress, stakingDetails.amount, block.timestamp);
    }

    /**
              * Unstakes {stakingDetails.lpTokenAddress} LP token in the Beefy protocol
              * @dev This function uses the redstone-evm-connector
              * @param stakingDetails IBeefyFinance.BeefyStakingDetails staking details
    **/
    function _unstakeLpBeefy(IBeefyFinance.BeefyStakingDetails memory stakingDetails) private {
        IBeefyFinance vaultContract = IBeefyFinance(stakingDetails.vaultAddress);
        uint256 initialStakedBalance = vaultContract.balanceOf(address(this));
        stakingDetails.amount = Math.min(initialStakedBalance, stakingDetails.amount);

        require(stakingDetails.amount > 0, "Cannot unstake 0 tokens");

        uint256 initialLpBalance = IERC20(stakingDetails.lpTokenAddress).balanceOf(address(this));
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        vaultContract.withdraw(stakingDetails.amount);

        _decreaseExposure(tokenManager, stakingDetails.vaultAddress, stakingDetails.amount);
        _increaseExposure(tokenManager, stakingDetails.lpTokenAddress, IERC20(stakingDetails.lpTokenAddress).balanceOf(address(this)) - initialLpBalance);

        emit Unstaked(msg.sender, stakingDetails.lpTokenSymbol, stakingDetails.vaultAddress, stakingDetails.amount, block.timestamp);
    }


    /* ========== RECEIVE AVAX FUNCTION ========== */
    receive() external payable {}

    /**
        * @dev emitted when user stakes an asset
        * @param user the address executing staking
        * @param asset the asset that was staked
        * @param vault address of the vault token
        * @param amount of the asset that was staked
        * @param timestamp of staking
    **/
    event Staked(address indexed user, bytes32 indexed asset, address indexed vault, uint256 amount, uint256 timestamp);

    /**
        * @dev emitted when user unstakes an asset
        * @param user the address executing unstaking
        * @param asset the asset that was unstaked
        * @param vault address of the vault token
        * @param amount of the asset that was unstaked
        * @param timestamp of unstaking
    **/
    event Unstaked(address indexed user, bytes32 indexed asset, address indexed vault, uint256 amount, uint256 timestamp);
}