// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "../lib/uniswap-v3/FixedPoint96.sol";
import "../lib/uniswap-v3/FullMath.sol";
import "../lib/uniswap-v3/TickMath.sol";
import "./interfaces/IQuoter.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeCastUpgradeable.sol";

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
 * @dev Calculates the USD value of an asset using multiple liquidity pools.
 *
 * This version converts the standardized input amount (1e18‑scaled) into the asset’s native units
 * so that pool price calculations work properly for tokens with any number of decimals.
 *
 * IMPORTANT: The function getTokenDollarPrice returns the _dollar value per one token_.
 * It uses the input amount for the quotes but then divides the resulting total USD value
 * by that native amount.
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
     * @param twapChecks Array of additional TWAP checks.
     * @param baseAsset The base asset of the pool (e.g. USDC, WETH).
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
     * @param isConfigured Indicates whether the token is configured.
     * @param pools Array of pools used to calculate the token's price.
     */
    struct TokenConfig {
        bool isConfigured;
        PoolConfig[] pools;
    }

    // Mapping from token addresses to their configurations.
    mapping(address => TokenConfig) public tokenConfigs;
    // Mapping from protocols to their quoter configurations.
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
        __ReentrancyGuard_init();
        transferOwnership(_initialOwner);

        // Initialize quoter configurations.
        quoterConfigs[Protocol.AERODROME] = QuoterConfig({
            clQuoter: 0x66828E953cb2Ef164ef1E40653D864534251CFCB
        });

        quoterConfigs[Protocol.UNISWAP] = QuoterConfig({
            clQuoter: 0x222cA98F00eD15B1faE10B61c277703a194cf5d2
        });
    }

    /**
     * @notice Normalizes an amount (from native token units) to 1e18 scale.
     * @param amount The amount to normalize.
     * @param decimals The number of decimals for the token.
     * @return The normalized amount (1e18 scale).
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
     * @notice Converts an amount from standardized (1e18) scale to the token’s native units.
     * @param amount The standardized amount (1e18 scale).
     * @param decimals The token's decimals.
     * @return The amount in the token’s native representation.
     */
    function denormalizeAmount(uint256 amount, uint8 decimals)
    internal
    pure
    returns (uint256)
    {
        if (decimals > 18) {
            return amount * (10 ** (decimals - 18));
        } else if (decimals < 18) {
            return amount / (10 ** (18 - decimals));
        }
        return amount;
    }

    /**
     * @notice Configures a token with its associated pools.
     * @dev Only callable by the owner. Reverts if no pools are provided or if a base asset is invalid.
     * @param token The token address.
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

        for (uint256 i = 0; i < pools.length; i++) {
            if (pools[i].baseAsset == address(0)) revert InvalidBaseAsset();
            tokenConfigs[token].pools.push(pools[i]);
        }

        emit TokenConfigured(token);
    }

    /**
     * @notice Removes a token and its associated pools from the configuration.
     * @dev Only callable by the owner.
     * @param token The token address.
     */
    function removeToken(address token) external onlyOwner nonReentrant {
        delete tokenConfigs[token];
        emit TokenRemoved(token);
    }

    /**
     * @notice Parameters for calculating the USD dollar price of an asset.
     * @param asset The asset token address.
     * @param amount The amount of the asset in standardized 1e18 scale.
     * @param useTwapChecks Whether to perform TWAP deviation checks.
     * @param baseAssets Array of base asset addresses.
     * @param baseAssetPrices Array of USD prices for the base assets (1e18 scale).
     */
    struct GetDollarValueParams {
        address asset;
        uint256 amount;
        bool useTwapChecks;
        address[] baseAssets;
        uint256[] baseAssetPrices;
    }

    /**
 * @notice Calculates the USD dollar price per one token (1e18 scale) of an asset based on its configured pools.
 *
 * @param params GetDollarValueParams struct containing:
 *        - asset: The asset token address
 *        - amount: The amount in token's native decimals (e.g., 1000000 for 1 USDC)
 *        - useTwapChecks: Whether to perform TWAP deviation checks
 *        - baseAssets: Array of base asset addresses
 *        - baseAssetPrices: Array of USD prices for the base assets (1e18 scale)
 *
 * @return The USD price per one token in 1e18 scale (e.g., 1e18 represents $1.00)
 */
    function getTokenDollarPrice(GetDollarValueParams calldata params)
    external
    view
    returns (uint256)
    {
        if (!tokenConfigs[params.asset].isConfigured) revert TokenNotConfigured();
        if (params.baseAssets.length != params.baseAssetPrices.length) revert LengthMismatch();
        if (params.amount == 0) revert InvalidInput();

        for (uint256 i = 0; i < params.baseAssetPrices.length; i++) {
            if (params.baseAssetPrices[i] == 0) revert InvalidInput();
        }

        uint256 minTotalDollarValue = type(uint256).max;
        PoolConfig[] memory pools = tokenConfigs[params.asset].pools;

        for (uint256 i = 0; i < pools.length; i++) {
            uint256 baseAssetPrice = 0;
            for (uint256 j = 0; j < params.baseAssets.length; j++) {
                if (params.baseAssets[j] == pools[i].baseAsset) {
                    baseAssetPrice = params.baseAssetPrices[j];
                    break;
                }
            }
            if (baseAssetPrice == 0) revert MissingBaseAssetPrice();

            uint256 poolDollarValue = calculatePoolPrice(
                params.asset,
                params.amount,
                params.useTwapChecks,
                baseAssetPrice,
                pools[i]
            );

            if (poolDollarValue < minTotalDollarValue) {
                minTotalDollarValue = poolDollarValue;
            }
        }

        if (minTotalDollarValue == type(uint256).max) revert NoValidPrice();
        return FullMath.mulDiv(minTotalDollarValue, PRECISION, params.amount);
    }

    /**
     * @notice Calculates the total USD dollar value (1e18 scale) for a given native amount using a specific pool.
     * @param asset The asset token address.
     * @param amount The asset amount in native units.
     * @param useTwapChecks Whether to perform TWAP deviation checks.
     * @param baseAssetPrice The USD price of the pool's base asset (1e18 scale).
     * @param pool The pool configuration.
     * @return The total USD dollar value (1e18 scale) for the provided amount.
     */
    function calculatePoolPrice(
        address asset,
        uint256 amount,
        bool useTwapChecks,
        uint256 baseAssetPrice,
        PoolConfig memory pool
    ) internal view returns (uint256) {
        uint256 quoteDollarValue;
        uint256 twapDollarValue;

        if (pool.isCL) {
            quoteDollarValue = calculateCLQuotePrice(asset, amount, baseAssetPrice, pool);
            twapDollarValue = calculateCLTwapPrice(asset, amount, useTwapChecks, baseAssetPrice, pool);
            return MathUpgradeable.min(quoteDollarValue, twapDollarValue);
        } else {
            return calculateAMMQuotePrice(asset, amount, baseAssetPrice, pool);
        }
    }

    /**
     * @notice Obtains the total USD dollar value using a CL (centralized liquidity) pool quote.
     * @param asset The asset token address.
     * @param amount The asset amount in native units.
     * @param baseAssetPrice The USD price of the pool's base asset (1e18 scale).
     * @param pool The pool configuration.
     * @return The total USD dollar value (1e18 scale) for the provided amount.
     */
    function calculateCLQuotePrice(
        address asset,
        uint256 amount,
        uint256 baseAssetPrice,
        PoolConfig memory pool
    ) internal view returns (uint256) {
        address quoter = quoterConfigs[pool.protocol].clQuoter;
        IUniswapV3Pool uniPool = IUniswapV3Pool(pool.poolAddress);
        address token0 = uniPool.token0();
        address token1 = uniPool.token1();
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

        (uint256 amountOut, , , ) = IQuoter(quoter).quoteExactInputSingleWithPool(params);
        uint256 normalizedAmountOut = normalizeAmount(
            amountOut,
            IERC20(isToken0 ? token1 : token0).decimals()
        );
        return FullMath.mulDiv(normalizedAmountOut, baseAssetPrice, PRECISION);
    }

    /**
     * @notice Obtains the total USD dollar value using an AMM pool quote.
     * @param asset The asset token address.
     * @param amount The asset amount in native units.
     * @param baseAssetPrice The USD price of the pool's base asset (1e18 scale).
     * @param poolConfig The pool configuration.
     * @return The total USD dollar value (1e18 scale) for the provided amount.
     */
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
            if (reserve0 == 0 || reserve1 == 0) return type(uint256).max;

            address token0 = IUniswapV2Pair(poolConfig.poolAddress).token0();
            (uint256 reserveIn, uint256 reserveOut) = token0 == asset
                ? (uint256(reserve0), uint256(reserve1))
                : (uint256(reserve1), uint256(reserve0));

            uint256 denominator = (reserveIn * 1000) + amount * 997;
            uint256 amountOut = amount * 997 * reserveOut / denominator;

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

    /**
     * @notice Obtains the total USD dollar value using a CL pool TWAP quote.
     * @param asset The asset token address.
     * @param amount The asset amount in native units.
     * @param useTwapChecks Whether to perform TWAP deviation checks.
     * @param baseAssetPrice The USD price of the pool's base asset (1e18 scale).
     * @param pool The pool configuration.
     * @return The total USD dollar value (1e18 scale) for the provided amount.
     */
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
            for (uint256 i = 0; i < pool.twapChecks.length; i++) {
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
     * @param price The price value.
     * @param token0 The address of token0.
     * @param token1 The address of token1.
     * @param ratioIsToken1PerToken0 True if the ratio is token1 per token0.
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

    /**
     * @notice Calculates the TWAP unit price (in 1e18 scale) for a Uniswap V3 pool.
     * @param poolAddress The pool address.
     * @param secondsAgo The TWAP duration in seconds.
     * @param isToken0 True if the asset is token0.
     * @return The unit price (1e18 scale) from TickMath.
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

            uint160 sqrtPriceX96 = TickMath.getSqrtRatioAtTick(avgTick);
            uint256 unitPrice = FullMath.mulDiv(
                uint256(sqrtPriceX96),
                uint256(sqrtPriceX96) * PRECISION,
                FixedPoint96.Q96 * FixedPoint96.Q96
            );
            return unitPrice;
        } catch {
            return type(uint256).max;
        }
    }

    /**
     * @notice Calculates the average tick over a specified period.
     * @param tickCumulatives The cumulative tick values.
     * @param secondsAgo The time period in seconds.
     * @return The average tick.
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
     * @notice Calculates the percentage deviation between two prices (1e18 scale).
     * @param price1 The first price.
     * @param price2 The second price.
     * @return The deviation percentage (1e18 scale).
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
     * @notice Retrieves the full configuration for a given token.
     * @param token The token address.
     * @return The token configuration.
     */
    function getFullTokenConfig(address token)
    external
    view
    returns (TokenConfig memory)
    {
        return tokenConfigs[token];
    }
}
