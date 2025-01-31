// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "hardhat/console.sol";

interface IUniswapV3Pool {
    function token0() external view returns (address);

    function token1() external view returns (address);

    function observe(uint32[] calldata secondsAgos)
    external
    view
    returns (int56[] memory tickCumulatives, uint160[] memory);
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
 * @dev A contract that calculates the USD value of an asset using multiple pools (Uniswap V3 or AMM-based).
 *      It supports both centralized liquidity (CL) pools and automated market maker (AMM) pools.
 *      The contract allows configuring tokens with their respective pools and calculates the minimum USD price
 *      across all configured pools for a given asset.
 */
contract BaseOracle is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    // Custom errors for better error handling
    error EmptyPools();
    error InvalidBaseAsset();
    error TokenNotConfigured();
    error LengthMismatch();
    error MissingBaseAssetPrice();
    error NoValidPrice();
    error MidTWAPDeviationTooHigh();
    error LongTWAPDeviationTooHigh();
    error InvalidInput();
    error DivisionByZero();

    /**
     * @notice Configuration for a pool used in price calculation.
     * @param poolAddress The address of the pool (Uniswap V3 or AMM).
     * @param isCL Whether the pool is a centralized liquidity (CL) pool (true) or an AMM pool (false).
     * @param tickSpacing Tick spacing for CL pools (ignored for AMM pools).
     * @param shortTwap Short TWAP period for CL pools (in seconds).
     * @param midTwap Mid TWAP period for CL pools (in seconds).
     * @param longTwap Long TWAP period for CL pools (in seconds).
     * @param midDeviation Allowed deviation percentage for mid-TWAP (in 1e18 scale).
     * @param longDeviation Allowed deviation percentage for long-TWAP (in 1e18 scale).
     * @param minLiquidity Minimum liquidity required for the pool (ignored for AMM pools).
     * @param baseAsset The base asset of the pool (e.g., USDC, WETH).
     */
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

    /**
     * @notice Configuration for a token, including its associated pools.
     * @param isConfigured Whether the token is configured.
     * @param pools Array of pools used to calculate the token's price.
     */
    struct TokenConfig {
        bool isConfigured;
        PoolConfig[] pools;
    }

    // Mapping of token addresses to their configurations
    mapping(address => TokenConfig) public tokenConfigs;

    // Constant for precision (1e18)
    uint256 private constant PRECISION = 1e18;

