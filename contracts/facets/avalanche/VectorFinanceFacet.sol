// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: e0b7d4c696bf3135b985e7f92053898942be20bc;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "../../ReentrancyGuardKeccak.sol";
import "../../interfaces/IVectorFinanceStaking.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";
import "../../interfaces/IStakingPositions.sol";
import "../../OnlyOwnerOrInsolvent.sol";
import "../../interfaces/IVectorFinanceMainStaking.sol";
//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";

contract VectorFinanceFacet is ReentrancyGuardKeccak, OnlyOwnerOrInsolvent {
    using TransferHelper for address;

    // CONSTANTS

    address private constant VectorMainStaking = 0x8B3d9F0017FA369cD8C164D0Cc078bf4cA588aE5;

    // PUBLIC FUNCTIONS

    function vectorStakeUSDC1Auto(uint256 amount) public {
        IStakingPositions.StakedPosition memory position = IStakingPositions.StakedPosition({
            asset : 0x06f01502327De1c37076Bea4689a7e44279155e9,
            symbol : "USDC",
            identifier : "VF_USDC_MAIN_AUTO",
            balanceSelector : this.vectorUSDC1BalanceAuto.selector,
            unstakeSelector : this.vectorUnstakeUSDC1Auto.selector
        });
        stakeToken(amount, position);
    }

    function vectorUnstakeUSDC1Auto(uint256 amount, uint256 minAmount) public {
        IStakingPositions.StakedPosition memory position = IStakingPositions.StakedPosition({
            asset : 0x06f01502327De1c37076Bea4689a7e44279155e9,
            symbol : "USDC",
            identifier : "VF_USDC_MAIN_AUTO",
            balanceSelector : this.vectorUSDC1BalanceAuto.selector,
            unstakeSelector : this.vectorUnstakeUSDC1Auto.selector
        });
        unstakeToken(amount, minAmount, position);
    }

    function vectorUSDC1BalanceAuto() public view returns (uint256 _stakedBalance) {
        IVectorFinanceCompounder compounder = getAssetCompounder(0x06f01502327De1c37076Bea4689a7e44279155e9);
        uint256 shares = compounder.balanceOf(address(this));
        _stakedBalance = compounder.getDepositTokensForShares(shares);
    }

    function vectorStakeUSDT1Auto(uint256 amount) public {
        IStakingPositions.StakedPosition memory position = IStakingPositions.StakedPosition({
            asset : 0x836648A8cE166Ba7CaFb27F0E6AD21d5C91b7774,
            symbol : "USDT",
            identifier : "VF_USDT_MAIN_AUTO",
            balanceSelector : this.vectorUSDT1BalanceAuto.selector,
            unstakeSelector : this.vectorUnstakeUSDT1Auto.selector
        });
        stakeToken(amount, position);
    }

    function vectorUnstakeUSDT1Auto(uint256 amount, uint256 minAmount) public {
        IStakingPositions.StakedPosition memory position = IStakingPositions.StakedPosition({
            asset : 0x836648A8cE166Ba7CaFb27F0E6AD21d5C91b7774,
            symbol : "USDT",
            identifier : "VF_USDT_MAIN_AUTO",
            balanceSelector : this.vectorUSDT1BalanceAuto.selector,
            unstakeSelector : this.vectorUnstakeUSDT1Auto.selector
        });
        unstakeToken(amount, minAmount, position);
    }

    function vectorUSDT1BalanceAuto() public view returns (uint256 _stakedBalance) {
        IVectorFinanceCompounder compounder = getAssetCompounder(0x836648A8cE166Ba7CaFb27F0E6AD21d5C91b7774);
        uint256 shares = compounder.balanceOf(address(this));
        _stakedBalance = compounder.getDepositTokensForShares(shares);
    }

    function vectorStakeWAVAX1Auto(uint256 amount) public {
        IStakingPositions.StakedPosition memory position = IStakingPositions.StakedPosition({
            asset : 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7,
            symbol : "AVAX",
            identifier : "VF_AVAX_SAVAX_AUTO",
            balanceSelector : this.vectorWAVAX1BalanceAuto.selector,
            unstakeSelector : this.vectorUnstakeWAVAX1Auto.selector
        });
        stakeToken(amount, position);
    }

    function vectorUnstakeWAVAX1Auto(uint256 amount, uint256 minAmount) public {
        IStakingPositions.StakedPosition memory position = IStakingPositions.StakedPosition({
            asset : 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7,
            symbol : "AVAX",
            identifier : "VF_AVAX_SAVAX_AUTO",
            balanceSelector : this.vectorWAVAX1BalanceAuto.selector,
            unstakeSelector : this.vectorUnstakeWAVAX1Auto.selector
        });
        unstakeToken(amount, minAmount, position);
    }

    function vectorWAVAX1BalanceAuto() public view returns (uint256 _stakedBalance) {
        IVectorFinanceCompounder compounder = getAssetCompounder(0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7);
        uint256 shares = compounder.balanceOf(address(this));
        _stakedBalance = compounder.getDepositTokensForShares(shares);
    }

    function vectorStakeSAVAX1Auto(uint256 amount) public {
        IStakingPositions.StakedPosition memory position = IStakingPositions.StakedPosition({
            asset : 0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE,
            symbol : "sAVAX",
            identifier : "VF_SAVAX_MAIN_AUTO",
            balanceSelector : this.vectorSAVAX1BalanceAuto.selector,
            unstakeSelector : this.vectorUnstakeSAVAX1Auto.selector
        });
        stakeToken(amount, position);
    }

    function vectorUnstakeSAVAX1Auto(uint256 amount, uint256 minAmount) public {
        IStakingPositions.StakedPosition memory position = IStakingPositions.StakedPosition({
            asset : 0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE,
            symbol : "sAVAX",
            identifier : "VF_SAVAX_MAIN_AUTO",
            balanceSelector : this.vectorSAVAX1BalanceAuto.selector,
            unstakeSelector : this.vectorUnstakeSAVAX1Auto.selector
        });
        unstakeToken(amount, minAmount, position);
    }

    function vectorSAVAX1BalanceAuto() public view returns (uint256 _stakedBalance) {
        IVectorFinanceCompounder compounder = getAssetCompounder(0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE);
        uint256 shares = compounder.balanceOf(address(this));
        _stakedBalance = compounder.getDepositTokensForShares(shares);
    }

    function vectorMigrateAvax() public {
        IStakingPositions.StakedPosition memory position = IStakingPositions.StakedPosition({
            asset : 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7,
            symbol : "AVAX",
            identifier : "VF_AVAX_SAVAX_AUTO",
            balanceSelector : this.vectorWAVAX1BalanceAuto.selector,
            unstakeSelector : this.vectorUnstakeWAVAX1Auto.selector
        });
        require(migrateStake(position, "VF_AVAX_SAVAX") > 0, "Cannot migrate 0 tokens");
    }

    function vectorMigrateSAvax() public {
        IStakingPositions.StakedPosition memory position = IStakingPositions.StakedPosition({
            asset : 0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE,
            symbol : "sAVAX",
            identifier : "VF_SAVAX_MAIN_AUTO",
            balanceSelector : this.vectorSAVAX1BalanceAuto.selector,
            unstakeSelector : this.vectorUnstakeSAVAX1Auto.selector
        });
        require(migrateStake(position, "VF_SAVAX_MAIN") > 0, "Cannot migrate 0 tokens");
    }

    // INTERNAL FUNCTIONS
    /**
    * @dev This function uses the redstone-evm-connector
    **/
    function stakeToken(uint256 amount, IStakingPositions.StakedPosition memory position) internal
    onlyOwner nonReentrant recalculateAssetsExposure remainsSolvent {
        IVectorFinanceCompounder compounder = getAssetCompounder(position.asset);
        IERC20Metadata stakedToken = getERC20TokenInstance(position.symbol, false);
        uint256 initialReceiptTokenBalance = compounder.balanceOf(address(this));

        amount = Math.min(stakedToken.balanceOf(address(this)), amount);
        require(amount > 0, "Cannot stake 0 tokens");

        address(stakedToken).safeApprove(address(compounder), 0);
        address(stakedToken).safeApprove(address(compounder), amount);

        compounder.deposit(amount);

        DiamondStorageLib.addStakedPosition(position);

        if (stakedToken.balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(position.symbol);
        }

        emit Staked(
            msg.sender,
            position.symbol,
            address(compounder),
            amount,
            compounder.balanceOf(address(this)) - initialReceiptTokenBalance,
            block.timestamp
        );
    }

    /**
    * Unstakes token from Vector Finance
    * IMPORTANT: This method can be used by anyone when a loan is insolvent. This operation can be costly, that is why
    * if needed it has to be performed in a separate transaction to liquidation
    * @dev This function uses the redstone-evm-connector
    **/
    function unstakeToken(uint256 amount, uint256 minAmount, IStakingPositions.StakedPosition memory position) internal
    onlyOwnerOrInsolvent recalculateAssetsExposure nonReentrant returns (uint256 unstaked) {
        IVectorFinanceCompounder compounder = getAssetCompounder(position.asset);
        IERC20Metadata unstakedToken = getERC20TokenInstance(position.symbol, false);
        uint256 initialReceiptTokenBalance = compounder.balanceOf(address(this));

        require(amount > 0, "Cannot unstake 0 tokens");

        amount = Math.min(compounder.depositTracking(address(this)), amount);

        uint256 balance = unstakedToken.balanceOf(address(this));

        compounder.withdraw(amount, minAmount);

        uint256 newBalance = unstakedToken.balanceOf(address(this));

        if (compounder.depositTracking(address(this)) == 0) {
            DiamondStorageLib.removeStakedPosition(position.identifier);
        }
        DiamondStorageLib.addOwnedAsset(position.symbol, address(unstakedToken));

        emit Unstaked(
            msg.sender,
            position.symbol,
            address(compounder),
            newBalance - balance,
            initialReceiptTokenBalance - compounder.balanceOf(address(this)),
            block.timestamp
        );

        return newBalance - balance;
    }

    /**
     * @notice Withdraws all previous balance from the pool helper, and deposits into the compounder.
     */
    function migrateStake(IStakingPositions.StakedPosition memory position, bytes32 oldIdentifier) internal
    onlyOwner nonReentrant recalculateAssetsExposure remainsSolvent returns (uint256 migrated) {
        IVectorFinanceStaking poolHelper = getAssetPoolHelper(position.asset);
        IVectorFinanceCompounder compounder = getAssetCompounder(position.asset);

        migrated = poolHelper.balance(address(this));
        if (migrated > 0) {
            compounder.migrateAllUserDepositsFromManual();

            DiamondStorageLib.removeStakedPosition(oldIdentifier);

            DiamondStorageLib.addStakedPosition(position);

            emit Migrated(
                msg.sender,
                position.symbol,
                address(compounder),
                migrated,
                block.timestamp
            );
        }
    }

    function getAssetCompounder(address asset) internal pure returns (IVectorFinanceCompounder compounder){
        if(asset == 0x06f01502327De1c37076Bea4689a7e44279155e9){ // USDC
            return IVectorFinanceCompounder(0x1DBd41f9Efde5b387E820e9B43BDa00c4154a82A);
        } else if (asset == 0x836648A8cE166Ba7CaFb27F0E6AD21d5C91b7774){ // USDT
            return IVectorFinanceCompounder(0x951CbF0DDA285FD8011F2cB7Ed435fA095f803a0);
        } else if (asset == 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7){ // WAVAX
            return IVectorFinanceCompounder(0xe2406Af0E26769D3231682C80D4bB7bBdF329A88);
        } else if (asset == 0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE){ // SAVAX
            return IVectorFinanceCompounder(0x1636bE3843E86826cB6aDC141B5d40d782763B85);
        } else {
            revert("Asset not supported");
        }
    }

    function getAssetPoolHelper(address asset) internal view returns (IVectorFinanceStaking){
        IVectorFinanceMainStaking mainStaking = IVectorFinanceMainStaking(VectorMainStaking);
        return IVectorFinanceStaking(mainStaking.getPoolInfo(asset).helper);
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
        * @param asset the asset that was staked
        * @param vault address of receipt token
        * @param depositTokenAmount how much of deposit token was staked
        * @param receiptTokenAmount how much of receipt token was received
        * @param timestamp of staking
    **/
    event Staked(address indexed user, bytes32 indexed asset, address indexed vault, uint256 depositTokenAmount, uint256 receiptTokenAmount, uint256 timestamp);

    /**
        * @dev emitted when user unstakes an asset
        * @param user the address executing unstaking
        * @param asset the asset that was unstaked
        * @param vault address of receipt token
        * @param depositTokenAmount how much deposit token was received
        * @param receiptTokenAmount how much receipt token was unstaked
        * @param timestamp of unstaking
    **/
    event Unstaked(address indexed user, bytes32 indexed asset, address indexed vault, uint256 depositTokenAmount, uint256 receiptTokenAmount, uint256 timestamp);

    /**
        * @dev emitted when user stakes an asset
        * @param user the address executing staking
        * @param asset the asset that was staked
        * @param vault address of receipt token
        * @param migratedAmount how much of receipt token was migrated
        * @param timestamp of staking
    **/
    event Migrated(address indexed user, bytes32 indexed asset, address indexed vault, uint256 migratedAmount, uint256 timestamp);
}
