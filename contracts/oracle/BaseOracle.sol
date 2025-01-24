// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IUniswapV3Pool {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function observe(uint32[] calldata secondsAgos) external view returns (int56[] memory tickCumulatives, uint160[] memory);
}

interface IQuoter {
    struct QuoteExactInputSingleV3Params {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        int24 tickSpacing;
        uint160 sqrtPriceLimitX96;
    }

    function quoteExactInputSingleV3(QuoteExactInputSingleV3Params memory params)
    external returns (uint256 amountOut, uint160, uint32, uint256);
}

interface IERC20 {
    function decimals() external view returns (uint8);
}

interface IAMM {
    function getAmountOut(uint256 amountIn, address tokenIn) external view returns (uint256);
}

contract BaseOracle {
    // Normalizes amount from token decimals to PRECISION
    function normalizeAmount(
        uint256 amount,
        uint8 decimals
    ) internal pure returns (uint256) {
        if (decimals > 18) {
            return amount / (10 ** (decimals - 18));
        }
        return amount * (10 ** (18 - decimals));
    }
    struct PoolConfig {
        address poolAddress;
        bool isCL;           // true for CL pools, false for AMM
        int24 tickSpacing;   // used for CL pools
        uint32 shortTwap;    // duration for short TWAP (e.g., 30 seconds)
        uint32 midTwap;      // duration for mid TWAP (e.g., 1 hour)
        uint32 longTwap;     // duration for long TWAP (e.g., 24 hours)
        uint256 midDeviation;  // Allowed deviation for mid TWAP
        uint256 longDeviation; // Allowed deviation for long TWAP
        uint256 minLiquidity; // Minimum liquidity threshold
    }

    struct TokenConfig {
        bool isConfigured;
        PoolConfig[] pools;
    }

    address public admin;
    address public quoter;
    mapping(address => TokenConfig) public tokenConfigs;

    uint256 private constant PRECISION = 1e18;

    event PoolAdded(address token, address pool);
    event PoolRemoved(address token, address pool);
    event TokenConfigured(address token);
    event TokenRemoved(address token);

    constructor(address _quoter) {
        admin = msg.sender;
        quoter = _quoter;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    function configureToken(
        address token,
        PoolConfig[] calldata pools
    ) external onlyAdmin {
        require(pools.length > 0, "Empty pools");
        delete tokenConfigs[token].pools;

        tokenConfigs[token].isConfigured = true;
        for(uint i = 0; i < pools.length; i++) {
            tokenConfigs[token].pools.push(pools[i]);
        }

        emit TokenConfigured(token);
    }

    function removeToken(address token) external onlyAdmin {
        delete tokenConfigs[token];
        emit TokenRemoved(token);
    }

    function getDollarValue(
        address asset,
        uint256 amount,
        address baseAsset,
        uint256 baseAssetPrice,
        bool useMidTwap,
        bool useLongTwap
    ) external view returns (uint256) {
        require(tokenConfigs[asset].isConfigured, "Token not configured");

        uint256 minPrice = type(uint256).max;
        PoolConfig[] memory pools = tokenConfigs[asset].pools;

        for(uint i = 0; i < pools.length; i++) {
            PoolConfig memory pool = pools[i];

            uint256 poolPrice = calculatePoolPrice(
                asset,
                baseAsset,
                baseAssetPrice,
                pool,
                useMidTwap,
                useLongTwap
            );

            if(poolPrice < minPrice) {
                minPrice = poolPrice;
            }
        }

        require(minPrice != type(uint256).max, "No valid price");
        return (minPrice * amount) / PRECISION;
    }

    function calculatePoolPrice(
        address asset,
        address baseAsset,
        uint256 baseAssetPrice,
        PoolConfig memory pool,
        bool useMidTwap,
        bool useLongTwap
    ) internal view returns (uint256) {
        if(pool.isCL) {
            return calculateCLPrice(
                asset,
                baseAsset,
                baseAssetPrice,
                pool,
                useMidTwap,
                useLongTwap
            );
        } else {
            return calculateAMMPrice(
                asset,
                baseAsset,
                baseAssetPrice,
                pool
            );
        }
    }

    function calculateCLPrice(
        address asset,
        address baseAsset,
        uint256 baseAssetPrice,
        PoolConfig memory pool,
        bool useMidTwap,
        bool useLongTwap
    ) internal view returns (uint256) {
        IUniswapV3Pool uniPool = IUniswapV3Pool(pool.poolAddress);

        // Determine token ordering
        bool isToken0 = uniPool.token0() == asset;

        // Get quote price
        uint256 quotePrice = getQuotePrice(
            asset,
            baseAsset,
            pool.poolAddress,
            pool.tickSpacing,
            isToken0
        );

        // Get short TWAP price
        uint256 shortTwapPrice = getTwapPrice(
            pool.poolAddress,
            pool.shortTwap,
            isToken0
        );

        // Calculate initial price as min(quote, shortTWAP)
        uint256 priceFromPool = quotePrice < shortTwapPrice ? quotePrice : shortTwapPrice;
        priceFromPool = (priceFromPool * baseAssetPrice) / PRECISION;

        // Check mid TWAP deviation if required
        if(useMidTwap) {
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

        // Check long TWAP deviation if required
        if(useLongTwap) {
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
        address baseAsset,
        uint256 baseAssetPrice,
        PoolConfig memory pool
    ) internal view returns (uint256) {
        IAMM ammPool = IAMM(pool.poolAddress);

        uint8 decimalsIn = IERC20(asset).decimals();
        uint8 decimalsOut = IERC20(baseAsset).decimals();

        uint256 amountIn = 10**decimalsIn;  // 1 token
        uint256 amountOut = ammPool.getAmountOut(amountIn, asset);

        uint256 normalizedAmountOut = normalizeAmount(amountOut, decimalsOut);
        return (normalizedAmountOut * baseAssetPrice) / PRECISION;
    }

    function getQuotePrice(
        address tokenIn,
        address tokenOut,
        address pool,
        int24 tickSpacing,
        bool isToken0
    ) internal view returns (uint256) {
        uint8 decimalsIn = IERC20(tokenIn).decimals();
        uint8 decimalsOut = IERC20(tokenOut).decimals();

        IQuoter.QuoteExactInputSingleV3Params memory params = IQuoter.QuoteExactInputSingleV3Params({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: 10**decimalsIn,
            tickSpacing: tickSpacing,
            sqrtPriceLimitX96: 0
        });

        try IQuoter(quoter).quoteExactInputSingleV3(params) returns (
            uint256 amountOut,
            uint160,
            uint32,
            uint256
        ) {
            return normalizeAmount(amountOut, decimalsOut);
        } catch {
            return type(uint256).max;
        }
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

            uint160 sqrtPrice = uint160(1.0001e15 ** uint256(int256(avgTick) / 2));
            uint256 price = uint256(sqrtPrice) ** 2;

            if(isToken0) {
                return PRECISION * PRECISION / price;
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
        if(price1 > price2) {
            return ((price1 - price2) * PRECISION) / price2;
        }
        return ((price2 - price1) * PRECISION) / price1;
    }

    function setAdmin(address newAdmin) external onlyAdmin {
        admin = newAdmin;
    }

    function setQuoter(address newQuoter) external onlyAdmin {
        quoter = newQuoter;
    }
}