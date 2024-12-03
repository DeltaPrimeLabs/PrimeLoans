// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 19d9982858f4feeff1ca98cbf31b07304a79ac7f;
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../../ReentrancyGuardKeccak.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "../../OnlyOwnerOrInsolvent.sol";
import "../../interfaces/facets/IBeefyFinance.sol";

import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";

//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";

contract BeefyFinanceArbitrumFacet is ReentrancyGuardKeccak, OnlyOwnerOrInsolvent {
    using TransferHelper for address payable;
    using TransferHelper for address;

    // Vaults
    address private constant MOO_GMX = 0x5B904f19fb9ccf493b623e5c8cE91603665788b0;

    // LPs
    address private constant GMX = 0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a;

    // ----- STAKE -----

    /**
      * Stakes GMX in the Beefy protocol
      * @dev This function uses the redstone-evm-connector
      * @param amount amount of GMX to be staked
    **/
    function stakeGmxBeefy(uint256 amount) public onlyOwnerOrInsolvent nonReentrant remainsSolvent {
        _stakeLpBeefy(IBeefyFinance.BeefyStakingDetails({
            lpTokenAddress: GMX,
            vaultAddress: MOO_GMX,
            lpTokenSymbol: "GMX",
            vaultTokenSymbol: "MOO_GMX",
            amount: amount
        }));
    }

    // ----- UNSTAKE -----

    /**
      * Untakes GMX from the Beefy protocol
      * @dev This function uses the redstone-evm-connector
      * @param amount amount of GMX to be unstaked
    **/
    function unstakeGmxBeefy(uint256 amount) public onlyOwnerOrInsolvent nonReentrant {
        _unstakeLpBeefy(IBeefyFinance.BeefyStakingDetails({
            lpTokenAddress: GMX,
            vaultAddress: MOO_GMX,
            lpTokenSymbol: "GMX",
            vaultTokenSymbol: "MOO_GMX",
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