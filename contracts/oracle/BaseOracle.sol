// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "../lib/uniswap-v3/FixedPoint96.sol";
import "../lib/uniswap-v3/FullMath.sol";
import "../lib/uniswap-v3/TickMath.sol";
import "./interfaces/IQuoter.sol"; // For additional math utilities if needed.
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol"; // For safe downcasting.
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol"; // Uniswap V3’s full-precision multiplication/division.
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol"; // Provides Q96 constant.

import "@openzeppelin/contracts-upgradeable/utils/math/SafeCastUpgradeable.sol";
import "hardhat/console.sol";

// QuoterV1 and V2 core params structs




// Minimal ABIs
interface IQuoterV2 {
    struct QuoteExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint24 fee;
        uint160 sqrtPriceLimitX96;
    }

    function quoteExactInputSingle(QuoteExactInputSingleParams memory params)
    external
    view
    returns (
        uint256 amountOut,
        uint160 sqrtPriceX96After,
        uint32 initializedTicksCrossed,
        uint256 gasEstimate
    );
}

interface IUniswapV2Router02 {
    function factory() external pure returns (address);
}

interface IUniswapV2Factory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

interface IUniswapV2Pair {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (
        uint112 reserve0,
        uint112 reserve1,
        uint32 blockTimestampLast
    );
}

interface IUniswapV3Pool {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function observe(uint32[] calldata secondsAgos)
    external
    view
    returns (int56[] memory tickCumulatives, uint160[] memory);
    function fee() external view returns (uint24);
}

interface IERC20 {
    function decimals() external view returns (uint8);
}

interface IAMM {
    function getAmountOut(uint256 amountIn, address tokenIn)
    external
    view
    returns (uint256);
}

/**
 * @title BaseOracle
 * @dev Calculates the USD value of an asset using multiple pools.
 *      The contract supports both centralized liquidity (CL) pools and AMM pools.
 *
 *      In this refactored version, each pool config stores a single short TWAP duration (used
 *      to derive the price) and an array of TWAP deviation checks. Each deviation check
 *      consists of a TWAP duration and a maximum allowed deviation. When enabled, the oracle
 *      will iterate over these checks to verify that the short TWAP price does not deviate
 *      too much from prices calculated over other durations.
 */
