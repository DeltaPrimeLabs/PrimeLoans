// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../ReentrancyGuardKeccak.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "../lib/SolvencyMethods.sol";
import "../Pool.sol";
import "../interfaces/ITokenManager.sol";

//This path is updated during deployment
import "../lib/local/DeploymentConstants.sol";
import "../interfaces/facets/ISmartLoanLiquidationFacet.sol";

import "./avalanche/SolvencyFacetProdAvalanche.sol";
import "../SmartLoanDiamondBeacon.sol";
import "hardhat/console.sol";

contract SmartLoanLiquidationFacetDebug is ReentrancyGuardKeccak, SolvencyMethods {
    //IMPORTANT: KEEP IT IDENTICAL ACROSS FACETS TO BE PROPERLY UPDATED BY DEPLOYMENT SCRIPTS
    uint256 private constant _MAX_HEALTH_AFTER_LIQUIDATION = 1.042e18;

    //IMPORTANT: KEEP IT IDENTICAL ACROSS FACETS TO BE PROPERLY UPDATED BY DEPLOYMENT SCRIPTS
    uint256 private constant _MAX_LIQUIDATION_BONUS = 200;

    using TransferHelper for address payable;
    using TransferHelper for address;

    /** @param assetsToRepay names of tokens to be repaid to pools
    /** @param amountsToRepay amounts of tokens to be repaid to pools
      * @param liquidationBonus per mille bonus for liquidator. Must be smaller or equal to getMaxLiquidationBonus(). Defined for
      * liquidating loans where debt ~ total value
      * @param allowUnprofitableLiquidation allows performing liquidation of bankrupt loans (total value smaller than debt)
    **/

    struct LiquidationConfig {
        bytes32[] assetsToRepay;
        uint256[] amountsToRepay;
        uint256 liquidationBonusPercent;
        bool allowUnprofitableLiquidation;
    }

    /* ========== VIEW FUNCTIONS ========== */

    /**
      * Returns maximum acceptable health ratio after liquidation
      **/
    function getMaxHealthAfterLiquidation() public pure returns (uint256) {
        return _MAX_HEALTH_AFTER_LIQUIDATION;
    }

    /**
      * Returns maximum acceptable liquidation bonus (bonus is provided by a liquidator)
      **/
    function getMaxLiquidationBonus() public pure returns (uint256) {
        return _MAX_LIQUIDATION_BONUS;
    }

    /* ========== PUBLIC AND EXTERNAL MUTATIVE FUNCTIONS ========== */

    function whitelistLiquidators(address[] memory _liquidators) external onlyOwner {
        DiamondStorageLib.LiquidationStorage storage ls = DiamondStorageLib.liquidationStorage();

        for(uint i; i<_liquidators.length; i++){
            ls.canLiquidate[_liquidators[i]] = true;
            emit LiquidatorWhitelisted(_liquidators[i], msg.sender, block.timestamp);
        }
    }

    function delistLiquidators(address[] memory _liquidators) external onlyOwner {
        DiamondStorageLib.LiquidationStorage storage ls = DiamondStorageLib.liquidationStorage();
        for(uint i; i<_liquidators.length; i++){
            ls.canLiquidate[_liquidators[i]] = false;
            emit LiquidatorDelisted(_liquidators[i], msg.sender, block.timestamp);
        }
    }

    function isLiquidatorWhitelisted(address _liquidator) public view returns(bool){
        DiamondStorageLib.LiquidationStorage storage ls = DiamondStorageLib.liquidationStorage();
        return ls.canLiquidate[_liquidator];
    }

    /**
    * This function can be accessed by any user when Prime Account is insolvent or bankrupt and repay part of the loan
    * with his approved tokens.
    * BE CAREFUL: in contrast to liquidateLoan() method, this one doesn't necessarily return tokens to liquidator, nor give him
    * a bonus. It's purpose is to bring the loan to a solvent position even if it's unprofitable for liquidator.
    * @dev This function uses the redstone-evm-connector
    * @param assetsToRepay bytes32[] names of tokens provided by liquidator for repayment
    * @param amountsToRepay utin256[] amounts of tokens provided by liquidator for repayment
    * @param _liquidationBonusPercent per mille bonus for liquidator. Must be lower than or equal to getMaxliquidationBonus()
    **/
    function unsafeLiquidateLoan(bytes32[] memory assetsToRepay, uint256[] memory amountsToRepay, uint256 _liquidationBonusPercent) external payable onlyWhitelistedLiquidators nonReentrant {
        liquidate(
            LiquidationConfig({
                assetsToRepay : assetsToRepay,
                amountsToRepay : amountsToRepay,
                liquidationBonusPercent : _liquidationBonusPercent,
                allowUnprofitableLiquidation : true
            })
        );
    }

    /**
    * This function can be accessed by any user when Prime Account is insolvent and liquidate part of the loan
    * with his approved tokens.
    * A liquidator has to approve adequate amount of tokens to repay debts to liquidity pools if
    * there is not enough of them in a SmartLoan. For that he will receive the corresponding amount from SmartLoan
    * with the same USD value + bonus.
    * @dev This function uses the redstone-evm-connector
    * @param assetsToRepay bytes32[] names of tokens provided by liquidator for repayment
    * @param amountsToRepay utin256[] amounts of tokens provided by liquidator for repayment
    * @param _liquidationBonusPercent per mille bonus for liquidator. Must be lower than or equal to  getMaxLiquidationBonus()
    **/
    function liquidateLoan(bytes32[] memory assetsToRepay, uint256[] memory amountsToRepay, uint256 _liquidationBonusPercent) external payable onlyWhitelistedLiquidators nonReentrant {
        liquidate(
            LiquidationConfig({
                assetsToRepay : assetsToRepay,
                amountsToRepay : amountsToRepay,
                liquidationBonusPercent : _liquidationBonusPercent,
                allowUnprofitableLiquidation : false
            })
        );
    }

    /**
    * This function can be accessed when Prime Account is insolvent and perform a partial liquidation of the loan
    * (selling assets, closing positions and repaying debts) to bring the account back to a solvent state. At the end
    * of liquidation resulting solvency of account is checked to make sure that the account is between maximum and minimum
    * solvency.
    * To diminish the potential effect of manipulation of liquidity pools by a liquidator, there are no swaps performed
    * during liquidation.
    * @dev This function uses the redstone-evm-connector
    * @param config configuration for liquidation
    **/
    function liquidate(LiquidationConfig memory config) internal {
        console.log('Welcome to the liquidation sir');
        SolvencyFacetProdAvalanche.CachedPrices memory cachedPrices = _getAllPricesForLiquidation(config.assetsToRepay);
        
        uint256 initialTotal = _getTotalValueWithPrices(cachedPrices.ownedAssetsPrices, cachedPrices.stakedPositionsPrices); 
        uint256 initialDebt = _getDebtWithPrices(cachedPrices.debtAssetsPrices); 

        require(config.liquidationBonusPercent <= getMaxLiquidationBonus(), "Defined liquidation bonus higher than max. value");
        require(!_isSolventWithPrices(cachedPrices), "Cannot sellout a solvent account");

        //healing means bringing a bankrupt loan to a state when debt is smaller than total value again
        bool healingLoan = initialDebt > initialTotal;
        if(healingLoan){
            console.log('HEALING LOAN');
        } else{
            console.log('NOT A HEALING LOAN');
        }
        console.log(initialTotal);
        console.log(initialDebt);
        require(!healingLoan || config.allowUnprofitableLiquidation, "Trying to liquidate bankrupt loan");


        uint256 suppliedInUSD;
        uint256 repaidInUSD;
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        console.log('1');

        for (uint256 i = 0; i < config.assetsToRepay.length; i++) {
            IERC20Metadata token = IERC20Metadata(tokenManager.getAssetAddress(config.assetsToRepay[i], true));

            uint256 balance = token.balanceOf(address(this));
            uint256 supplyAmount;

            if (balance < config.amountsToRepay[i]) {
                supplyAmount = config.amountsToRepay[i] - balance;
            }

            if (supplyAmount > 0) {
                address(token).safeTransferFrom(msg.sender, address(this), supplyAmount);
                // supplyAmount is denominated in token.decimals(). Price is denominated in 1e8. To achieve 1e18 decimals we need to multiply by 1e10.
                suppliedInUSD += supplyAmount * cachedPrices.assetsToRepayPrices[i].price * 10 ** 10 / 10 ** token.decimals();
            }

            Pool pool = Pool(tokenManager.getPoolAddress(config.assetsToRepay[i]));

            uint256 repayAmount = Math.min(pool.getBorrowed(address(this)), config.amountsToRepay[i]);

            address(token).safeApprove(address(pool), 0);
            address(token).safeApprove(address(pool), repayAmount);

            // repayAmount is denominated in token.decimals(). Price is denominated in 1e8. To achieve 1e18 decimals we need to multiply by 1e10.
            repaidInUSD += repayAmount * cachedPrices.assetsToRepayPrices[i].price * 10 ** 10 / 10 ** token.decimals();

            pool.repay(repayAmount);

            if (token.balanceOf(address(this)) == 0) {
                DiamondStorageLib.removeOwnedAsset(config.assetsToRepay[i]);
            }

            emit LiquidationRepay(msg.sender, config.assetsToRepay[i], repayAmount, block.timestamp);
        }

        console.log('2');

        bytes32[] memory assetsOwned = DeploymentConstants.getAllOwnedAssets();
        uint256 bonusInUSD;

        //after healing bankrupt loan (debt > total value), no tokens are returned to liquidator

        bonusInUSD = repaidInUSD * config.liquidationBonusPercent / DeploymentConstants.getPercentagePrecision();

        //meaning returning all tokens
        uint256 partToReturn = 10 ** 18; // 1
        uint256 assetsValue = _getTotalValueWithPrices(cachedPrices.ownedAssetsPrices, cachedPrices.stakedPositionsPrices);

        if (!healingLoan && assetsValue >= suppliedInUSD + bonusInUSD) {
            //in that scenario we calculate how big part of token to return
            partToReturn = (suppliedInUSD + bonusInUSD) * 10 ** 18 / assetsValue;
        }

        // Native token transfer
        if (address(this).balance > 0) {
            payable(msg.sender).safeTransferETH(address(this).balance * partToReturn / 10 ** 18);
        }

        console.log('3');

        for (uint256 i; i < assetsOwned.length; i++) {
            IERC20Metadata token = getERC20TokenInstance(assetsOwned[i], true);
            uint256 balance = token.balanceOf(address(this));

            address(token).safeTransfer(msg.sender, balance * partToReturn / 10 ** 18);
            emit LiquidationTransfer(msg.sender, assetsOwned[i], balance * partToReturn / 10 ** 18, block.timestamp);
        }

        console.log('4');

        uint256 health = _getHealthRatioWithPrices(cachedPrices);

        console.log('5');

        if (healingLoan) {
            require(_getDebtWithPrices(cachedPrices.debtAssetsPrices) == 0, "Healing a loan must end up with 0 debt");
            require(_getTotalValueWithPrices(cachedPrices.ownedAssetsPrices, cachedPrices.stakedPositionsPrices) == 0, "Healing a loan must end up with 0 total value");
        } else {
            console.log('Health: %s', health);
            console.log('Total value: %s', _getTotalValue());
            console.log('Debt: %s', _getDebt());
            require(health <= getMaxHealthAfterLiquidation(), "This operation would result in a loan with health ratio higher than Maxium Health Ratio which would put loan's owner in a risk of an unnecessarily high loss");
        }

        console.log('6');

        console.log('TV: %s', _getTotalValueWithPrices(cachedPrices.ownedAssetsPrices, cachedPrices.stakedPositionsPrices));
        console.log('Debt: %s', _getDebtWithPrices(cachedPrices.debtAssetsPrices));

        console.log('Health: %s', health);

        require(health >= 1e18, "This operation would not result in bringing the loan back to a solvent state");

        console.log('FINISHED');

        //TODO: include final debt and tv
        emit Liquidated(msg.sender, healingLoan, initialTotal, initialDebt, repaidInUSD, bonusInUSD, health, block.timestamp);
    }

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    modifier onlyWhitelistedLiquidators() {
        // External call in order to execute this method in the SmartLoanDiamondBeacon contract storage
        require(ISmartLoanLiquidationFacet(DeploymentConstants.getDiamondAddress()).isLiquidatorWhitelisted(msg.sender), "Only whitelisted liquidators can execute this method");
        _;
    }

    /**
     * @dev emitted after a successful liquidation operation
     * @param liquidator the address that initiated the liquidation operation
     * @param healing was the liquidation covering the bad debt (unprofitable liquidation)
     * @param initialTotal total value of assets before the liquidation
     * @param initialDebt sum of all debts before the liquidation
     * @param repayAmount requested amount (USD) of liquidation
     * @param bonusInUSD an amount of bonus (USD) received by the liquidator
     * @param health a new health ratio after the liquidation operation
     * @param timestamp a time of the liquidation
     **/
    event Liquidated(address indexed liquidator, bool indexed healing, uint256 initialTotal, uint256 initialDebt, uint256 repayAmount, uint256 bonusInUSD, uint256 health, uint256 timestamp);

    /**
     * @dev emitted when funds are repaid to the pool during a liquidation
     * @param liquidator the address initiating repayment
     * @param asset asset repaid by a liquidator
     * @param amount of repaid funds
     * @param timestamp of the repayment
     **/
    event LiquidationRepay(address indexed liquidator, bytes32 indexed asset, uint256 amount, uint256 timestamp);

    /**
     * @dev emitted when funds are sent to liquidator during liquidation
     * @param liquidator the address initiating repayment
     * @param asset token sent to a liquidator
     * @param amount of sent funds
     * @param timestamp of the transfer
     **/
    event LiquidationTransfer(address indexed liquidator, bytes32 indexed asset, uint256 amount, uint256 timestamp);

    /**
     * @dev emitted when a new liquidator gets whitelisted
     * @param liquidator the address being whitelisted
     * @param performer the address initiating whitelisting
     * @param timestamp of the whitelisting
     **/
    event LiquidatorWhitelisted(address indexed liquidator, address performer, uint256 timestamp);

    /**
     * @dev emitted when a liquidator gets delisted
     * @param liquidator the address being delisted
     * @param performer the address initiating delisting
     * @param timestamp of the delisting
     **/
    event LiquidatorDelisted(address indexed liquidator, address performer, uint256 timestamp);
}

