// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: e66c63a5228df2ecc68f8d8adb7254dac9157341;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@redstone-finance/evm-connector/contracts/data-services/AvalancheDataServiceConsumerBase.sol";
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

//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";
import "../../interfaces/facets/avalanche/IUniswapV3Facet.sol";

contract SolvencyFacetProdAvalanche is SolvencyFacetProd {
    function getDataServiceId() public view virtual override returns (string memory) {
        return "redstone-avalanche-prod";
    }

    function getUniqueSignersThreshold() public view virtual override returns (uint8) {
        return 3;
    }

    function getAuthorisedSignerIndex(
        address signerAddress
    ) public view virtual override returns (uint8) {
        if (signerAddress == 0x1eA62d73EdF8AC05DfceA1A34b9796E937a29EfF) {
            return 0;
        } else if (signerAddress == 0x2c59617248994D12816EE1Fa77CE0a64eEB456BF) {
            return 1;
        } else if (signerAddress == 0x12470f7aBA85c8b81D63137DD5925D6EE114952b) {
            return 2;
        } else if (signerAddress == 0x109B4a318A4F5ddcbCA6349B45f881B4137deaFB) {
            return 3;
        } else if (signerAddress == 0x83cbA8c619fb629b81A65C2e67fE15cf3E3C9747) {
            return 4;
        } else {
            revert SignerNotAuthorised(signerAddress);
        }
    }
}
