// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ecd675d46c3f696de7562f6be071a442d97f37d9;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@redstone-finance/evm-connector/contracts/core/RedstoneConsumerNumericBase.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "../interfaces/ITokenManager.sol";
import "../Pool.sol";
import "../DiamondHelper.sol";
import "../interfaces/IStakingPositions.sol";
import "../interfaces/facets/avalanche/ITraderJoeV2Facet.sol";
import "../interfaces/uniswap-v3-periphery/INonfungiblePositionManager.sol";
import "../lib/uniswap-v3/UniswapV3IntegrationHelper.sol";
import "../lib/uniswap-v3/LiquidityAmounts.sol";
import {PriceHelper} from "../lib/joe-v2/PriceHelper.sol";
import {Uint256x256Math} from "../lib/joe-v2/math/Uint256x256Math.sol";
import {TickMath} from "../lib/uniswap-v3/TickMath.sol";
import {FullMath} from "../lib/uniswap-v3/FullMath.sol";

//This path is updated during deployment
import "../lib/local/DeploymentConstants.sol";
import "../interfaces/facets/avalanche/IUniswapV3Facet.sol";

abstract contract SolvencyFacetProd is RedstoneConsumerNumericBase, DiamondHelper {
    using PriceHelper for uint256;
    using Uint256x256Math for uint256;

    struct AssetPrice {
        bytes32 asset;
        uint256 price;
    }

    // Struct used in the liquidation process to obtain necessary prices only once
    struct CachedPrices {
        AssetPrice[] ownedAssetsPrices;
        AssetPrice[] debtAssetsPrices;
        AssetPrice[] stakedPositionsPrices;
        AssetPrice[] assetsToRepayPrices;
    }

    struct PriceInfo {
        address tokenX;
        address tokenY;
        uint256 priceX;
        uint256 priceY;
    }

    /**
      * Checks if the loan is solvent.
      * It means that the Health Ratio is greater than 1e18.
      * @dev This function uses the redstone-evm-connector
    **/
    function isSolvent() public view returns (bool) {
        if(DiamondStorageLib.isAccountFrozen()){
            revert AccountFrozen();
        }
        return getHealthRatio() >= 1e18;
    }

    function isSolventPayable() external payable returns (bool) {
        return isSolvent();
    }

    /**
      * Checks if the loan is solvent.
      * It means that the Health Ratio is greater than 1e18.
      * Uses provided AssetPrice struct arrays instead of extracting the pricing data from the calldata again.
      * @param cachedPrices Struct containing arrays of Asset/Price structs used to calculate value of owned assets, debt and staked positions
    **/
    function isSolventWithPrices(CachedPrices memory cachedPrices) public view returns (bool) {
        return getHealthRatioWithPrices(cachedPrices) >= 1e18;
    }

    /**
      * Returns an array of Asset/Price structs of staked positions.
      * @dev This function uses the redstone-evm-connector
    **/
    function getStakedPositionsPrices() public view returns(AssetPrice[] memory result) {
        IStakingPositions.StakedPosition[] storage positions = DiamondStorageLib.stakedPositions();

        bytes32[] memory symbols = new bytes32[](positions.length);
        for(uint256 i=0; i<positions.length; i++) {
            symbols[i] = positions[i].symbol;
        }

        uint256[] memory stakedPositionsPrices = getOracleNumericValuesWithDuplicatesFromTxMsg(symbols);
        result = new AssetPrice[](stakedPositionsPrices.length);

        for(uint i; i<stakedPositionsPrices.length; i++){
            result[i] = AssetPrice({
                asset: symbols[i],
                price: stakedPositionsPrices[i]
            });
        }
    }

    /**
      * Returns an array of bytes32[] symbols of debt (borrowable) assets.
    **/
    function getDebtAssets() public view returns(bytes32[] memory result) {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        result = tokenManager.getAllPoolAssets();
    }

    /**
      * Returns an array of Asset/Price structs of debt (borrowable) assets.
      * @dev This function uses the redstone-evm-connector
    **/
    function getDebtAssetsPrices() public view returns(AssetPrice[] memory result) {
        bytes32[] memory debtAssets = getDebtAssets();

        uint256[] memory debtAssetsPrices = getOracleNumericValuesFromTxMsg(debtAssets);
        result = new AssetPrice[](debtAssetsPrices.length);

        for(uint i; i<debtAssetsPrices.length; i++){
            result[i] = AssetPrice({
                asset: debtAssets[i],
                price: debtAssetsPrices[i]
            });
        }
    }

    /**
      * Returns an array of Asset/Price structs of enriched (always containing AVAX at index 0) owned assets.
      * @dev This function uses the redstone-evm-connector
    **/
    function getOwnedAssetsWithNativePrices() public view returns(AssetPrice[] memory result) {
        bytes32[] memory assetsEnriched = getOwnedAssetsWithNative();
        uint256[] memory prices = getOracleNumericValuesFromTxMsg(assetsEnriched);

        result = new AssetPrice[](assetsEnriched.length);

        for(uint i; i<assetsEnriched.length; i++){
            result[i] = AssetPrice({
                asset: assetsEnriched[i],
                price: prices[i]
            });
        }
    }

    /**
      * Returns an array of bytes32[] symbols of staked positions.
    **/
    function getStakedAssets() internal view returns (bytes32[] memory result) {
        IStakingPositions.StakedPosition[] storage positions = DiamondStorageLib.stakedPositions();
        result = new bytes32[](positions.length);
        for(uint i; i<positions.length; i++) {
            result[i] = positions[i].symbol;
        }
    }

    function copyToArray(bytes32[] memory target, bytes32[] memory source, uint256 offset, uint256 numberOfItems) pure internal {
        if(numberOfItems > source.length){
            revert ArrayLengthMismatch();
        }
        if(offset + numberOfItems > target.length){
            revert ArrayLengthMismatch();
        }

        for(uint i; i<numberOfItems; i++){
            target[i + offset] = source[i];
        }
    }

    function copyToAssetPriceArray(AssetPrice[] memory target, bytes32[] memory sourceAssets, uint256[] memory sourcePrices, uint256 offset, uint256 numberOfItems) pure internal {
        if(numberOfItems > sourceAssets.length){
            revert ArrayLengthMismatch();
        }
        if(numberOfItems > sourcePrices.length){
            revert ArrayLengthMismatch();
        }
        if(offset + numberOfItems > sourceAssets.length){
            revert ArrayLengthMismatch();
        }
        if(offset + numberOfItems > sourcePrices.length){
            revert ArrayLengthMismatch();
        }

        for(uint i; i<numberOfItems; i++){
            target[i] = AssetPrice({
                asset: sourceAssets[i+offset],
                price: sourcePrices[i+offset]
            });
        }
    }

    /**
      * Returns CachedPrices struct consisting of Asset/Price arrays for ownedAssets, debtAssets, stakedPositions and assetsToRepay.
      * Used during the liquidation process in order to obtain all necessary prices from calldata only once.
      * @dev This function uses the redstone-evm-connector
    **/
    function getAllPricesForLiquidation(bytes32[] memory assetsToRepay) public view returns (CachedPrices memory result) {
        bytes32[] memory ownedAssetsEnriched = getOwnedAssetsWithNative();
        bytes32[] memory debtAssets = getDebtAssets();
        bytes32[] memory stakedAssets = getStakedAssets();

        bytes32[] memory allAssetsSymbols = new bytes32[](ownedAssetsEnriched.length + debtAssets.length + stakedAssets.length + assetsToRepay.length);
        uint256 offset;

        // Populate allAssetsSymbols with owned assets symbols
        copyToArray(allAssetsSymbols, ownedAssetsEnriched, offset, ownedAssetsEnriched.length);
        offset += ownedAssetsEnriched.length;

        // Populate allAssetsSymbols with debt assets symbols
        copyToArray(allAssetsSymbols, debtAssets, offset, debtAssets.length);
        offset += debtAssets.length;

        // Populate allAssetsSymbols with staked assets symbols
        copyToArray(allAssetsSymbols, stakedAssets, offset, stakedAssets.length);
        offset += stakedAssets.length;

        // Populate allAssetsSymbols with assets to repay symbols
        copyToArray(allAssetsSymbols, assetsToRepay, offset, assetsToRepay.length);

        uint256[] memory allAssetsPrices = getOracleNumericValuesWithDuplicatesFromTxMsg(allAssetsSymbols);

        offset = 0;

        // Populate ownedAssetsPrices struct
        AssetPrice[] memory ownedAssetsPrices = new AssetPrice[](ownedAssetsEnriched.length);
        copyToAssetPriceArray(ownedAssetsPrices, allAssetsSymbols, allAssetsPrices, offset, ownedAssetsEnriched.length);
        offset += ownedAssetsEnriched.length;

        // Populate debtAssetsPrices struct
        AssetPrice[] memory debtAssetsPrices = new AssetPrice[](debtAssets.length);
        copyToAssetPriceArray(debtAssetsPrices, allAssetsSymbols, allAssetsPrices, offset, debtAssets.length);
        offset += debtAssetsPrices.length;

        // Populate stakedPositionsPrices struct
        AssetPrice[] memory stakedPositionsPrices = new AssetPrice[](stakedAssets.length);
        copyToAssetPriceArray(stakedPositionsPrices, allAssetsSymbols, allAssetsPrices, offset, stakedAssets.length);
        offset += stakedAssets.length;

        // Populate assetsToRepayPrices struct
        // Stack too deep :F
        AssetPrice[] memory assetsToRepayPrices = new AssetPrice[](assetsToRepay.length);
        for(uint i=0; i<assetsToRepay.length; i++){
            assetsToRepayPrices[i] = AssetPrice({
                asset: allAssetsSymbols[i+offset],
                price: allAssetsPrices[i+offset]
            });
        }

        result = CachedPrices({
            ownedAssetsPrices: ownedAssetsPrices,
            debtAssetsPrices: debtAssetsPrices,
            stakedPositionsPrices: stakedPositionsPrices,
            assetsToRepayPrices: assetsToRepayPrices
        });
    }

    // Check whether there is enough debt-denominated tokens to fully repaid what was previously borrowed
    function canRepayDebtFully() external view returns(bool) {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        bytes32[] memory poolAssets = tokenManager.getAllPoolAssets();

        for(uint i; i< poolAssets.length; i++) {
            Pool pool = Pool(DeploymentConstants.getTokenManager().getPoolAddress(poolAssets[i]));
            IERC20 token = IERC20(pool.tokenAddress());
            if(token.balanceOf(address(this)) < pool.getBorrowed(address(this))) {
                return false;
            }
        }
        return true;
    }

    /**
      * Helper method exposing the redstone-evm-connector getOracleNumericValuesFromTxMsg() method.
      * @dev This function uses the redstone-evm-connector
    **/
    function getPrices(bytes32[] memory symbols) external view returns (uint256[] memory) {
        return getOracleNumericValuesFromTxMsg(symbols);
    }

    /**
      * Helper method exposing the redstone-evm-connector getOracleNumericValueFromTxMsg() method.
      * @dev This function uses the redstone-evm-connector
    **/
    function getPrice(bytes32 symbol) external view returns (uint256) {
        return getOracleNumericValueFromTxMsg(symbol);
    }

    /**
      * Returns TotalWeightedValue of OwnedAssets in USD based on the supplied array of Asset/Price struct, tokenBalance and debtCoverage
    **/
    function _getTWVOwnedAssets(AssetPrice[] memory ownedAssetsPrices) internal virtual view returns (uint256) {
        bytes32 nativeTokenSymbol = DeploymentConstants.getNativeTokenSymbol();
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        uint256 weightedValueOfTokens = ownedAssetsPrices[0].price * address(this).balance * tokenManager.debtCoverage(tokenManager.getAssetAddress(nativeTokenSymbol, true)) / (10 ** 26);

        if (ownedAssetsPrices.length > 0) {

            for (uint256 i = 0; i < ownedAssetsPrices.length; i++) {
                IERC20Metadata token = IERC20Metadata(tokenManager.getAssetAddress(ownedAssetsPrices[i].asset, true));
                weightedValueOfTokens = weightedValueOfTokens + (ownedAssetsPrices[i].price * token.balanceOf(address(this)) * tokenManager.debtCoverage(address(token)) / (10 ** token.decimals() * 1e8));
            }
        }
        return weightedValueOfTokens;
    }

    /**
      * Returns TotalWeightedValue of StakedPositions in USD based on the supplied array of Asset/Price struct, positionBalance and debtCoverage
    **/
    function _getTWVStakedPositions(AssetPrice[] memory stakedPositionsPrices) internal view returns (uint256) {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        IStakingPositions.StakedPosition[] storage positions = DiamondStorageLib.stakedPositions();

        uint256 weightedValueOfStaked;

        for (uint256 i; i < positions.length; i++) {
            if(stakedPositionsPrices[i].asset != positions[i].symbol){
                revert PriceSymbolPositionMismatch();
            }

            (bool success, bytes memory result) = address(this).staticcall(abi.encodeWithSelector(positions[i].balanceSelector));

            if (success) {
                uint256 balance = abi.decode(result, (uint256));

                IERC20Metadata token = IERC20Metadata(DeploymentConstants.getTokenManager().getAssetAddress(stakedPositionsPrices[i].asset, true));

                weightedValueOfStaked += stakedPositionsPrices[i].price * balance * tokenManager.debtCoverageStaked(positions[i].identifier) / (10 ** token.decimals() * 10**8);
            }


        }
        return weightedValueOfStaked;
    }

    function _getThresholdWeightedValueBase(AssetPrice[] memory ownedAssetsPrices, AssetPrice[] memory stakedPositionsPrices) internal view virtual returns (uint256) {
        return _getTWVOwnedAssets(ownedAssetsPrices) + _getTWVStakedPositions(stakedPositionsPrices) + _getTotalTraderJoeV2(true) + _getTotalUniswapV3(true);
    }

    /**
      * Returns the threshold weighted value of assets in USD including all tokens as well as staking and LP positions
      * @dev This function uses the redstone-evm-connector
    **/
    function getThresholdWeightedValue() public view virtual returns (uint256) {
        AssetPrice[] memory ownedAssetsPrices = getOwnedAssetsWithNativePrices();
        AssetPrice[] memory stakedPositionsPrices = getStakedPositionsPrices();
        return _getThresholdWeightedValueBase(ownedAssetsPrices, stakedPositionsPrices);
    }

    function getThresholdWeightedValuePayable() external payable virtual returns (uint256) {
        return getThresholdWeightedValue();
    }

    /**
      * Returns the threshold weighted value of assets in USD including all tokens as well as staking and LP positions
      * Uses provided AssetPrice struct arrays instead of extracting the pricing data from the calldata again.
    **/
    function getThresholdWeightedValueWithPrices(AssetPrice[] memory ownedAssetsPrices, AssetPrice[] memory stakedPositionsPrices) public view virtual returns (uint256) {
        return _getThresholdWeightedValueBase(ownedAssetsPrices, stakedPositionsPrices);
    }


    /**
     * Returns the current debt denominated in USD
     * Uses provided AssetPrice struct array instead of extracting the pricing data from the calldata again.
    **/
    function getDebtBase(AssetPrice[] memory debtAssetsPrices) internal view returns (uint256){
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        uint256 debt;

        for (uint256 i; i < debtAssetsPrices.length; i++) {
            IERC20Metadata token = IERC20Metadata(tokenManager.getAssetAddress(debtAssetsPrices[i].asset, true));

            Pool pool = Pool(tokenManager.getPoolAddress(debtAssetsPrices[i].asset));
            //10**18 (wei in eth) / 10**8 (precision of oracle feed) = 10**10
            debt = debt + pool.getBorrowed(address(this)) * debtAssetsPrices[i].price * 10 ** 10
            / 10 ** token.decimals();
        }

        return debt;
    }

    /**
     * Returns the current debt denominated in USD
     * @dev This function uses the redstone-evm-connector
    **/
    function getDebt() public view virtual returns (uint256) {
        AssetPrice[] memory debtAssetsPrices = getDebtAssetsPrices();
        return getDebtBase(debtAssetsPrices);
    }

    function getDebtPayable() external payable returns (uint256){
        return getDebt();
    }

    /**
     * Returns the current debt denominated in USD
     * Uses provided AssetPrice struct array instead of extracting the pricing data from the calldata again.
    **/
    function getDebtWithPrices(AssetPrice[] memory debtAssetsPrices) public view virtual returns (uint256) {
        return getDebtBase(debtAssetsPrices);
    }


    /**
     * Returns the current value of Prime Account in USD including all tokens as well as staking and LP positions
     * Uses provided AssetPrice struct array instead of extracting the pricing data from the calldata again.
    **/
    function _getTotalAssetsValueBase(AssetPrice[] memory ownedAssetsPrices) public virtual view returns (uint256) {
        if (ownedAssetsPrices.length > 0) {
            ITokenManager tokenManager = DeploymentConstants.getTokenManager();

            uint256 total = address(this).balance * ownedAssetsPrices[0].price / 10 ** 8;

            for (uint256 i = 0; i < ownedAssetsPrices.length; i++) {
                IERC20Metadata token = IERC20Metadata(tokenManager.getAssetAddress(ownedAssetsPrices[i].asset, true));
                uint256 assetBalance = token.balanceOf(address(this));

                total = total + (ownedAssetsPrices[i].price * 10 ** 10 * assetBalance / (10 ** token.decimals()));
            }
            return total;
        } else {
            return 0;
        }
    }

    /**
     * Returns the current value of Prime Account in USD including all tokens as well as staking and LP positions
     * @dev This function uses the redstone-evm-connector
     **/
    function getTotalAssetsValue() public view virtual returns (uint256) {
        AssetPrice[] memory ownedAssetsPrices = getOwnedAssetsWithNativePrices();
        return _getTotalAssetsValueBase(ownedAssetsPrices);
    }

    /**
     * Returns the current value of Prime Account in USD including all tokens as well as staking and LP positions
     * Uses provided AssetPrice struct array instead of extracting the pricing data from the calldata again.
    **/
    function getTotalAssetsValueWithPrices(AssetPrice[] memory ownedAssetsPrices) public view virtual returns (uint256) {
        return _getTotalAssetsValueBase(ownedAssetsPrices);
    }

    /**
      * Returns list of owned assets that always included NativeToken at index 0
    **/
    function getOwnedAssetsWithNative() public view returns(bytes32[] memory){
        bytes32[] memory ownedAssets = DeploymentConstants.getAllOwnedAssets();
        bytes32 nativeTokenSymbol = DeploymentConstants.getNativeTokenSymbol();

        // If account already owns the native token the use ownedAssets.length; Otherwise add one element to account for additional native token.
        uint256 numberOfAssets = DiamondStorageLib.hasAsset(nativeTokenSymbol) ? ownedAssets.length : ownedAssets.length + 1;
        bytes32[] memory assetsWithNative = new bytes32[](numberOfAssets);

        uint256 lastUsedIndex;
        assetsWithNative[0] = nativeTokenSymbol; // First asset = NativeToken

        for(uint i=0; i< ownedAssets.length; i++){
            if(ownedAssets[i] != nativeTokenSymbol){
                lastUsedIndex += 1;
                assetsWithNative[lastUsedIndex] = ownedAssets[i];
            }
        }
        return assetsWithNative;
    }

    /**
     * Returns the current value of staked positions in USD.
     * Uses provided AssetPrice struct array instead of extracting the pricing data from the calldata again.
    **/
    function _getStakedValueBase(AssetPrice[] memory stakedPositionsPrices) internal view returns (uint256) {
        IStakingPositions.StakedPosition[] storage positions = DiamondStorageLib.stakedPositions();

        uint256 usdValue;

        for (uint256 i; i < positions.length; i++) {
            if(stakedPositionsPrices[i].asset != positions[i].symbol){
                revert PriceSymbolPositionMismatch();
            }

            (bool success, bytes memory result) = address(this).staticcall(abi.encodeWithSelector(positions[i].balanceSelector));

            if (success) {
                uint256 balance = abi.decode(result, (uint256));
                IERC20Metadata token = IERC20Metadata(DeploymentConstants.getTokenManager().getAssetAddress(stakedPositionsPrices[i].asset, true));
                usdValue += stakedPositionsPrices[i].price * 10 ** 10 * balance / (10 ** token.decimals());
            }
        }

        return usdValue;
    }

    /**
     **/
    function getTotalTraderJoeV2() public view virtual returns (uint256) {
        return getTotalTraderJoeV2WithPrices();
    }

    /**
    **/
    function _getTotalTraderJoeV2(bool weighted) internal view returns (uint256) {
        uint256 total;

        ITraderJoeV2Facet.TraderJoeV2Bin[] memory ownedTraderJoeV2Bins = DiamondStorageLib.getTjV2OwnedBinsView();

        PriceInfo memory priceInfo;

        if (ownedTraderJoeV2Bins.length > 0) {
            for (uint256 i; i < ownedTraderJoeV2Bins.length; i++) {
                ITraderJoeV2Facet.TraderJoeV2Bin memory binInfo = ownedTraderJoeV2Bins[i];

                uint256 price;
                uint256 liquidity;

                {
                    address tokenXAddress = address(binInfo.pair.getTokenX());
                    address tokenYAddress = address(binInfo.pair.getTokenY());

                    if (priceInfo.tokenX != tokenXAddress || priceInfo.tokenY != tokenYAddress) {
                        bytes32[] memory symbols = new bytes32[](2);


                        symbols[0] = DeploymentConstants.getTokenManager().tokenAddressToSymbol(tokenXAddress);
                        symbols[1] = DeploymentConstants.getTokenManager().tokenAddressToSymbol(tokenYAddress);

                        uint256[] memory prices = getOracleNumericValuesFromTxMsg(symbols);
                        priceInfo = PriceInfo(tokenXAddress, tokenYAddress, prices[0], prices[1]);
                    }
                }

                {
                    (uint128 binReserveX, uint128 binReserveY) = binInfo.pair.getBin(binInfo.id);

                    price = PriceHelper.convert128x128PriceToDecimal(binInfo.pair.getPriceFromId(binInfo.id)); // how is it denominated (what precision)?

                    liquidity = price * binReserveX / 10 ** 18 + binReserveY;
                }


                {
                    uint256 debtCoverageX = weighted ? DeploymentConstants.getTokenManager().debtCoverage(address(binInfo.pair.getTokenX())) : 1e18;
                    uint256 debtCoverageY = weighted ? DeploymentConstants.getTokenManager().debtCoverage(address(binInfo.pair.getTokenY())) : 1e18;

                    total = total +
                    Math.min(
                        price > 10**24 ?
                            debtCoverageX * liquidity / (price / 10 ** 18) / 10 ** IERC20Metadata(address(binInfo.pair.getTokenX())).decimals() * priceInfo.priceX / 10 ** 8
                            :
                            debtCoverageX * liquidity / price * 10**18 / 10 ** IERC20Metadata(address(binInfo.pair.getTokenX())).decimals() * priceInfo.priceX / 10 ** 8,
                        debtCoverageY * liquidity / 10**(IERC20Metadata(address(binInfo.pair.getTokenY())).decimals()) * priceInfo.priceY / 10 ** 8
                    )
                    .mulDivRoundDown(binInfo.pair.balanceOf(address(this), binInfo.id), 1e18)
                    .mulDivRoundDown(1e18, binInfo.pair.totalSupply(binInfo.id));
                }
            }

            return total;
        } else {
            return 0;
        }
    }

    /**
    **/
    function getTotalUniswapV3() public view virtual returns (uint256) {
        return getTotalUniswapV3WithPrices();
    }

    /**
    **/
    function _getTotalUniswapV3(bool weighted) internal view returns (uint256) {
        uint256 total;

        uint256[] memory ownedUniswapV3TokenIds = DiamondStorageLib.getUV3OwnedTokenIdsView();
        uint256 PRECISION = 20;

        if (ownedUniswapV3TokenIds.length > 0) {

            for (uint256 i; i < ownedUniswapV3TokenIds.length; i++) {

                IUniswapV3Facet.UniswapV3Position memory position = getUniswapV3Position(INonfungiblePositionManager(0x655C406EBFa14EE2006250925e54ec43AD184f8B), ownedUniswapV3TokenIds[i]);

                uint256[] memory prices = new uint256[](2);

                {
                    bytes32[] memory symbols = new bytes32[](2);

                    symbols[0] = DeploymentConstants.getTokenManager().tokenAddressToSymbol(position.token0);
                    symbols[1] = DeploymentConstants.getTokenManager().tokenAddressToSymbol(position.token1);

                    prices = getOracleNumericValuesFromTxMsg(symbols);
                }

                {
                    uint256 debtCoverage0 = weighted ? DeploymentConstants.getTokenManager().debtCoverage(position.token0) : 1e18;
                    uint256 debtCoverage1 = weighted ? DeploymentConstants.getTokenManager().debtCoverage(position.token1) : 1e18;

                    uint160 sqrtPriceX96_a = TickMath.getSqrtRatioAtTick(position.tickLower);
                    uint160 sqrtPriceX96_b = TickMath.getSqrtRatioAtTick(position.tickUpper);

                    uint256 price = 10**(PRECISION) * prices[0] * 10 ** IERC20Metadata(position.token1).decimals() / prices[1] / 10 ** IERC20Metadata(position.token0).decimals();
                    uint160 sqrtMarketPriceX96 = uint160(UniswapV3IntegrationHelper.sqrt(price) * 2**96 / 10**(PRECISION/2));

                    (uint256 token0Amount, uint256 token1amount) = LiquidityAmounts.getAmountsForLiquidity(
                        sqrtMarketPriceX96,
                        sqrtPriceX96_a,
                        sqrtPriceX96_b,
                        position.liquidity
                    );

                    uint256 positionWorth = debtCoverage0 * token0Amount / 10 ** IERC20Metadata(position.token0).decimals() * prices[0] / 10 ** 8
                        + debtCoverage1 * token1amount / 10 ** IERC20Metadata(position.token1).decimals() * prices[1] / 10 ** 8;

                    total = total + positionWorth;
                }
            }

            return total;
        } else {
            return 0;
        }
    }


    function getUniswapV3Position(
        INonfungiblePositionManager positionManager,
        uint256 tokenId) internal view returns (IUniswapV3Facet.UniswapV3Position memory position) {
        (, , address token0, address token1, , int24 tickLower, int24 tickUpper, uint128 liquidity,,,,) = positionManager.positions(tokenId);

        position = IUniswapV3Facet.UniswapV3Position(token0, token1, tickLower, tickUpper, liquidity);
    }

    /**
     * Returns the current value of staked positions in USD.
     * Uses provided AssetPrice struct array instead of extracting the pricing data from the calldata again.
    **/
    function getStakedValueWithPrices(AssetPrice[] memory stakedPositionsPrices) public view returns (uint256) {
        return _getStakedValueBase(stakedPositionsPrices);
    }

    /**
     * Returns the current value of Liquidity Book positions in USD.
     * Uses provided AssetPrice struct array instead of extracting the pricing data from the calldata again.
    **/
    function getTotalTraderJoeV2WithPrices() public view returns (uint256) {
        return _getTotalTraderJoeV2(false);
    }

    /**
     * Returns the current value of Uniswap V3 positions in USD.
     * Uses provided AssetPrice struct array instead of extracting the pricing data from the calldata again.
    **/
    function getTotalUniswapV3WithPrices() public view returns (uint256) {
        return _getTotalUniswapV3(false);
    }

    /**
     * Returns the current value of staked positions in USD.
     * @dev This function uses the redstone-evm-connector
    **/
    function getStakedValue() public view virtual returns (uint256) {
        AssetPrice[] memory stakedPositionsPrices = getStakedPositionsPrices();
        return _getStakedValueBase(stakedPositionsPrices);
    }

    /**
     * Returns the current value of Prime Account in USD including all tokens as well as staking and LP positions
     * @dev This function uses the redstone-evm-connector
    **/
    function getTotalValue() public view virtual returns (uint256) {
        return getTotalAssetsValue() + getStakedValue() + getTotalTraderJoeV2() + getTotalUniswapV3();
    }

    /**
     * Returns the current value of Prime Account in USD including all tokens as well as staking and LP positions
     * Uses provided AssetPrice struct arrays instead of extracting the pricing data from the calldata again.
    **/
    function getTotalValueWithPrices(AssetPrice[] memory ownedAssetsPrices, AssetPrice[] memory stakedPositionsPrices) public view virtual returns (uint256) {
        return getTotalAssetsValueWithPrices(ownedAssetsPrices) + getStakedValueWithPrices(stakedPositionsPrices) + getTotalTraderJoeV2WithPrices() + getTotalUniswapV3WithPrices();
    }

    function getFullLoanStatus() public view returns (uint256[5] memory) {
        return [getTotalValue(), getDebt(), getThresholdWeightedValue(), getHealthRatio(), isSolvent() ? uint256(1) : uint256(0)];
    }

    /**
     * Returns current health ratio (solvency) associated with the loan, defined as threshold weighted value of divided
     * by current debt
     * @dev This function uses the redstone-evm-connector
     **/
    function getHealthRatio() public view virtual returns (uint256) {
        CachedPrices memory cachedPrices = getAllPricesForLiquidation(new bytes32[](0));
        uint256 debt = getDebtWithPrices(cachedPrices.debtAssetsPrices);

        if (debt == 0) {
            return type(uint256).max;
        } else {
            uint256 thresholdWeightedValue = getThresholdWeightedValueWithPrices(cachedPrices.ownedAssetsPrices, cachedPrices.stakedPositionsPrices);
            return thresholdWeightedValue * 1e18 / debt;
        }
    }

    /**
     * Returns current health ratio (solvency) associated with the loan, defined as threshold weighted value of divided
     * by current debt
     * Uses provided AssetPrice struct arrays instead of extracting the pricing data from the calldata again.
     **/
    function getHealthRatioWithPrices(CachedPrices memory cachedPrices) public view virtual returns (uint256) {
        uint256 debt = getDebtWithPrices(cachedPrices.debtAssetsPrices);

        if (debt == 0) {
            return type(uint256).max;
        } else {
            uint256 thresholdWeightedValue = getThresholdWeightedValueWithPrices(cachedPrices.ownedAssetsPrices, cachedPrices.stakedPositionsPrices);
            return thresholdWeightedValue * 1e18 / debt;
        }
    }

    // ERRORS
    error PriceSymbolPositionMismatch();

    error AccountFrozen();

    error ArrayLengthMismatch();
}