    // Events for tracking pool and token configuration changes
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
        transferOwnership(_initialOwner);
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
            return safeDiv(amount, 10 ** (decimals - 18));
        }
        return amount * (10 ** (18 - decimals));
    }

    /**
 * @notice Safely divides two numbers.
 * @dev Reverts if the denominator is zero. Uses unchecked arithmetic for efficiency.
 * @param numerator The numerator.
 * @param denominator The denominator.
 * @return The result of the division.
 */
    function safeDiv(uint256 numerator, uint256 denominator) internal pure returns (uint256) {
        if (denominator == 0) revert DivisionByZero();
        unchecked {
            return numerator / denominator;
        }
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
        if (pools.length == 0) revert EmptyPools(); // Ensure at least one pool is provided
        delete tokenConfigs[token].pools; // Clear existing pools for the token
        tokenConfigs[token].isConfigured = true;

        // Add each pool to the token's configuration
        for (uint i = 0; i < pools.length; i++) {
            if (pools[i].baseAsset == address(0)) revert InvalidBaseAsset(); // Ensure base asset is valid
            tokenConfigs[token].pools.push(pools[i]);
        }

        emit TokenConfigured(token); // Emit event to track token configuration
    }

    /**
     * @notice Removes a token and its associated pools from the configuration.
     * @dev Only callable by the owner.
     * @param token The address of the token to remove.
     */
    function removeToken(address token) external onlyOwner nonReentrant {
        delete tokenConfigs[token]; // Remove the token's configuration
        emit TokenRemoved(token); // Emit event to track token removal
    }

    /**
     * @notice Parameters for calculating the USD value of an asset.
     * @param asset The address of the asset to calculate the USD value for.
     * @param amount The amount of the asset.
     * @param useMidTwap Whether to use the mid-TWAP for deviation checks.
     * @param useLongTwap Whether to use the long-TWAP for deviation checks.
     * @param baseAssets Array of base assets for which prices are provided.
     * @param baseAssetPrices Array of USD prices for the base assets (in 1e18 scale).
     */
    struct GetDollarValueParams {
        address asset;
        uint256 amount;
        bool useMidTwap;
        bool useLongTwap;
        address[] baseAssets;
        uint256[] baseAssetPrices;
    }

    /**
   * @notice Calculates the USD value of an asset based on its configured pools.
 * @dev Logs the final USD price for each pool processed and the final (minimum) USD price returned.
 * @param params Parameters for calculating the USD value.
 * @return The USD value of the asset (in 1e18 scale).
 */
    function getDollarValue(GetDollarValueParams calldata params)
    external
    view
    returns (uint256)
    {
        // Step 1: Validate inputs
        if (!tokenConfigs[params.asset].isConfigured) revert TokenNotConfigured();
        if (params.baseAssets.length != params.baseAssetPrices.length) revert LengthMismatch();
        if (params.amount == 0) revert InvalidInput(); // Ensure the amount is non-zero

        // Ensure all base asset prices are non-zero
        for (uint i = 0; i < params.baseAssetPrices.length; i++) {
            if (params.baseAssetPrices[i] == 0) revert InvalidInput();
        }

        uint256 minPrice = type(uint256).max; // Initialize minPrice to the maximum possible value
        PoolConfig[] memory pools = tokenConfigs[params.asset].pools;

        // Step 2: Iterate through each pool to calculate the USD price
        for (uint i = 0; i < pools.length; i++) {
            uint256 baseAssetPrice = 0;

            // Find the USD price of the base asset for this pool
            for (uint j = 0; j < params.baseAssets.length; j++) {
                if (params.baseAssets[j] == pools[i].baseAsset) {
                    baseAssetPrice = params.baseAssetPrices[j];
                    break;
                }
            }

            // Ensure the base asset price is provided
            if (baseAssetPrice == 0) revert MissingBaseAssetPrice();

            // Calculate the USD price for this pool
            uint256 poolPrice = calculatePoolPrice(
                params.asset,
                params.amount,
                params.useMidTwap,
                params.useLongTwap,
                baseAssetPrice,
                pools[i]
            );

            console.log("Pool: %s", pools[i].poolAddress);
            console.log("Final USD Price: %s", poolPrice);

            // Update the minimum price if this pool's price is lower
            if (poolPrice < minPrice) {
                minPrice = poolPrice;
            }
        }

        // Step 3: Ensure at least one valid price was found
        if (minPrice == type(uint256).max) revert NoValidPrice();
        console.log("FINAL MIN USD PRICE: %s", minPrice);

        // Step 4: Return the final USD value (scaled by the amount)
        return (minPrice * params.amount) / PRECISION;
    }

    /**
  * @notice Calculates the USD price of an asset using a specific pool.
 * @param asset The address of the asset.
 * @param amount The amount of the asset.
 * @param useMidTwap Whether to use the mid-TWAP for deviation checks.
 * @param useLongTwap Whether to use the long-TWAP for deviation checks.
 * @param baseAssetPrice The USD price of the base asset (in 1e18 scale).
 * @param pool The pool configuration.
 * @return The USD price of the asset (in 1e18 scale).
 */
    function calculatePoolPrice(
        address asset,
        uint256 amount,
        bool useMidTwap,
        bool useLongTwap,
        uint256 baseAssetPrice,
        PoolConfig memory pool
    ) internal view returns (uint256) {
        if (pool.isCL) {
            // Use centralized liquidity (CL) logic for Uniswap V3 pools
            return calculateCLPrice(asset, useMidTwap, useLongTwap, baseAssetPrice, pool);
        }

        // Use AMM logic for other pools
        IAMM ammPool = IAMM(pool.poolAddress);

        // Cache token decimals to avoid redundant external calls
        uint8 decimalsIn = IERC20(asset).decimals();
        uint8 decimalsOut = IERC20(pool.baseAsset).decimals();

        // Calculate the amount out using unchecked arithmetic for efficiency
        uint256 amountOut;
        try ammPool.getAmountOut(amount, asset) returns (uint256 result) {
            amountOut = result;
        } catch {
            revert("External call failed");
        }

        // Normalize the amount out and calculate the final price
        uint256 normalizedAmountOut = normalizeAmount(amountOut, decimalsOut);
        return safeDiv(normalizedAmountOut * baseAssetPrice, PRECISION);
    }

    /**
     * @notice Calculates the USD price of an asset using a centralized liquidity (CL) pool.
     * @param asset The address of the asset.
     * @param useMidTwap Whether to use the mid-TWAP for deviation checks.
     * @param useLongTwap Whether to use the long-TWAP for deviation checks.
     * @param baseAssetPrice The USD price of the base asset (in 1e18 scale).
     * @param pool The pool configuration.
     * @return The USD price of the asset (in 1e18 scale).
     */
    function calculateCLPrice(
        address asset,
        bool useMidTwap,
        bool useLongTwap,
        uint256 baseAssetPrice,
        PoolConfig memory pool
    ) internal view returns (uint256) {
        IUniswapV3Pool uniPool = IUniswapV3Pool(pool.poolAddress);
        address token0Addr = uniPool.token0();
        address token1Addr = uniPool.token1();
        bool isToken0 = (token0Addr == asset);

        // Calculate the short TWAP price
        uint256 shortTwapPrice = getTwapPrice(
            pool.poolAddress,
            pool.shortTwap,
            isToken0
        );

        // Convert the raw ratio to USD price
        uint256 priceFromPool = safeDiv(shortTwapPrice * baseAssetPrice, PRECISION);

        // Perform mid-TWAP deviation check if requested
        if (useMidTwap) {
            uint256 midTwapPrice = getTwapPrice(
                pool.poolAddress,
                pool.midTwap,
                isToken0
            );
            midTwapPrice = (midTwapPrice * baseAssetPrice) / PRECISION;
            uint256 devMid = calculateDeviation(priceFromPool, midTwapPrice);
            if (devMid > pool.midDeviation) {
                revert MidTWAPDeviationTooHigh();
            }
        }

        // Perform long-TWAP deviation check if requested
        if (useLongTwap) {
            uint256 longTwapPrice = getTwapPrice(
                pool.poolAddress,
                pool.longTwap,
                isToken0
            );
            longTwapPrice = (longTwapPrice * baseAssetPrice) / PRECISION;
            uint256 devLong = calculateDeviation(priceFromPool, longTwapPrice);
            if (devLong > pool.longDeviation) {
                revert LongTWAPDeviationTooHigh();
            }
        }

        // Adjust for decimal differences between token0 and token1
        uint8 token0Decimals = IERC20(token0Addr).decimals();
        uint8 token1Decimals = IERC20(token1Addr).decimals();
        bool ratioIsToken1PerToken0 = isToken0;

        if (ratioIsToken1PerToken0) {
            if (token0Decimals > token1Decimals) {
                uint256 diff = token0Decimals - token1Decimals;
                priceFromPool *= 10 ** diff;
            } else if (token1Decimals > token0Decimals) {
                uint256 diff = token1Decimals - token0Decimals;
                if (priceFromPool != 0) {
                    priceFromPool /= 10 ** diff;
                }
            }
        } else {
            if (token1Decimals > token0Decimals) {
                uint256 diff = token1Decimals - token0Decimals;
                priceFromPool *= 10 ** diff;
            } else if (token0Decimals > token1Decimals) {
                uint256 diff = token0Decimals - token1Decimals;
                if (priceFromPool != 0) {
                    priceFromPool /= 10 ** diff;
                }
            }
        }

        return priceFromPool;
    }

    /**
     * @notice Calculates the USD price of an asset using an AMM pool.
     * @param asset The address of the asset.
     * @param amount The amount of the asset.
     * @param baseAssetPrice The USD price of the base asset (in 1e18 scale).
     * @param pool The pool configuration.
     * @return The USD price of the asset (in 1e18 scale).
     */
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

    /**
  * @notice Calculates the TWAP price for a Uniswap V3 pool.
 * @dev This function uses the `observe` function of the Uniswap V3 pool to calculate the average price over a specified time period.
 *      The formula used is: price(token1_per_token0) = 1.0001^(avgTick).
 *      If the asset is token0, the ratio represents token1_per_token0; otherwise, it represents token0_per_token1.
 * @param poolAddress The address of the Uniswap V3 pool.
 * @param secondsAgo The time period for the TWAP (in seconds).
 * @param isToken0 Whether the asset is token0 in the pool.
 * @return The TWAP price (in 1e18 scale).
 */
    function getTwapPrice(
        address poolAddress,
        uint32 secondsAgo,
        bool isToken0
    ) internal view returns (uint256) {
        // Step 1: Prepare the `secondsAgos` array for the `observe` function.
        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = secondsAgo; // Time in the past
        secondsAgos[1] = 0;          // Current block timestamp

        try IUniswapV3Pool(poolAddress).observe(secondsAgos) returns (
            int56[] memory tickCumulatives,
            uint160[] memory /* unused */
        ) {
            // Step 2: Calculate the average tick over the specified time period.
            int24 avgTick = calculateAverageTick(tickCumulatives, secondsAgo);

            // Step 3: Adjust the sign of the average tick if the asset is not token0.
            if (!isToken0) {
                avgTick = - avgTick; // Flip the sign of the tick to reverse the ratio
            }

            // Step 4: Convert the average tick to a price using fixed-point exponentiation.
            return calculateExponentiation(avgTick);
        } catch {
            // Step 5: Handle errors gracefully.
            return type(uint256).max;
        }
    }

    /**
 * @notice Efficiently calculates 1.0001^avgTick using fixed-point arithmetic.
 * @dev This function uses an iterative approach to compute the exponentiation.
 *      The result is scaled to 1e18 precision.
 * @param avgTick The average tick over the specified time period.
 * @return The price (in 1e18 scale).
 */
    function calculateExponentiation(int24 avgTick) internal pure returns (uint256) {
        // Step 1: Split the average tick into two halves to avoid overflow.
        int24 halfTick = avgTick / 2;
        bool halfTickIsNeg = (halfTick < 0);
        uint256 absHalfTick = uint256(uint24(halfTickIsNeg ? - halfTick : halfTick));

        // Step 2: Perform fixed-point exponentiation for the first half-tick.
        uint256 result = 1e18; // Initialize the result to 1 (scaled to 1e18)
        uint256 base = 1000100000000; // Base = 1.0001 scaled to 1e12

        for (uint8 i = 0; i < 20 && absHalfTick > 0; i++) {
            if ((absHalfTick >> i) & 1 != 0) {
                // Multiply the result by the base if the current bit is set.
                result = (result * base) / 1e12;
            }
            // Square the base for the next iteration.
            base = (base * base) / 1e12;
        }

        // Step 3: Handle negative half-ticks.
        if (halfTickIsNeg) {
            result = (1e36 / result); // Reciprocal in 1e36 scale, then scale back to 1e18
        }

        // Step 4: Square the result to account for the split into half-ticks.
        return (result * result) / 1e18;
    }

/**
 * @notice Calculates the average tick over a specified time period.
 * @param tickCumulatives Cumulative tick values returned by the `observe` function.
 * @param secondsAgo The time period for the TWAP (in seconds).
 * @return The average tick over the specified time period.
 */
    function calculateAverageTick(int56[] memory tickCumulatives, uint32 secondsAgo)
    internal
    pure
    returns (int24)
    {
        int56 tickDiff = (tickCumulatives[1] - tickCumulatives[0]);
        return int24(tickDiff / int56(uint56(secondsAgo)));
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
            return type(uint256).max; // Return max uint if either price is zero
        }
        return (price1 > price2)
            ? safeDiv((price1 - price2) * PRECISION, price2)
            : safeDiv((price2 - price1) * PRECISION, price1);
    }

    /**
     * @notice Retrieves the full configuration for a token.
     * @param token The address of the token.
     * @return The token's configuration.
     */
    function getFullTokenConfig(address token)
    external
    view
    returns (TokenConfig memory)
    {
        return tokenConfigs[token];
    }
}