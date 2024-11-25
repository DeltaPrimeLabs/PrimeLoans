// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 6994573d571acec43c908afa321729e454450d71;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@redstone-finance/evm-connector/contracts/data-services/ArbitrumProdDataServiceConsumerBase.sol";
import "../interfaces/ITokenManager.sol";
import "../interfaces/facets/avalanche/ITraderJoeV2Facet.sol";
import "../interfaces/IStakingPositions.sol";
import {Uint256x256Math} from "../lib/joe-v2/math/Uint256x256Math.sol";
import {PriceHelper} from "../lib/joe-v2/PriceHelper.sol";
import "../Pool.sol";

//This path is updated during deployment
import "../lib/local/DeploymentConstants.sol";

contract HealthMeterFacetProd is ArbitrumProdDataServiceConsumerBase {
    using PriceHelper for uint256;
    using Uint256x256Math for uint256;

    struct AssetPrice {
        bytes32 asset;
        uint256 price;
    }

    struct PriceInfo {
        address tokenX;
        address tokenY;
        uint256 priceX;
        uint256 priceY;
    }

    function _getTotalTraderJoeV2Weighted() internal view returns (uint256) {
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
                    uint256 debtCoverageX = DeploymentConstants.getTokenManager().debtCoverage(address(binInfo.pair.getTokenX()));
                    uint256 debtCoverageY = DeploymentConstants.getTokenManager().debtCoverage(address(binInfo.pair.getTokenY()));

                    total = total +
                                                        Math.min(
                                            price > 10 ** 24 ?
                                                debtCoverageX * liquidity / (price / 10 ** 18) / 10 ** IERC20Metadata(address(binInfo.pair.getTokenX())).decimals() * priceInfo.priceX / 10 ** 8
                                                :
                                                debtCoverageX * liquidity / price * 10 ** 18 / 10 ** IERC20Metadata(address(binInfo.pair.getTokenX())).decimals() * priceInfo.priceX / 10 ** 8,
                                            debtCoverageY * liquidity / 10 ** (IERC20Metadata(address(binInfo.pair.getTokenY())).decimals()) * priceInfo.priceY / 10 ** 8
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
      * Returns an array of bytes32[] symbols of debt (borrowable) assets.
    **/
    function _getDebtAssets() internal view returns (bytes32[] memory result) {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        result = tokenManager.getAllPoolAssets();
    }

    /**
      * Returns an array of Asset/Price structs of enriched (always containing AVAX at index 0) owned assets.
      * @dev This function uses the redstone-evm-connector
    **/
    function _getOwnedAssetsWithNativePrices() internal view returns (AssetPrice[] memory result) {
        bytes32[] memory assetsEnriched = _getOwnedAssetsWithNative();
        uint256[] memory prices = getOracleNumericValuesFromTxMsg(assetsEnriched);

        result = new AssetPrice[](assetsEnriched.length);

        for (uint i; i < assetsEnriched.length; i++) {
            result[i] = AssetPrice({
                asset: assetsEnriched[i],
                price: prices[i]
            });
        }
    }

    /**
      * Returns list of owned assets that always included NativeToken at index 0
    **/
    function _getOwnedAssetsWithNative() internal view returns (bytes32[] memory){
        bytes32[] memory ownedAssets = DeploymentConstants.getAllOwnedAssets();
        bytes32 nativeTokenSymbol = DeploymentConstants.getNativeTokenSymbol();

        // If account already owns the native token the use ownedAssets.length; Otherwise add one element to account for additional native token.
        uint256 numberOfAssets = DiamondStorageLib.hasAsset(nativeTokenSymbol) ? ownedAssets.length : ownedAssets.length + 1;
        bytes32[] memory assetsWithNative = new bytes32[](numberOfAssets);

        uint256 lastUsedIndex;
        assetsWithNative[0] = nativeTokenSymbol; // First asset = NativeToken

        for (uint i = 0; i < ownedAssets.length; i++) {
            if (ownedAssets[i] != nativeTokenSymbol) {
                assetsWithNative[++lastUsedIndex] = ownedAssets[i];
            }
        }
        return assetsWithNative;
    }

    /**
      * Returns an array of Asset/Price structs of all assets.
      * @dev This function uses the redstone-evm-connector
    **/
    function _getAllAssetsWithNativePrices() internal view returns (AssetPrice[] memory result) {
        bytes32[] memory assets = _getAllAssetsWithNative();
        uint256[] memory prices = getOracleNumericValuesFromTxMsg(assets);

        result = new AssetPrice[](assets.length);

        for (uint i; i < assets.length; i++) {
            result[i] = AssetPrice({
                asset: assets[i],
                price: prices[i]
            });
        }
    }

    /**
      * Returns list of owned assets that always included NativeToken at index 0
    **/
    function _getAllAssetsWithNative() internal view returns (bytes32[] memory){
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        bytes32[] memory assets = tokenManager.getAllTokenAssets();
        bytes32 nativeTokenSymbol = DeploymentConstants.getNativeTokenSymbol();

        uint256 numberOfAssets = assets.length;
        bytes32[] memory assetsWithNative = new bytes32[](numberOfAssets);

        uint256 lastUsedIndex;
        assetsWithNative[0] = nativeTokenSymbol; // First asset = NativeToken

        for (uint i = 0; i < assets.length; i++) {
            if (assets[i] != nativeTokenSymbol) {
                assetsWithNative[++lastUsedIndex] = assets[i];
            }
        }
        return assetsWithNative;
    }

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

    function _getTWVStakedPositions() internal view returns (uint256) {
        AssetPrice[] memory stakedPositionsPrices = getStakedPositionsPrices();
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

    /**
     * Returns current health meter (0% - 100%) associated with the loan
     * @dev This function uses the redstone-evm-connector
     */
    function getHealthMeter() public view returns (uint256) {
        AssetPrice[] memory assetsPrices = _getAllAssetsWithNativePrices();

        bytes32 nativeTokenSymbol = DeploymentConstants.getNativeTokenSymbol();
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        uint256 weightedCollateralPlus = assetsPrices[0].price * address(this).balance * tokenManager.debtCoverage(tokenManager.getAssetAddress(nativeTokenSymbol, true)) / (10 ** 26);
        uint256 weightedCollateralMinus = 0;
        uint256 weightedBorrowed = 0;
        uint256 borrowed = 0;

        weightedCollateralPlus += _getTotalTraderJoeV2Weighted();
        weightedCollateralPlus += _getTWVStakedPositions();

        for (uint256 i = 0; i < assetsPrices.length; i++) {
            uint256 _balance;
            uint8 decimals;
            uint256 debtCoverage;
            {
                IERC20Metadata token = IERC20Metadata(tokenManager.getAssetAddress(assetsPrices[i].asset, true));
                _balance = token.balanceOf(address(this));
                decimals = token.decimals();
                debtCoverage = tokenManager.debtCoverage(address(token));
            }

            Pool pool;
            try tokenManager.getPoolAddress(assetsPrices[i].asset) returns (address poolAddress) {
                pool = Pool(poolAddress);
            } catch {
                weightedCollateralPlus = weightedCollateralPlus + (assetsPrices[i].price * _balance * debtCoverage / (10 ** decimals * 1e8));
                continue;
            }
            uint256 _borrowed = pool.getBorrowed(address(this));

            if (_balance == 0 && _borrowed == 0) {
                continue;
            }

            if (_balance > _borrowed) {
                weightedCollateralPlus = weightedCollateralPlus + (assetsPrices[i].price * (_balance - _borrowed) * debtCoverage / (10 ** decimals * 1e8));
            } else if (_balance < _borrowed) {
                weightedCollateralMinus = weightedCollateralMinus + (assetsPrices[i].price * (_borrowed - _balance) * debtCoverage / (10 ** decimals * 1e8));
            }
            weightedBorrowed = weightedBorrowed + (assetsPrices[i].price * _borrowed * debtCoverage / (10 ** decimals * 1e8));
            borrowed = borrowed + (assetsPrices[i].price * _borrowed * 1e10 / (10 ** decimals));
        }

        uint256 weightedCollateral;
        if (weightedCollateralPlus > weightedCollateralMinus) {
            weightedCollateral = weightedCollateralPlus - weightedCollateralMinus;
        }

        uint256 multiplier = 100 * 1e18; // 18 decimal points

        if (borrowed == 0) return multiplier;

        if (weightedCollateral > 0 && weightedCollateral + weightedBorrowed > borrowed) {
            return (weightedCollateral + weightedBorrowed - borrowed) * multiplier / weightedCollateral;
        }

        return 0;
    }

    // ERRORS
    error PriceSymbolPositionMismatch();
}
