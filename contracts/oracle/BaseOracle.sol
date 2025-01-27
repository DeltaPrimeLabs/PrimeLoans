// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "hardhat/console.sol";

interface IUniswapV3Pool {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function observe(uint32[] calldata secondsAgos) external view returns (int56[] memory tickCumulatives, uint160[] memory);
}

interface IERC20 {
    function decimals() external view returns (uint8);
}

interface IAMM {
    function getAmountOut(uint256 amountIn, address tokenIn) external view returns (uint256);
}

contract BaseOracle {
    struct PoolConfig {
        address poolAddress;
        bool isCL;
        int24 tickSpacing;
        uint32 shortTwap;
        uint32 midTwap;
        uint32 longTwap;
        uint256 midDeviation;
        uint256 longDeviation;
        uint256 minLiquidity;
        address baseAsset;  // Base asset address for this pool
    }

    struct TokenConfig {
        bool isConfigured;
        PoolConfig[] pools;
    }

    address public admin;
    mapping(address => TokenConfig) public tokenConfigs;

    uint256 private constant PRECISION = 1e18;

    event PoolAdded(address token, address pool);
    event PoolRemoved(address token, address pool);
    event TokenConfigured(address token);
    event TokenRemoved(address token);

    constructor() {
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    function getFullTokenConfig(address token) external view returns (TokenConfig memory) {
        return tokenConfigs[token];
    }

    function normalizeAmount(uint256 amount, uint8 decimals) internal pure returns (uint256) {
        if (decimals > 18) {
            return amount / (10 ** (decimals - 18));
        }
        return amount * (10 ** (18 - decimals));
    }

    function configureToken(address token, PoolConfig[] calldata pools) external onlyAdmin {
        require(pools.length > 0, "Empty pools");
        delete tokenConfigs[token].pools;

        tokenConfigs[token].isConfigured = true;
        for (uint i = 0; i < pools.length; i++) {
            require(pools[i].baseAsset != address(0), "Invalid base asset");
            tokenConfigs[token].pools.push(pools[i]);
            console.log("Pool added: %s with base asset: %s", pools[i].poolAddress, pools[i].baseAsset);
        }

        emit TokenConfigured(token);
    }

    function removeToken(address token) external onlyAdmin {
        delete tokenConfigs[token];
        emit TokenRemoved(token);
    }

    struct GetDollarValueParams {
        address asset;
        uint256 amount;
        bool useMidTwap;
        bool useLongTwap;
        address[] baseAssets;
        uint256[] baseAssetPrices;
    }

    function getDollarValue(GetDollarValueParams calldata params) external view returns (uint256) {
        require(tokenConfigs[params.asset].isConfigured, "Token not configured");
        require(params.baseAssets.length == params.baseAssetPrices.length, "Length mismatch");

        uint256 minPrice = type(uint256).max;
        PoolConfig[] memory pools = tokenConfigs[params.asset].pools;

        for (uint i = 0; i < pools.length; i++) {
            uint256 baseAssetPrice = 0;
            for (uint j = 0; j < params.baseAssets.length; j++) {
                if (params.baseAssets[j] == pools[i].baseAsset) {
                    baseAssetPrice = params.baseAssetPrices[j];
                    break;
                }
            }
            require(baseAssetPrice > 0, "Missing base asset price");

            console.log("Calculating pool price for pool: %s", pools[i].poolAddress);
            uint256 poolPrice = calculatePoolPrice(
                params.asset,
                params.amount,
                params.useMidTwap,
                params.useLongTwap,
                baseAssetPrice,
                pools[i]
            );

            console.log("Pool price: %s", poolPrice);
            if (poolPrice < minPrice) {
                minPrice = poolPrice;
            }
        }

        console.log("Min price: %s", minPrice);
        require(minPrice != type(uint256).max, "No valid price");
        return (minPrice * params.amount) / PRECISION;
    }

    function calculatePoolPrice(
        address asset,
        uint256 amount,
        bool useMidTwap,
        bool useLongTwap,
        uint256 baseAssetPrice,
        PoolConfig memory pool
    ) internal view returns (uint256) {
        if (pool.isCL) {
            return calculateCLPrice(
                asset,
                useMidTwap,
                useLongTwap,
                baseAssetPrice,
                pool
            );
        } else {
            return calculateAMMPrice(
                asset,
                amount,
                baseAssetPrice,
                pool
            );
        }
    }

    function calculateCLPrice(
        address asset,
        bool useMidTwap,
        bool useLongTwap,
        uint256 baseAssetPrice,
        PoolConfig memory pool
    ) internal view returns (uint256) {
        IUniswapV3Pool uniPool = IUniswapV3Pool(pool.poolAddress);
        bool isToken0 = uniPool.token0() == asset;

        uint256 shortTwapPrice = getTwapPrice(
            pool.poolAddress,
            pool.shortTwap,
            isToken0
        );

        console.log("Short TWAP price: %s", shortTwapPrice);

        uint256 priceFromPool = (shortTwapPrice * baseAssetPrice) / PRECISION;
        console.log("Price from pool: %s", priceFromPool);

        if (useMidTwap) {
            uint256 midTwapPrice = getTwapPrice(
                pool.poolAddress,
                pool.midTwap,
                isToken0
            );
            midTwapPrice = (midTwapPrice * baseAssetPrice) / PRECISION;

            require(
                calculateDeviation(priceFromPool, midTwapPrice) <= pool.midDeviation,
                "Mid TWAP deviation too high"
            );
        }

        if (useLongTwap) {
            uint256 longTwapPrice = getTwapPrice(
                pool.poolAddress,
                pool.longTwap,
                isToken0
            );
            longTwapPrice = (longTwapPrice * baseAssetPrice) / PRECISION;

            require(
                calculateDeviation(priceFromPool, longTwapPrice) <= pool.longDeviation,
                "Long TWAP deviation too high"
            );
        }

        return priceFromPool;
    }

    function calculateAMMPrice(
        address asset,
        uint256 amount,
        uint256 baseAssetPrice,
        PoolConfig memory pool
    ) internal view returns (uint256) {
        IAMM ammPool = IAMM(pool.poolAddress);

        uint8 decimalsIn = IERC20(asset).decimals();
        uint8 decimalsOut = IERC20(pool.baseAsset).decimals();

        uint256 amountOut = ammPool.getAmountOut(amount, asset);
        uint256 normalizedAmountOut = normalizeAmount(amountOut, decimalsOut);
        return (normalizedAmountOut * baseAssetPrice) / PRECISION;
    }

    function getTwapPrice(
        address poolAddress,
        uint32 secondsAgo,
        bool isToken0
    ) internal view returns (uint256) {
        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = secondsAgo;
        secondsAgos[1] = 0;

        try IUniswapV3Pool(poolAddress).observe(secondsAgos) returns (
            int56[] memory tickCumulatives,
            uint160[] memory
        ) {
            int56 tickDiff = tickCumulatives[0] - tickCumulatives[1];
            int24 avgTick = int24(tickDiff / int56(uint56(secondsAgo)));

            console.log("Tick cumulatives:");
            console.log(uint256(uint56(tickCumulatives[0])));
            console.log(uint256(uint56(tickCumulatives[1])));
            console.log("Tick diff and avg:");
            console.log(uint256(uint56(tickDiff >= 0 ? tickDiff : -tickDiff)));
            console.log(uint256(uint24(avgTick >= 0 ? avgTick : -avgTick)));

            // Following Excel's calculation of POWER(1.0001, tick/2)
            int24 halfTick = avgTick / 2;
            bool isNegative = halfTick < 0;
            uint256 absTick = uint256(uint24(isNegative ? -halfTick : halfTick));

            console.log("Half tick calculation:");
            console.log(uint256(uint24(halfTick >= 0 ? halfTick : -halfTick)));
            console.log(isNegative);

            // Calculate exact power using bit manipulation
            uint256 result = 1e18;  // Q18.18 fixed point
            uint256 base = 1000100000000;  // 1.0001 * 1e12

            for (uint8 i = 0; i < 16; i++) {
                if ((absTick >> i) & 0x1 != 0) {
                    result = (result * base) / 1e12;
                }
                base = (base * base) / 1e12;
            }

            console.log("Power calculation:");
            console.log(result);

            // Invert if negative
            if (isNegative) {
                result = (1e36 / result);
            }

            console.log("After negative adjustment (SQRT price):");
            console.log(result);
            console.log("SQRT price as decimal:");
            console.log(uint256((result * 1e8) / 1e18), "e-8");

            // Calculate final price - for token0 we want 1/(sqrtPrice^2)
            uint256 price;
            if (isToken0) {
                // For token0, final price is 1/sqrtPrice^2
                price = (1e36 / result);  // First divide
                price = (price * 1e18) / result;  // Second divide
            } else {
                // For token1, final price is sqrtPrice^2
                price = (result * result) / 1e18;
            }

            console.log("Final price:");
            console.log(price);
            console.log("Final price as decimal:");
            console.log(uint256((price * 1e8) / 1e18), "e-8");

            return price;
        } catch {
            return type(uint256).max;
        }
    }

    function calculateDeviation(
        uint256 price1,
        uint256 price2
    ) internal pure returns (uint256) {
        if (price1 > price2) {
            return ((price1 - price2) * PRECISION) / price2;
        }
        return ((price2 - price1) * PRECISION) / price1;
    }

    function setAdmin(address newAdmin) external onlyAdmin {
        admin = newAdmin;
    }
}