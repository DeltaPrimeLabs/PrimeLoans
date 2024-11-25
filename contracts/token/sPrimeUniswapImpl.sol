// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 9f02dab5ae5dd02d0771bb7dedabb0ad6ac8802c;
pragma solidity ^0.8.17;

// Importing necessary libraries and interfaces
import "./sPrimeUniswap.sol";
import "../lib/uniswap-v3/PositionValue.sol";
import "../lib/uniswap-v3/UniswapV3IntegrationHelper.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

// SPrime contract declaration
contract sPrimeUniswapImpl
{
    using PositionValue for INonfungiblePositionManager;
    address public sPrime;

    constructor(address sPrimeUniswap_) {
        sPrime = sPrimeUniswap_;
    }

    function getTokenIDByUser(address user) internal view returns (uint256) {
        return sPrimeUniswap(sPrime).userTokenId(user);
    }

    function getV3Pool() internal view returns (IUniswapV3Pool) {
        return IUniswapV3Pool(sPrimeUniswap(sPrime).pool());
    }

    function getPositionManager() internal view returns (INonfungiblePositionManager) {
        return INonfungiblePositionManager(sPrimeUniswap(sPrime).positionManager());
    }

    function tickInRange(uint256 tokenId) public view returns (bool) {
        IUniswapV3Pool pool = getV3Pool();
        INonfungiblePositionManager positionManager = getPositionManager();

        (, int24 tick, , , , , ) = pool.slot0();

        (, , , , , int24 tickLower, int24 tickUpper, , , , , ) = positionManager
            .positions(tokenId);
        return tickLower <= tick && tick <= tickUpper;
    }

    /**
     * @dev Returns the estimated USD value of the user position
     * @param user User Address
     * @param poolPrice Pool Price or oracle price for calculating proper token amount
     * @return amountY Total Value in tokenY amount for the user's position.
     */
    function getUserValueInTokenY(
        address user,
        uint256 poolPrice
    ) public view returns (uint256 amountY) {
        uint256 tokenId = getTokenIDByUser(user);
        IUniswapV3Pool pool = getV3Pool();
        IERC20Metadata tokenX = IERC20Metadata(address(sPrimeUniswap(sPrime).getTokenX()));
        IERC20Metadata tokenY = IERC20Metadata(address(sPrimeUniswap(sPrime).getTokenY()));
        IERC20Metadata token0 = IERC20Metadata(pool.token0());
        IERC20Metadata token1 = IERC20Metadata(pool.token1());
        INonfungiblePositionManager positionManager = getPositionManager();

        if(tokenId > 0) {
            uint256 price = poolPrice;

            if (token0 != tokenX) {
                price = 10 ** (8 + token1.decimals()) / price;
            } else {
                price = FullMath.mulDiv(price, 10 ** token1.decimals(), 10 ** 8);
            }
            uint160 sqrtRatioX96 = uint160((UniswapV3IntegrationHelper.sqrt(price) * 2 ** 96) / 10 ** (token0.decimals() / 2));
            uint256 amountX;
            (amountX, amountY) = positionManager.total(
                tokenId,
                sqrtRatioX96
            );

            if(token0 != tokenX) {
                (amountX, amountY) = (amountY, amountX);
            }

            uint8 tokenXDecimals = tokenX.decimals();
            uint8 tokenYDecimals = tokenY.decimals();
            if (tokenYDecimals >= tokenXDecimals + 8) {
                amountY =
                    amountY +
                    amountX *
                    poolPrice *
                    10 ** (tokenYDecimals - tokenXDecimals - 8);
            } else {
                amountY =
                    amountY +
                    FullMath.mulDiv(
                        amountX,
                        poolPrice,
                        10 ** (tokenXDecimals + 8 - tokenYDecimals)
                    );
            }
        }

        return amountY;
    }
}