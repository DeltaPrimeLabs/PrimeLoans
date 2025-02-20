// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./interfaces/IBaseOracle.sol";
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
    // Mapping from token addresses to their configurations.
    mapping(address => IBaseOracle.TokenConfig) public tokenConfigs;
    // Mapping from protocols to their quoter configurations.
    mapping(IBaseOracle.Protocol => IBaseOracle.QuoterConfig) public quoterConfigs;
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
        quoterConfigs[IBaseOracle.Protocol.AERODROME] = IBaseOracle.QuoterConfig({
            clQuoter: 0x66828E953cb2Ef164ef1E40653D864534251CFCB
        });

        quoterConfigs[IBaseOracle.Protocol.UNISWAP] = IBaseOracle.QuoterConfig({
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
     * @notice Configures a token with its associated pools.
     * @dev Only callable by the owner. Reverts if no pools are provided or if a base asset is invalid.
     * @param token The token address.
     * @param pools Array of pool configurations for the token.
     */
    function configureToken(address token, IBaseOracle.PoolConfig[] calldata pools)
    external
    onlyOwner
    nonReentrant
    {
        if (pools.length == 0) revert IBaseOracle.EmptyPools();
        delete tokenConfigs[token].pools;
        tokenConfigs[token].isConfigured = true;

        for (uint256 i = 0; i < pools.length; i++) {
            if (pools[i].baseAsset == address(0)) revert IBaseOracle.InvalidBaseAsset();
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
 * @notice Calculates the USD dollar price per one token (1e18 scale) of an asset based on its configured pools.
 * The final price is determined by:
 * 1. Finding maximum price among all pool quotes (both AMM and CL)
 * 2. Finding minimum price among all CL pool TWAPs
 * 3. Taking the minimum between (1) and (2)
 *
 * @param params GetDollarValueParams struct containing:
 *        - asset: The asset token address
 *        - amount: The amount in token's native decimals (e.g., 1000000 for 1 USDC)
 *        - useTwapChecks: Whether to perform TWAP deviation checks
 *        - baseAssets: Array of base asset addresses
 *        - baseAssetPrices: Array of USD prices for the base assets (1e18 scale)
 *
 * @return The USD price per one token in 1e18 scale (e.g., 1e18 represents $1.00)
 * @dev Reverts if no valid quote prices are found or if no valid TWAP prices are available
 */
    function getTokenDollarPrice(IBaseOracle.GetDollarValueParams calldata params)
    external
    view
    returns (uint256)
    {
        if (!tokenConfigs[params.asset].isConfigured) revert IBaseOracle.TokenNotConfigured();
        if (params.baseAssets.length != params.baseAssetPrices.length) revert IBaseOracle.LengthMismatch();
        if (params.amount == 0) revert IBaseOracle.InvalidInput();

        for (uint256 i = 0; i < params.baseAssetPrices.length; i++) {
            if (params.baseAssetPrices[i] == 0) revert IBaseOracle.InvalidInput();
        }

        uint256 maxQuotePrice = 0; // Track maximum of all quotes (AMM or CL)
        uint256 minTwapPrice = type(uint256).max; // Track minimum of CL TWAPs
        bool hasTwapPrice = false;

        IBaseOracle.PoolConfig[] memory pools = tokenConfigs[params.asset].pools;

        for (uint256 i = 0; i < pools.length; i++) {
            uint256 baseAssetPrice = 0;
            for (uint256 j = 0; j < params.baseAssets.length; j++) {
                if (params.baseAssets[j] == pools[i].baseAsset) {
                    baseAssetPrice = params.baseAssetPrices[j];
                    break;
                }
            }
            if (baseAssetPrice == 0) revert IBaseOracle.MissingBaseAssetPrice();

            // Get quote price (either AMM or CL)
            uint256 quotePrice = pools[i].isCL ?
                calculateCLQuotePrice(params.asset, params.amount, baseAssetPrice, pools[i]) :
                calculateAMMQuotePrice(params.asset, params.amount, baseAssetPrice, pools[i]);

            // Update max quote price if valid
            if (quotePrice != type(uint256).max && quotePrice > maxQuotePrice) {
                maxQuotePrice = quotePrice;
            }

            // For CL pools, also get TWAP price
            if (pools[i].isCL) {
                uint256 twapPrice = calculateCLTwapPrice(
                    params.asset,
                    params.amount,
                    params.useTwapChecks,
                    baseAssetPrice,
                    pools[i]
                );

                // Update min TWAP price if valid
                if (twapPrice != type(uint256).max && twapPrice < minTwapPrice) {
                    minTwapPrice = twapPrice;
                    hasTwapPrice = true;
                }
            }
        }

        // If we don't have valid prices, revert
        if (maxQuotePrice == 0) revert IBaseOracle.NoValidPrice();
        if (!hasTwapPrice) revert IBaseOracle.NoValidPrice(); // Must have at least one valid TWAP

        // Take minimum between max quote price and min TWAP price
        uint256 finalDollarValue = MathUpgradeable.min(maxQuotePrice, minTwapPrice);

        // Convert to per-token price in 1e18 scale
        return FullMath.mulDiv(finalDollarValue, PRECISION, params.amount);
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
        IBaseOracle.PoolConfig memory pool
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
        IBaseOracle.PoolConfig memory poolConfig
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
        IBaseOracle.PoolConfig memory pool
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
                    revert IBaseOracle.TWAPDeviationTooHigh();
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
        uint256 diff = (price1 > price2) ? price1 - price2 : price2 - price1;
        uint256 average = (price1 + price2) / 2;
        return FullMath.mulDiv(diff, PRECISION, average);
    }

    /**
     * @notice Retrieves the full configuration for a given token.
     * @param token The token address.
     * @return The token configuration.
     */
    function getFullTokenConfig(address token)
    external
    view
    returns (IBaseOracle.TokenConfig memory)
    {
        return tokenConfigs[token];
    }
}