contract BaseOracle is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    // Custom errors for better error handling.
    error EmptyPools();
    error InvalidBaseAsset();
    error TokenNotConfigured();
    error LengthMismatch();
    error MissingBaseAssetPrice();
    error NoValidPrice();
    error TWAPDeviationTooHigh();
    error InvalidInput();
    error DivisionByZero();

    enum Protocol {
        UNISWAP,
        AERODROME
    }

    struct QuoterConfig {
        address clQuoter;
    }

    /**
     * @notice Represents a deviation check for a given TWAP duration.
     * @param duration The TWAP duration (in seconds).
     * @param maxDeviation Maximum allowed deviation (in 1e18 scale).
     */
    struct TWAPCheck {
        uint32 duration;
        uint256 maxDeviation;
    }

    /**
     * @notice Configuration for a pool used in price calculation.
     * @param poolAddress The address of the pool (Uniswap V3 or AMM).
     * @param isCL Whether the pool is a centralized liquidity (CL) pool (true) or an AMM pool (false).
     * @param tickSpacing Tick spacing for CL pools (ignored for AMM pools).
     * @param shortTwap The primary (short) TWAP duration (in seconds) used for the price calculation.
     * @param twapChecks Array of additional TWAP checks (each with its own duration and max deviation).
     * @param baseAsset The base asset of the pool (e.g., USDC, WETH).
     * @param protocol The protocol this pool belongs to (Uniswap or Aerodrome).
     */
    struct PoolConfig {
        address poolAddress;
        bool isCL;
        int24 tickSpacing;
        uint32 shortTwap;
        TWAPCheck[] twapChecks;
        address baseAsset;
        Protocol protocol;
    }

    /**
     * @notice Configuration for a token, including its associated pools.
     * @param isConfigured Whether the token is configured.
     * @param pools Array of pools used to calculate the token's price.
     */
    struct TokenConfig {
        bool isConfigured;
        PoolConfig[] pools;
    }

    // Mapping of token addresses to their configurations.
    mapping(address => TokenConfig) public tokenConfigs;

    // Mapping of protocols to their quoter configurations.
    mapping(Protocol => QuoterConfig) public quoterConfigs;


    // Constant for precision (1e18).
    uint256 private constant PRECISION = 1e18;

    // Events for tracking configuration changes.
    event PoolAdded(address indexed token, address indexed pool);
    event PoolRemoved(address indexed token, address indexed pool);
    event TokenConfigured(address indexed token);
    event TokenRemoved(address indexed token);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the contract and sets the initial owner.
     * @param _initialOwner The address of the initial owner.
     */
    function initialize(address _initialOwner) public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();  // Initialize reentrancy protection.
        transferOwnership(_initialOwner);

        // Initialize quoter configs
        quoterConfigs[Protocol.AERODROME] = QuoterConfig({
            clQuoter: 0x66828E953cb2Ef164ef1E40653D864534251CFCB
        });

        quoterConfigs[Protocol.UNISWAP] = QuoterConfig({
            clQuoter: 0x222cA98F00eD15B1faE10B61c277703a194cf5d2
        });
    }

    /**
     * @notice Normalizes an amount to 1e18 scale based on the token's decimals.
     * @param amount The amount to normalize.
     * @param decimals The number of decimals for the token.
     * @return The normalized amount in 1e18 scale.
     */
    function normalizeAmount(uint256 amount, uint8 decimals)
    internal
    pure
    returns (uint256)
    {
        if (decimals > 18) {
            return amount / (10 ** (decimals - 18));
        }
        return amount * (10 ** (18 - decimals));
    }

    /**
     * @notice Configures a token with its associated pools.
     * @dev Only callable by the owner. Reverts if no pools are provided or if a base asset is invalid.
     * @param token The address of the token to configure.
     * @param pools Array of pool configurations for the token.
     */
    function configureToken(address token, PoolConfig[] calldata pools)
    external
    onlyOwner
    nonReentrant
    {
        if (pools.length == 0) revert EmptyPools();
        delete tokenConfigs[token].pools;
        tokenConfigs[token].isConfigured = true;

        for (uint i = 0; i < pools.length; i++) {
            if (pools[i].baseAsset == address(0)) revert InvalidBaseAsset();
            tokenConfigs[token].pools.push(pools[i]);
        }

        emit TokenConfigured(token);
    }

    /**
     * @notice Removes a token and its associated pools from the configuration.
     * @dev Only callable by the owner.
     * @param token The address of the token to remove.
     */
    function removeToken(address token) external onlyOwner nonReentrant {
        delete tokenConfigs[token];
        emit TokenRemoved(token);
    }

    /**
     * @notice Parameters for calculating the USD value of an asset.
     * @param asset The address of the asset.
     * @param amount The amount of the asset.
     * @param useTwapChecks Whether to perform TWAP deviation checks (using the pool's TWAPCheck array).
     * @param baseAssets Array of base assets for which prices are provided.
     * @param baseAssetPrices Array of USD prices for the base assets (in 1e18 scale).
     */
    struct GetDollarValueParams {
        address asset;
        uint256 amount;
        bool useTwapChecks;
        address[] baseAssets;
        uint256[] baseAssetPrices;
    }

    /**
     * @notice Calculates the USD value of an asset based on its configured pools.
     *         Each pool returns the full USD value for the provided amount.
     */
    function getDollarValue(GetDollarValueParams calldata params)
    external
    view
    returns (uint256)
    {
        if (!tokenConfigs[params.asset].isConfigured) revert TokenNotConfigured();
        if (params.baseAssets.length != params.baseAssetPrices.length) revert LengthMismatch();
        if (params.amount == 0) revert InvalidInput();

        for (uint i = 0; i < params.baseAssetPrices.length; i++) {
            if (params.baseAssetPrices[i] == 0) revert InvalidInput();
        }

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
                params.useTwapChecks,
                baseAssetPrice,
                pools[i]
            );

            console.log("Pool: %s", pools[i].poolAddress);
            console.log("Final USD Price: %s", poolPrice);

            if (poolPrice < minPrice) {
                minPrice = poolPrice;
            }
        }

        if (minPrice == type(uint256).max) revert NoValidPrice();
        console.log("FINAL MIN USD PRICE: %s", minPrice);
        return minPrice;
    }

    /**
     * @notice Calculates the USD price of an asset using a specific pool.
     * @param asset The address of the asset.
     * @param amount The amount of the asset.
     * @param useTwapChecks Whether to perform TWAP deviation checks.
     * @param baseAssetPrice The USD price of the pool’s base asset (in 1e18 scale).
     * @param pool The pool configuration.
     * @return The USD price of the asset (in 1e18 scale).
     */
    function calculatePoolPrice(
        address asset,
        uint256 amount,
        bool useTwapChecks,
        uint256 baseAssetPrice,
        PoolConfig memory pool
    ) internal view returns (uint256) {
        uint256 quotePrice;
        uint256 twapPrice;

        console.log('X poolAddress: %s', pool.poolAddress);
        console.log('X isCL: %s', pool.isCL);
        if (pool.isCL) {
            quotePrice = calculateCLQuotePrice(asset, amount, baseAssetPrice, pool);
            console.log('X quotePrice: %s', quotePrice);
            twapPrice = calculateCLTwapPrice(asset, amount, useTwapChecks, baseAssetPrice, pool);
            console.log('X twapPrice: %s', twapPrice);
            return MathUpgradeable.min(quotePrice, twapPrice);
        } else {
            return calculateAMMQuotePrice(asset, amount, baseAssetPrice, pool);
        }
    }

    function calculateCLQuotePrice(
        address asset,
        uint256 amount,
        uint256 baseAssetPrice,
        PoolConfig memory pool
    ) internal view returns (uint256) {
        address quoter = quoterConfigs[pool.protocol].clQuoter;

        // Determine tokens from the pool (assume pool is Uniswap V3-like)
        IUniswapV3Pool uniPool = IUniswapV3Pool(pool.poolAddress);
        address token0 = uniPool.token0();
        address token1 = uniPool.token1();
        // Use the same ordering as your off-chain call:
        bool isToken0 = (token0 == asset);

        IQuoter.QuoteExactInputSingleWithPoolParams memory params =
                            IQuoter.QuoteExactInputSingleWithPoolParams({
                tokenIn: asset,
                tokenOut: isToken0 ? token1 : token0,
                amountIn: amount,
                pool: pool.poolAddress,
                fee: uniPool.fee(),
                sqrtPriceLimitX96: 0
            });

        (uint256 amountOut, /* uint160 sqrtPriceX96After */, /* int24 tickAfter */, /* uint256 gasEstimate */) = IQuoter(quoter).quoteExactInputSingleWithPool(params);

        uint256 normalizedAmountOut = normalizeAmount(amountOut, IERC20(isToken0 ? token1 : token0).decimals());
        return FullMath.mulDiv(normalizedAmountOut, baseAssetPrice, PRECISION);
    }

    function calculateAMMQuotePrice(
        address asset,
        uint256 amount,
        uint256 baseAssetPrice,
        PoolConfig memory poolConfig
    ) internal view returns (uint256) {
        try IUniswapV2Pair(poolConfig.poolAddress).getReserves() returns (
            uint112 reserve0,
            uint112 reserve1,
            uint32 /* blockTimestampLast */
        ) {
            // Check for zero reserves
            if (reserve0 == 0 || reserve1 == 0) return type(uint256).max;

            address token0 = IUniswapV2Pair(poolConfig.poolAddress).token0();
            (uint256 reserveIn, uint256 reserveOut) = token0 == asset
                ? (uint256(reserve0), uint256(reserve1))
                : (uint256(reserve1), uint256(reserve0));


            uint256 denominator = (reserveIn * 1000) + amount * 997;
            uint256 amountOut = amount * 997 * reserveOut / denominator;

            // Check for minimum output amount
            if (amountOut == 0) return type(uint256).max;

            uint256 normalizedAmountOut;
            {
                uint8 decimalsOut = IERC20(poolConfig.baseAsset).decimals();
                normalizedAmountOut = normalizeAmount(amountOut, decimalsOut);
            }
            return FullMath.mulDiv(normalizedAmountOut, baseAssetPrice, PRECISION);
        } catch {
            return type(uint256).max;
        }
    }


    function calculateCLTwapPrice(
        address asset,
        uint256 amount,
        bool useTwapChecks,
        uint256 baseAssetPrice,
        PoolConfig memory pool
    ) internal view returns (uint256) {
        IUniswapV3Pool uniPool = IUniswapV3Pool(pool.poolAddress);
        address token0 = uniPool.token0();
        bool isToken0 = (token0 == asset);

        uint256 shortTwapPrice = getTwapPrice(pool.poolAddress, pool.shortTwap, isToken0);
        uint256 priceFromPool = FullMath.mulDiv(shortTwapPrice, baseAssetPrice, PRECISION);

        if (useTwapChecks) {
            for (uint i = 0; i < pool.twapChecks.length; i++) {
                uint32 duration = pool.twapChecks[i].duration;
                uint256 maxDeviation = pool.twapChecks[i].maxDeviation;
                uint256 twapPrice = getTwapPrice(pool.poolAddress, duration, isToken0);
                twapPrice = FullMath.mulDiv(twapPrice, baseAssetPrice, PRECISION);
                if (calculateDeviation(priceFromPool, twapPrice) > maxDeviation) {
                    revert TWAPDeviationTooHigh();
                }
            }
        }

        priceFromPool = adjustForDecimals(
            priceFromPool,
            token0,
            uniPool.token1(),
            isToken0
        );

        return FullMath.mulDiv(priceFromPool, amount, PRECISION);
    }

    /**
     * @notice Adjusts the price to account for differences in token decimals.
     * @param price The price to adjust.
     * @param token0 The address of token0.
     * @param token1 The address of token1.
     * @param ratioIsToken1PerToken0 Indicates whether the ratio is token1 per token0.
     * @return The adjusted price.
     */
    function adjustForDecimals(
        uint256 price,
        address token0,
        address token1,
        bool ratioIsToken1PerToken0
    ) internal view returns (uint256) {
        uint8 token0Decimals = IERC20(token0).decimals();
        uint8 token1Decimals = IERC20(token1).decimals();

        if (ratioIsToken1PerToken0) {
            if (token0Decimals > token1Decimals) {
                uint256 diff = token0Decimals - token1Decimals;
                price *= 10 ** diff;
            } else if (token1Decimals > token0Decimals) {
                uint256 diff = token1Decimals - token0Decimals;
                if (price != 0) {
                    price /= 10 ** diff;
                }
            }
        } else {
            if (token1Decimals > token0Decimals) {
                uint256 diff = token1Decimals - token0Decimals;
                price *= 10 ** diff;
            } else if (token0Decimals > token1Decimals) {
                uint256 diff = token0Decimals - token1Decimals;
                if (price != 0) {
                    price /= 10 ** diff;
                }
            }
        }
        return price;
    }

    // Helper function to convert bytes to hex string
    function toHex(bytes memory data) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(2 * data.length);
        for (uint i = 0; i < data.length; i++) {
            str[2*i] = alphabet[uint8(data[i] >> 4)];
            str[2*i+1] = alphabet[uint8(data[i] & 0x0f)];
        }
        return string(str);
    }


    /**
     * @notice Calculates the TWAP price for a Uniswap V3 pool.
     * @dev Uses the pool’s observe method to compute the average tick over a specified period,
     *      converts the tick to a sqrt price (Q64.96), and then converts that value to a 1e18‑scaled price.
     * @param poolAddress The address of the Uniswap V3 pool.
     * @param secondsAgo The TWAP duration (in seconds).
     * @param isToken0 Whether the asset is token0 in the pool.
     * @return The TWAP price (in 1e18 scale).
     */
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
            uint160[] memory /* unused */
        ) {
            int24 avgTick = calculateAverageTick(tickCumulatives, secondsAgo);
            if (!isToken0) {
                avgTick = -avgTick;
            }
            console.log("avgTick: %s");
            console.logInt(avgTick);

            uint160 sqrtPriceX96 = TickMath.getSqrtRatioAtTick(avgTick);
            console.log("sqrtPriceX96: %s", sqrtPriceX96);

            uint256 price = FullMath.mulDiv(
                uint256(sqrtPriceX96),
                uint256(sqrtPriceX96) * PRECISION,
                FixedPoint96.Q96 * FixedPoint96.Q96
            );
            console.log("Price from TickMath: %s", price);
            return price;
        } catch {
            return type(uint256).max;
        }
    }

    /**
     * @notice Calculates the average tick over a specified period.
     * @param tickCumulatives The cumulative tick values from the observe call.
     * @param secondsAgo The duration (in seconds).
     * @return The average tick over the period.
     */
    function calculateAverageTick(int56[] memory tickCumulatives, uint32 secondsAgo)
    internal
    pure
    returns (int24)
    {
        int56 tickDiff = tickCumulatives[1] - tickCumulatives[0];
        return SafeCastUpgradeable.toInt24(tickDiff / int56(uint56(secondsAgo)));
    }

    /**
     * @notice Calculates the percentage deviation between two prices.
     * @param price1 The first price (in 1e18 scale).
     * @param price2 The second price (in 1e18 scale).
     * @return The deviation percentage (in 1e18 scale).
     */
    function calculateDeviation(uint256 price1, uint256 price2)
    internal
    pure
    returns (uint256)
    {
        if (price1 == 0 || price2 == 0) {
            return type(uint256).max;
        }
        return (price1 > price2)
            ? FullMath.mulDiv((price1 - price2), PRECISION, price2)
            : FullMath.mulDiv((price2 - price1), PRECISION, price1);
    }

    /**
     * @notice Retrieves the full configuration for a token.
     */
    function getFullTokenConfig(address token)
    external
    view
    returns (TokenConfig memory)
    {
        return tokenConfigs[token];
    }
}
