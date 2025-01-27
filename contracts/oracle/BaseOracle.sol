// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

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

contract BaseOracle is Initializable, OwnableUpgradeable {
    error EmptyPools();
    error InvalidBaseAsset();
    error TokenNotConfigured();
    error LengthMismatch();
    error MissingBaseAssetPrice();
    error NoValidPrice();
    error MidTWAPDeviationTooHigh();
    error LongTWAPDeviationTooHigh();

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
        address baseAsset;
    }

    struct TokenConfig {
        bool isConfigured;
        PoolConfig[] pools;
    }

    mapping(address => TokenConfig) public tokenConfigs;

    uint256 private constant PRECISION = 1e18;

    event PoolAdded(address token, address pool);
    event PoolRemoved(address token, address pool);
    event TokenConfigured(address token);
    event TokenRemoved(address token);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _initialOwner) public initializer {
        __Ownable_init();
        transferOwnership(_initialOwner);
    }

    function normalizeAmount(uint256 amount, uint8 decimals) internal pure returns (uint256) {
        if (decimals > 18) {
            return amount / (10 ** (decimals - 18));
        }
        return amount * (10 ** (18 - decimals));
    }

    function configureToken(address token, PoolConfig[] calldata pools) external onlyOwner {
        if (pools.length == 0) revert EmptyPools();

        delete tokenConfigs[token].pools;
        tokenConfigs[token].isConfigured = true;

        for (uint i = 0; i < pools.length; i++) {
            if (pools[i].baseAsset == address(0)) revert InvalidBaseAsset();
            tokenConfigs[token].pools.push(pools[i]);
        }

        emit TokenConfigured(token);
    }

    function removeToken(address token) external onlyOwner {
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
        if (!tokenConfigs[params.asset].isConfigured) revert TokenNotConfigured();
        if (params.baseAssets.length != params.baseAssetPrices.length) revert LengthMismatch();

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
            if (baseAssetPrice == 0) revert MissingBaseAssetPrice();

            uint256 poolPrice = calculatePoolPrice(
                params.asset,
                params.amount,
                params.useMidTwap,
                params.useLongTwap,
                baseAssetPrice,
                pools[i]
            );

            if (poolPrice < minPrice) {
                minPrice = poolPrice;
            }
        }

        if (minPrice == type(uint256).max) revert NoValidPrice();
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
        return pool.isCL ?
            calculateCLPrice(asset, useMidTwap, useLongTwap, baseAssetPrice, pool) :
            calculateAMMPrice(asset, amount, baseAssetPrice, pool);
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

        uint256 priceFromPool = (shortTwapPrice * baseAssetPrice) / PRECISION;

        if (useMidTwap) {
            uint256 midTwapPrice = getTwapPrice(
                pool.poolAddress,
                pool.midTwap,
                isToken0
            );
            midTwapPrice = (midTwapPrice * baseAssetPrice) / PRECISION;

            if (calculateDeviation(priceFromPool, midTwapPrice) > pool.midDeviation) {
                revert MidTWAPDeviationTooHigh();
            }
        }

        if (useLongTwap) {
            uint256 longTwapPrice = getTwapPrice(
                pool.poolAddress,
                pool.longTwap,
                isToken0
            );
            longTwapPrice = (longTwapPrice * baseAssetPrice) / PRECISION;

            if (calculateDeviation(priceFromPool, longTwapPrice) > pool.longDeviation) {
                revert LongTWAPDeviationTooHigh();
            }
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
            int24 halfTick = avgTick / 2;

            bool isNegative = halfTick < 0;
            uint256 absTick = uint256(uint24(isNegative ? -halfTick : halfTick));

            // Using safer power calculation
            uint256 result = 1e18;  // Start with Q96 precision
            uint256 base = 1000100000000;  // 1.0001 * 1e12

            // Exponentiation by squaring
            for (uint8 i = 0; i < 16; i++) {
                if ((absTick >> i) & 0x1 != 0) {
                    unchecked {
                        result = (result * base) / 1e12;
                    }
                }
                unchecked {
                    base = (base * base) / 1e12;
                }
            }

            // Handle negative exponent
            if (isNegative) {
                unchecked {
                    result = (1e36 / result);
                }
            }

            // Calculate final price
            if (isToken0) {
                unchecked {
                    return (1e36 / result) * 1e18 / result;  // Two divisions for token0
                }
            } else {
                unchecked {
                    return (result * result) / 1e18;  // Square for token1
                }
            }
        } catch {
            return type(uint256).max;
        }
    }

    function calculateDeviation(
        uint256 price1,
        uint256 price2
    ) internal pure returns (uint256) {
        return price1 > price2 ?
            ((price1 - price2) * PRECISION) / price2 :
            ((price2 - price1) * PRECISION) / price1;
    }

    function getFullTokenConfig(address token) external view returns (TokenConfig memory) {
        return tokenConfigs[token];
    }
}