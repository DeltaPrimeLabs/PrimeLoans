// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: c2ccdf2b9a14009c964300273129b0bfaf0457b4;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../../interfaces/ITokenManager.sol";
import "../../Pool.sol";
import "../SolvencyFacetProd.sol";
import "../../interfaces/IStakingPositions.sol";
import "../../interfaces/facets/avalanche/ITraderJoeV2Facet.sol";
import "../../interfaces/uniswap-v3-periphery/INonfungiblePositionManager.sol";
import {PriceHelper} from "../../lib/joe-v2/PriceHelper.sol";
import {Uint256x256Math} from "../../lib/joe-v2/math/Uint256x256Math.sol";
import {TickMath} from "../../lib/uniswap-v3/TickMath.sol";
import {FullMath} from "../../lib/uniswap-v3/FullMath.sol";
import "../../interfaces/facets/avalanche/IYieldYak.sol";


//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";
import "../../interfaces/facets/avalanche/IUniswapV3Facet.sol";

contract SolvencyFacetProdArbitrum is SolvencyFacetProd {
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

    function fixVaultDecimals(address vault) internal view returns (uint256 multiplier){
        if(vault == 0x8Bc6968b7A9Eed1DD0A259eFa85dc2325B923dd2 || vault == 0x4649c7c3316B27C4A3DB5f3B47f87C687776Eb8C){
            IYieldYak vault = IYieldYak(vault);
            IERC20Metadata vaultDepositToken = IERC20Metadata(vault.depositToken());
            multiplier = 10 ** (vault.decimals() - vaultDepositToken.decimals());
        } else {
            multiplier = 1;
        }

    }

    function _getTWVOwnedAssets(AssetPrice[] memory ownedAssetsPrices) internal virtual override view returns (uint256) {
        bytes32 nativeTokenSymbol = DeploymentConstants.getNativeTokenSymbol();
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        uint256 weightedValueOfTokens = ownedAssetsPrices[0].price * (address(this).balance - msg.value) * tokenManager.debtCoverage(tokenManager.getAssetAddress(nativeTokenSymbol, true)) / (10 ** 26);

        if (ownedAssetsPrices.length > 0) {

            for (uint256 i = 0; i < ownedAssetsPrices.length; i++) {
                IERC20Metadata token = IERC20Metadata(tokenManager.getAssetAddress(ownedAssetsPrices[i].asset, true));
                weightedValueOfTokens = weightedValueOfTokens + (ownedAssetsPrices[i].price * token.balanceOf(address(this)) * tokenManager.debtCoverage(address(token)) * fixVaultDecimals(address(token)) / (10 ** token.decimals() * 1e8));
            }
        }
        return weightedValueOfTokens;
    }

    function _getTotalAssetsValueBase(AssetPrice[] memory ownedAssetsPrices) public virtual override view returns (uint256) {
        if (ownedAssetsPrices.length > 0) {
            ITokenManager tokenManager = DeploymentConstants.getTokenManager();

            uint256 total = address(this).balance * ownedAssetsPrices[0].price / 10 ** 8;

            for (uint256 i = 0; i < ownedAssetsPrices.length; i++) {
                IERC20Metadata token = IERC20Metadata(tokenManager.getAssetAddress(ownedAssetsPrices[i].asset, true));
                uint256 assetBalance = token.balanceOf(address(this)) * fixVaultDecimals(address(token));

                total = total + (ownedAssetsPrices[i].price * 10 ** 10 * assetBalance / (10 ** token.decimals()));
            }
            return total;
        } else {
            return 0;
        }
    }
}
