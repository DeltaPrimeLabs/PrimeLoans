// SPDX-License-Identifier: AGPL3
pragma solidity 0.8.17;

/******************
@title WadRayMath library
@author Aave
@dev Provides mul and div function for wads (decimal numbers with 18 digits precision) and rays (decimals with 27 digits)
@dev https://github.com/aave/aave-protocol/blob/master/contracts/libraries/WadRayMath.sol
 */

library WadRayMath {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant halfWAD = WAD / 2;

    uint256 internal constant RAY = 1e27;
    uint256 internal constant halfRAY = RAY / 2;

    uint256 internal constant WAD_RAY_RATIO = 1e9;

    function ray() internal pure returns (uint256) {
        return RAY;
    }

    function wad() internal pure returns (uint256) {
        return WAD;
    }

    function halfRay() internal pure returns (uint256) {
        return halfRAY;
    }

    function halfWad() internal pure returns (uint256) {
        return halfWAD;
    }

    function wadMul(uint256 a, uint256 b) internal pure returns (uint256) {
        //return halfWAD.add(a.mul(b)).div(WAD);
        return (halfWAD + (a * b)) / WAD;
    }

    function wadDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 halfB = b / 2;

        //return halfB.add(a.mul(WAD)).div(b);
        return (halfB + (a * WAD)) / b;
    }

    function rayMul(uint256 a, uint256 b) internal pure returns (uint256) {
        //return halfRAY.add(a.mul(b)).div(RAY);
        return (halfRAY + (a * b)) / RAY;
    }

    function rayDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 halfB = b / 2;

        //return halfB.add(a.mul(RAY)).div(b);
        return (halfB + (a * RAY)) / b;
    }

    function rayToWad(uint256 a) internal pure returns (uint256) {
        uint256 halfRatio = WAD_RAY_RATIO / 2;

        //return halfRatio.add(a).div(WAD_RAY_RATIO);
        return (halfRatio + a) / WAD_RAY_RATIO;
    }

    function wadToRay(uint256 a) internal pure returns (uint256) {
        //return a.mul(WAD_RAY_RATIO);
        return a * WAD_RAY_RATIO;
    }

    /**
     * @dev calculates base^exp. The code uses the ModExp precompile
     */
    //solium-disable-next-line
    function rayPow(uint256 x, uint256 n) internal pure returns (uint256 z) {
        z = n % 2 != 0 ? x : RAY;

        for (n /= 2; n != 0; n /= 2) {
            x = rayMul(x, x);

            if (n % 2 != 0) {
                z = rayMul(z, x);
            }
        }
    }
}
