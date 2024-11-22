// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: aca0d66772607a851d7017b5cb3e6f38ee11f918;

pragma solidity ^0.8.17;

// Importing necessary libraries and interfaces
import "../interfaces/ISPrimeTraderJoe.sol";
import "../interfaces/IPositionManager.sol";
import "../lib/joe-v2/math/SafeCast.sol";
import "../lib/uniswap-v3/FullMath.sol";
import "../lib/joe-v2/math/Uint256x256Math.sol";
import "../lib/joe-v2/PriceHelper.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

// SPrime contract declaration
contract SPrimeImpl {
    using SafeCast for uint256; // Using SafeCast for uint256 for safe type casting
    using Uint256x256Math for uint256;

    address public sPrime;

    constructor(address sPrime_) {
        sPrime = sPrime_;
    }

    /**
     * @dev Check if the active id is in the user position range
     * @param tokenId Token Id.
     * @return status bin status
     */
    function binInRange(uint256 tokenId) public view returns(bool) {
        IPositionManager positionManager = ISPrimeTraderJoe(sPrime).positionManager();
        ILBPair lbPair = ISPrimeTraderJoe(sPrime).getLBPair();

        IPositionManager.DepositConfig memory depositConfig = positionManager.getDepositConfigFromTokenId(tokenId);

        uint256[] memory depositIds = depositConfig.depositIds;
        uint256 activeId = lbPair.getActiveId();
        if (depositIds[0] <= activeId && depositIds[depositIds.length - 1] >= activeId) {
            return true;
        }
        return false;
    }

    /**
    * @dev Returns the token balances for the specific bin.
    * @param depositIds Deposited bin id list.
    * @param liquidityMinted Liquidity minted for each bin.
    * @param poolPrice Oracle Price
    */
    function getLiquidityTokenAmounts(uint256[] memory depositIds, uint256[] memory liquidityMinted, uint256 poolPrice) public view returns(uint256 amountX, uint256 amountY) {
        
        ILBPair lbPair = ISPrimeTraderJoe(sPrime).getLBPair();
        IERC20Metadata tokenY = IERC20Metadata(address(ISPrimeTraderJoe(sPrime).getTokenY()));
        poolPrice = FullMath.mulDiv(poolPrice, 10 ** tokenY.decimals(), 1e8);

        uint24 binId = lbPair.getIdFromPrice(PriceHelper.convertDecimalPriceTo128x128(poolPrice));

        for (uint256 i; i < depositIds.length; ++i) {
            uint24 id = depositIds[i].safe24();

            uint256 liquidity = liquidityMinted[i];
            (uint256 binReserveX, uint256 binReserveY) = lbPair.getBin(id);

            // Get Current Pool price from id.
            uint256 currentPrice = PriceHelper.convert128x128PriceToDecimal(lbPair.getPriceFromId(id));

            uint256 totalSupply = lbPair.totalSupply(id);
            uint256 xAmount = liquidity.mulDivRoundDown(binReserveX, totalSupply);
            uint256 yAmount = liquidity.mulDivRoundDown(binReserveY, totalSupply);
            if(binId > id) {
                yAmount = yAmount + FullMath.mulDiv(xAmount, currentPrice, 10 ** 18);
                xAmount = 0;
            } else if(binId < id) {
                xAmount = xAmount + FullMath.mulDiv(yAmount, 10 ** 18, currentPrice);
                yAmount = 0;
            } 

            amountX += xAmount;
            amountY += yAmount;
        }
    }
}