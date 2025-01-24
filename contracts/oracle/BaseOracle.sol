// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

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
    external view returns (uint256 amountOut, uint160, uint32, uint256);
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
        address quoter;
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

    struct CLPriceParams {
        address asset;
        address baseAsset;
        uint256 baseAssetPrice;
        bool useMidTwap;
        bool useLongTwap;
        uint256 amount;
        bool isToken0;
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
        }

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
            uint256 poolPrice = calculatePoolPrice(params, pools[i]);
            if (poolPrice < minPrice) {
                minPrice = poolPrice;
            }
        }

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

        CLPriceParams memory clParams = CLPriceParams({
            asset: params.asset,
            baseAsset: params.baseAsset,
            baseAssetPrice: params.baseAssetPrice,
            useMidTwap: params.useMidTwap,
            useLongTwap: params.useLongTwap,
            amount: params.amount,
            isToken0: isToken0
        });

        uint256 quotePrice = getQuotePrice(
            params.asset,
            params.baseAsset,
            pool.poolAddress,
            pool.tickSpacing,
            isToken0,
            pool.quoter,
            params.amount
        );

        uint256 shortTwapPrice = getTwapPrice(
            pool.poolAddress,
            pool.shortTwap,
            isToken0
        );

        uint256 priceFromPool = quotePrice < shortTwapPrice ? quotePrice : shortTwapPrice;
        priceFromPool = (priceFromPool * params.baseAssetPrice) / PRECISION;

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

    function getQuotePrice(
        address tokenIn,
        address tokenOut,
        address pool,
        int24 tickSpacing,
        bool isToken0,
        address poolQuoter,
        uint256 amount
    ) internal view returns (uint256) {
        uint8 decimalsIn = IERC20(tokenIn).decimals();
        uint8 decimalsOut = IERC20(tokenOut).decimals();

        IQuoter.QuoteExactInputSingleV3Params memory params = IQuoter.QuoteExactInputSingleV3Params({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amount,
            tickSpacing: tickSpacing,
            sqrtPriceLimitX96: 0
        });

        try IQuoter(poolQuoter).quoteExactInputSingleV3(params) returns (
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

            if (isToken0) {
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
        if (price1 > price2) {
            return ((price1 - price2) * PRECISION) / price2;
        }
        return ((price2 - price1) * PRECISION) / price1;
    }

    function setAdmin(address newAdmin) external onlyAdmin {
        admin = newAdmin;
    }
}