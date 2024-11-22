// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 8e5d3085ec4332d1a170bb7087f08c89141d9afe;
pragma solidity 0.8.17;

import "@redstone-finance/evm-connector/contracts/core/RedstoneConsumerNumericBase.sol";
import "../../lib/local/DeploymentConstants.sol";
import "../SolvencyFacetProd.sol";
import {ILTIPFacet} from "../../interfaces/facets/arbitrum/ILTIPFacet.sol";

contract LTIPFacet is ILTIPFacet, RedstoneConsumerNumericBase {
    function getDataServiceId() public view virtual override returns (string memory) {
        return "redstone-arbitrum-prod";
    }

    function getUniqueSignersThreshold() public view virtual override returns (uint8) {
        return 3;
    }

    function getAuthorisedSignerIndex(
        address signerAddress
    ) public view virtual override returns (uint8) {
        if (signerAddress == 0x345Efd26098e173F811e3B9Af1B0e0a11872B38b) {
            return 0;
        } else if (signerAddress == 0xbD0c5ccd85D5831B10E3e49527B8Cd67e2EFAf39) {
            return 1;
        } else if (signerAddress == 0x2F3E8EC88C01593d10ca9461c807660fF2D8DB28) {
            return 2;
        } else if (signerAddress == 0xb7f154bB5491565D215F4EB1c3fe3e84960627aF) {
            return 3;
        } else if (signerAddress == 0xE6b0De8F4B31F137d3c59b5a0A71e66e7D504Ef9) {
            return 4;
        } else {
            revert SignerNotAuthorised(signerAddress);
        }
    }

    function getTotalAssetsValueBase(SolvencyFacetProd.AssetPrice[] memory ownedAssetsPrices) internal view returns (uint256) {
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

    function getDebtAssets() internal view returns(bytes32[] memory result) {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        result = tokenManager.getAllPoolAssets();
    }

    function getDebtAssetsPrices() internal view returns(SolvencyFacetProd.AssetPrice[] memory result) {
        bytes32[] memory debtAssets = getDebtAssets();

        uint256[] memory debtAssetsPrices = getOracleNumericValuesFromTxMsg(debtAssets);
        result = new SolvencyFacetProd.AssetPrice[](debtAssetsPrices.length);

        for(uint i; i<debtAssetsPrices.length; i++){
            result[i] = SolvencyFacetProd.AssetPrice({
                asset: debtAssets[i],
                price: debtAssetsPrices[i]
            });
        }
    }

    function getDebt() internal view virtual returns (uint256) {
        SolvencyFacetProd.AssetPrice[] memory debtAssetsPrices = getDebtAssetsPrices();
        return getDebtBase(debtAssetsPrices);
    }

    function getDebtBase(SolvencyFacetProd.AssetPrice[] memory debtAssetsPrices) internal view returns (uint256){
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

    function getLTIPEligibleTVL() public view returns (uint256) {
        bytes32[] memory notEligibleTokens = new bytes32[](19);
        notEligibleTokens[0] = bytes32("ETH");
        notEligibleTokens[1] = bytes32("USDC");
        notEligibleTokens[2] = bytes32("ARB");
        notEligibleTokens[3] = bytes32("BTC");
        notEligibleTokens[4] = bytes32("DAI");
        notEligibleTokens[5] = bytes32("USDT");
        notEligibleTokens[6] = bytes32("FRAX");
        notEligibleTokens[7] = bytes32("USDC.e");
        notEligibleTokens[8] = bytes32("UNI");
        notEligibleTokens[9] = bytes32("LINK");
        notEligibleTokens[10] = bytes32("GMX");
        notEligibleTokens[11] = bytes32("MAGIC");
        notEligibleTokens[12] = bytes32("WOO");
        notEligibleTokens[13] = bytes32("wstETH");
        notEligibleTokens[14] = bytes32("JOE");
        notEligibleTokens[15] = bytes32("GRAIL");
        notEligibleTokens[16] = bytes32("ezETH");
        notEligibleTokens[17] = bytes32("weETH");
        notEligibleTokens[18] = bytes32("rsETH");

        uint256[] memory prices = getOracleNumericValuesFromTxMsg(notEligibleTokens);

        SolvencyFacetProd.AssetPrice[] memory assetsPrices = new SolvencyFacetProd.AssetPrice[](notEligibleTokens.length);

        for(uint i; i<notEligibleTokens.length; i++){
            assetsPrices[i] = SolvencyFacetProd.AssetPrice({
                asset: notEligibleTokens[i],
                price: prices[i]
            });
        }

        uint256 notEligibleAssetsValue = getTotalAssetsValueBase(assetsPrices);
        uint256 debt = getDebt();

        return debt > notEligibleAssetsValue ? debt - notEligibleAssetsValue : 0;
    }
}
