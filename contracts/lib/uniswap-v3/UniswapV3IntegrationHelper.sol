// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {FullMath} from "./FullMath.sol";

library UniswapV3IntegrationHelper {
    // babylonian method (https://en.wikipedia.org/wiki/Methods_of_computing_square_roots#Babylonian_method)
    //TODO: check what happens to signed
    function sqrt(uint y) internal pure returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    //source: https://ethereum.stackexchange.com/questions/98685/computing-the-uniswap-v3-pair-price-from-q64-96-number
    function sqrtPriceX96ToSqrtUint(uint160 sqrtPriceX96, uint8 decimalsToken0)
    internal
    pure
    returns (uint256)
    {
        uint256 numerator1 = uint256(sqrtPriceX96);
        uint256 numerator2 = 10**decimalsToken0;
        return FullMath.mulDiv(numerator1, numerator2, 2 ** 96);
    }
}
