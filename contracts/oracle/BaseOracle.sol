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
    }

    struct TokenConfig {
        bool isConfigured;
        PoolConfig[] pools;
    }

    struct PriceParams {
        address asset;
        address baseAsset;
        uint256 baseAssetPrice;
        uint256 amount;
        bool useMidTwap;
        bool useLongTwap;
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
            tokenConfigs[token].pools.push(pools[i]);
            console.log("Pool added: %s", pools[i].poolAddress);
        }
        console.log("Pools length: %s", tokenConfigs[token].pools.length);

        console.log("Token configured: %s", token);

        emit TokenConfigured(token);
    }

    function removeToken(address token) external onlyAdmin {
        delete tokenConfigs[token];
        emit TokenRemoved(token);
    }

    function getDollarValue(PriceParams memory params) external view returns (uint256) {
        require(tokenConfigs[params.asset].isConfigured, "Token not configured");

        uint256 minPrice = type(uint256).max;
        PoolConfig[] memory pools = tokenConfigs[params.asset].pools;

        for (uint i = 0; i < pools.length; i++) {
            console.log("Calculating pool price for pool: %s", pools[i].poolAddress);
            uint256 poolPrice = calculatePoolPrice(params, pools[i]);
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
        PriceParams memory params,
        PoolConfig memory pool
    ) internal view returns (uint256) {
        if (pool.isCL) {
            return calculateCLPrice(params, pool);
        } else {
            return calculateAMMPrice(params, pool);
        }
    }

    function calculateCLPrice(
        PriceParams memory params,
        PoolConfig memory pool
    ) internal view returns (uint256) {
        IUniswapV3Pool uniPool = IUniswapV3Pool(pool.poolAddress);
        bool isToken0 = uniPool.token0() == params.asset;

        uint256 shortTwapPrice = getTwapPrice(
            pool.poolAddress,
            pool.shortTwap,
            isToken0
        );

        console.log("Short TWAP price: %s", shortTwapPrice);

        uint256 priceFromPool = (shortTwapPrice * params.baseAssetPrice) / PRECISION;
        console.log("Price from pool: %s", priceFromPool);

        if (params.useMidTwap) {
            uint256 midTwapPrice = getTwapPrice(
                pool.poolAddress,
                pool.midTwap,
                isToken0
            );
            midTwapPrice = (midTwapPrice * params.baseAssetPrice) / PRECISION;

            require(
                calculateDeviation(priceFromPool, midTwapPrice) <= pool.midDeviation,
                "Mid TWAP deviation too high"
            );
        }

        if (params.useLongTwap) {
            uint256 longTwapPrice = getTwapPrice(
                pool.poolAddress,
                pool.longTwap,
                isToken0
            );
            longTwapPrice = (longTwapPrice * params.baseAssetPrice) / PRECISION;

            require(
                calculateDeviation(priceFromPool, longTwapPrice) <= pool.longDeviation,
                "Long TWAP deviation too high"
            );
        }

        return priceFromPool;
    }

    function calculateAMMPrice(
        PriceParams memory params,
        PoolConfig memory pool
    ) internal view returns (uint256) {
        IAMM ammPool = IAMM(pool.poolAddress);

        uint8 decimalsIn = IERC20(params.asset).decimals();
        uint8 decimalsOut = IERC20(params.baseAsset).decimals();

        uint256 amountOut = ammPool.getAmountOut(params.amount, params.asset);
        uint256 normalizedAmountOut = normalizeAmount(amountOut, decimalsOut);
        return (normalizedAmountOut * params.baseAssetPrice) / PRECISION;
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
            int56 tickDiff = tickCumulatives[1] - tickCumulatives[0];
            int24 avgTick = int24(tickDiff / int56(uint56(secondsAgo)));

            uint256 price = uint256(1e9);
            int24 scaledTick = avgTick / 2;
            uint256 base = 1.0001e12;

            if (scaledTick >= 0) {
                for (int24 i = 0; i < scaledTick; i++) {
                    price = (price * base) / 1e12;
                }
                price = price * price;
            } else {
                for (int24 i = 0; i > scaledTick; i--) {
                    price = (price * 1e12) / base;
                }
                price = price * price;
            }

            if (isToken0) {
                return (1e18 * 1e9) / price;
            } else {
                return price;
            }
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