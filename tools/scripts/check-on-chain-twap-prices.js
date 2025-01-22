const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const AMM_ABI = [
    {
        "inputs": [
            {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
            {"internalType": "address", "name": "tokenIn", "type": "address"}
        ],
        "name": "getAmountOut",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    }
];

// Configuration
const oracleConfig = {
    // Network
    rpcUrl: 'https://mainnet.base.org',

    // Contract addresses
    quoterAddress: '0x0A5aA5D3a4d28014f967Bf0f29EAA3FF9807D5c6',

    // Token addresses
    tokens: {
        WETH: {
            address: '0x4200000000000000000000000000000000000006',
            decimals: 18
        },
        AERO: {
            address:  '0x940181a94a35a4569e4529a3cdfb74e38fd98631',
            decimals: 18
        },
        BRETT: {
            address: '0x532f27101965dd16442E59d40670FaF5eBB142E4',
            decimals: 18
        },
        AIXBT: {
            address: '0x4F9Fd6Be4a90f2620860d680c0d4d5Fb53d1A825',
            decimals: 18
        },
        SKI: {
            address: '0x768BE13e1680b5ebE0024C42c896E3dB59ec0149',
            decimals: 9
        },
        DRV: {
            address: '0x9d0e8f5b25384c7310cb8c6ae32c8fbeb645d083',
            decimals: 18
        }
    },

    // Known token prices in USD
    knownPrices: {
        WETH: 3328.13,
        AERO: 1.10
    },

    // Tokens to price
    tokensToPrice: {
        BRETT: {
            pools: [
                {
                    address: '0x43BBb129b56A998732767725A183b7a566843dBA',
                    type: 'AMM',
                    counterToken: 'AERO',
                    isCounterTokenFirst: false
                },
                {
                    address: '0x4e829F8A5213c42535AB84AA40BD4aDCCE9cBa02',
                    type: 'CL',
                    counterToken: 'WETH',
                    isCounterTokenFirst: false,
                    tickSpacing: 200,
                    twapConfigs: {
                        short: { seconds: 30, required: true },    // Required for price calc
                        mid: { seconds: 3600, required: false },   // Optional
                        long: { seconds: 86400, required: false }  // Optional
                    }
                }
            ]
        },
        AIXBT: {
            pools: [
                {
                    address: '0xF3E7E359b75a7223BA9D71065C57DDd4F5D8747e',
                    type: 'AMM',
                    counterToken: 'WETH',
                    isCounterTokenFirst: false
                },
                {
                    address: '0x22A52bB644f855ebD5ca2edB643FF70222D70C31',
                    type: 'CL',
                    counterToken: 'WETH',
                    isCounterTokenFirst: false,
                    tickSpacing: 200,
                    twapConfigs: {
                        short: { seconds: 30, required: true },    // Required for price calc
                        mid: { seconds: 3600, required: false },   // Optional
                        long: { seconds: 86400, required: false }  // Optional
                    }
                }
            ]
        },
        SKI: {
            pools: [
                {
                    address: '0xe782B72A1157b7bEa1A9452835Cce214962aD43B',
                    type: 'CL',
                    counterToken: 'WETH',
                    isCounterTokenFirst: true,
                    tickSpacing: 200,
                    twapConfigs: {
                        short: { seconds: 30, required: true },    // Required for price calc
                        mid: { seconds: 3600, required: false },   // Optional
                        long: { seconds: 86400, required: false }  // Optional
                    }
                }
            ]
        },
        DRV: {
            pools: [
                {
                    address: '0xA0e2bac96aB51c92d3284781AeE1EEc817F6F9C2',
                    type: 'CL',
                    counterToken: 'WETH',
                    isCounterTokenFirst: false,
                    tickSpacing: 200,
                    twapConfigs: {
                        short: { seconds: 30, required: true },    // Required for price calc
                        mid: { seconds: 3600, required: false },   // Optional
                        long: { seconds: 86400, required: false }  // Optional
                    }
                }
            ]
        }
    }
};



// ABIs
const POOL_ABI = [
    "function observe(uint32[] calldata secondsAgos) external view returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s)",
];

const QUOTER_ABI = [
    {
        "inputs": [{
            "components": [
                {"internalType": "address", "name": "tokenIn", "type": "address"},
                {"internalType": "address", "name": "tokenOut", "type": "address"},
                {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
                {"internalType": "int24", "name": "tickSpacing", "type": "int24"},
                {"internalType": "uint160", "name": "sqrtPriceLimitX96", "type": "uint160"}
            ],
            "internalType": "struct IMixedRouteQuoterV1.QuoteExactInputSingleV3Params",
            "name": "params",
            "type": "tuple"
        }],
        "name": "quoteExactInputSingleV3",
        "outputs": [
            {"internalType": "uint256", "name": "amountOut", "type": "uint256"},
            {"internalType": "uint160", "name": "sqrtPriceX96After", "type": "uint160"},
            {"internalType": "uint32", "name": "initializedTicksCrossed", "type": "uint32"},
            {"internalType": "uint256", "name": "gasEstimate", "type": "uint256"}
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

async function testObservation(poolAddress, duration, provider) {
    const poolInterface = new ethers.utils.Interface(POOL_ABI);
    const secondsAgos = [duration, 0].map(s =>
        ethers.utils.hexZeroPad(ethers.BigNumber.from(s).toHexString(), 4)
    );

    try {
        const data = poolInterface.encodeFunctionData("observe", [secondsAgos]);
        const result = await provider.call({ to: poolAddress, data });

        // Try to decode the result
        const decodedResult = poolInterface.decodeFunctionResult("observe", result);
        const [tickCumulatives] = decodedResult;

        // Validate that we got valid results
        if (!tickCumulatives || !tickCumulatives[0] || !tickCumulatives[1]) {
            console.log(`Invalid tick cumulatives for duration ${duration}:`, tickCumulatives);
            return false;
        }

        // Calculate tick difference to further validate
        const tickDiff = tickCumulatives[0].sub(tickCumulatives[1]);
        const avgTick = tickDiff.div(ethers.BigNumber.from(duration));

        // Try to calculate price to ensure everything works
        const price = Math.pow(1.0001, avgTick);
        if (!isFinite(price)) {
            console.log(`Invalid price calculated for duration ${duration}: ${price}`);
            return false;
        }

        return true;
    } catch (error) {
        if (error.reason === 'OLD') {
            return false;
        }
        if (error.message.includes('decode')) {
            console.log(`Decoding error for duration ${duration}:`, error.message);
            return false;
        }
        throw error; // Rethrow other errors
    }
}

async function findMaxObservableDuration(poolAddress, provider) {
    // Binary search parameters
    const MIN_DURATION = 1;           // 1 second
    const MAX_DURATION = 259200;      // 3 days (can adjust if needed)
    const PRECISION = 60;             // 1 minute precision

    let low = MIN_DURATION;
    let high = MAX_DURATION;
    let maxObservable = 0;

    try {
        // First check if we can observe the minimum duration
        if (!await testObservation(poolAddress, MIN_DURATION, provider)) {
            return {
                success: false,
                error: "Cannot observe minimum duration"
            };
        }

        // Binary search for maximum observable duration
        while (high - low > PRECISION) {
            const mid = Math.floor((low + high) / 2);
            console.log(`Testing duration: ${mid} seconds...`);

            if (await testObservation(poolAddress, mid, provider)) {
                low = mid;
                maxObservable = mid;
            } else {
                high = mid;
            }
        }

        return {
            success: true,
            maxObservableDuration: maxObservable,
            maxObservableFormatted: formatDuration(maxObservable)
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (remainingSeconds > 0) parts.push(`${remainingSeconds}s`);

    return parts.join(' ');
}

async function analyzeTwapObservability() {
    console.log('\nNOTE: Pool observation windows are sliding windows. A successful test here means the pool CAN observe');
    console.log('these durations, but specific observations might still fail depending on when they are requested.\n');

    // Standard durations to test after finding max observable
    const standardDurations = {
        short: 30,          // 30 seconds
        mid: 3600,         // 1 hour
        long: 86400        // 24 hours
    };

    const startTime = new Date();
    const provider = new ethers.providers.JsonRpcProvider(oracleConfig.rpcUrl);
    const results = {
        timestamp: startTime.toISOString(),
        network: oracleConfig.rpcUrl,
        analysisStarted: startTime.toISOString(),
        tokens: {}
    };

    for (const [tokenSymbol, config] of Object.entries(oracleConfig.tokensToPrice)) {
        results.tokens[tokenSymbol] = { pools: [] };

        // Filter for CL pools
        const clPools = config.pools.filter(pool => pool.type === 'CL');

        for (const pool of clPools) {
            console.log(`\nAnalyzing pool ${pool.address} for ${tokenSymbol}`);

            const poolResult = {
                address: pool.address,
                counterToken: pool.counterToken,
                observability: {},
                standardDurations: {}
            };

            // Find maximum observable duration
            const maxObservable = await findMaxObservableDuration(pool.address, provider);
            poolResult.observability = maxObservable;

            // Test standard durations
            for (const [durationType, seconds] of Object.entries(standardDurations)) {
                console.log(`Testing ${durationType} duration (${formatDuration(seconds)})...`);
                const testTime = Math.floor(Date.now() / 1000);

                try {
                    const isObservable = await testObservation(pool.address, seconds, provider);
                    poolResult.standardDurations[durationType] = {
                        seconds,
                        observable: isObservable,
                        theoreticallyObservable: maxObservable.success ? seconds <= maxObservable.maxObservableDuration : null,
                        formattedDuration: formatDuration(seconds),
                        status: isObservable ? 'SUCCESS' : 'OLD',
                        testedAt: new Date(testTime * 1000).toISOString()
                    };
                } catch (error) {
                    poolResult.standardDurations[durationType] = {
                        seconds,
                        observable: false,
                        theoreticallyObservable: maxObservable.success ? seconds <= maxObservable.maxObservableDuration : null,
                        formattedDuration: formatDuration(seconds),
                        status: 'ERROR',
                        error: error.message,
                        testedAt: new Date(testTime * 1000).toISOString()
                    };
                }
            }

            results.tokens[tokenSymbol].pools.push(poolResult);
        }
    }

    // Add analysis completion time
    results.analysisCompleted = new Date().toISOString();
    results.analysisDurationMs = new Date() - startTime;

    // Create filename with timestamp
    const timestamp = startTime.toISOString().replace(/[:.]/g, '-');
    const filename = `twap-analysis-${timestamp}.json`;

    // Ensure the analytics directory exists
    const analyticsDir = path.join(__dirname, 'analytics');
    if (!fs.existsSync(analyticsDir)) {
        fs.mkdirSync(analyticsDir);
    }

    // Write to file
    const filepath = path.join(analyticsDir, filename);
    fs.writeFileSync(
        filepath,
        JSON.stringify(results, null, 2)
    );

    console.log('\nTWAP Observability Analysis:');
    console.log(JSON.stringify(results, null, 2));
    console.log(`\nAnalysis saved to: ${filepath}`);

    return results;
}


async function getTwapForDuration(poolAddress, duration, provider) {
    const poolInterface = new ethers.utils.Interface(POOL_ABI);

    const secondsAgos = [0, duration].map(s =>
        ethers.utils.hexZeroPad(ethers.BigNumber.from(s).toHexString(), 4)
    );

    try {
        const data = poolInterface.encodeFunctionData("observe", [secondsAgos]);

        const result = await provider.call({
            to: poolAddress,
            data: data
        });

        const decodedResult = poolInterface.decodeFunctionResult("observe", result);
        const [tickCumulatives] = decodedResult;

        const tickDiff = tickCumulatives[0].sub(tickCumulatives[1]);
        const avgTick = tickDiff.div(ethers.BigNumber.from(duration));
        const price = Math.pow(1.0001, avgTick);

        return {
            success: true,
            price,
            duration
        };
    } catch (error) {
        // Check if the error is "OLD"
        if (error.reason === 'OLD') {
            console.log(`${duration}s TWAP for ${poolAddress}: OLD`);
            return {
                success: false,
                status: 'OLD',
                duration
            };
        }

        console.error(`Error getting ${duration}s TWAP for ${poolAddress}:`, error.message);
        return {
            success: false,
            error: error.message,
            duration
        };
    }
}

async function getClPoolPrice(poolAddress, twapConfigs, provider, knownPrice, isCounterTokenFirst, tokenSymbol, counterTokenSymbol) {
    const twapResults = {
        priceForCalculation: null,
        allPrices: {}
    };

    const tokenConfig = oracleConfig.tokens[tokenSymbol];
    const counterTokenConfig = oracleConfig.tokens[counterTokenSymbol];

    // Process each TWAP duration independently
    const twapPromises = Object.entries(twapConfigs).map(async ([period, config]) => {
        const result = await getTwapForDuration(poolAddress, config.seconds, provider);

        const decimalsDifference = isCounterTokenFirst ?
            counterTokenConfig.decimals - tokenConfig.decimals
            :
            tokenConfig.decimals - counterTokenConfig.decimals;

        result.price = result.price * Math.pow(10, decimalsDifference)

        if (result.success) {
            let usdPrice = knownPrice / result.price;

            twapResults.allPrices[period] = {
                period: `${config.seconds}s`,
                rawPrice: result.price,
                usdPrice: usdPrice
            };

            if (period === 'short') {
                twapResults.priceForCalculation = result.price;
            }

            console.log(`${period} TWAP (${config.seconds}s): ${result.price} (${usdPrice} USD)`);
        } else if (result.status === 'OLD') {
            twapResults.allPrices[period] = {
                period: `${config.seconds}s`,
                status: 'OLD'
            };
        } else {
            twapResults.allPrices[period] = {
                period: `${config.seconds}s`,
                error: result.error
            };

            if (config.required) {
                return null;
            }
        }
    });

    await Promise.all(twapPromises);

    if (!twapResults.priceForCalculation) {
        console.error(`Required short TWAP not available for ${poolAddress}`);
        return null;
    }

    return twapResults;
}

async function getQuotePrice(poolAddress, tokenInSymbol, tokenOutSymbol, amountIn, tickSpacing, provider) {
    const tokenIn = oracleConfig.tokens[tokenInSymbol].address;
    const tokenOut = oracleConfig.tokens[tokenOutSymbol].address;
    const quoterContract = new ethers.Contract(
        oracleConfig.quoterAddress,
        QUOTER_ABI,
        provider
    );

    try {
        // Get decimals for both tokens
        const tokenInContract = new ethers.Contract(tokenIn, ["function decimals() view returns (uint8)"], provider);
        const tokenOutContract = new ethers.Contract(tokenOut, ["function decimals() view returns (uint8)"], provider);

        const [decimalsIn, decimalsOut] = await Promise.all([
            tokenInContract.decimals(),
            tokenOutContract.decimals()
        ]);

        const params = {
            tokenIn,
            tokenOut,
            amountIn: ethers.utils.parseUnits(amountIn.toString(), decimalsIn),
            tickSpacing,
            sqrtPriceLimitX96: 0
        };

        const quote = await quoterContract.callStatic.quoteExactInputSingleV3(params);
        const amountOut = ethers.utils.formatUnits(quote[0], decimalsOut);

        // Calculate price ratio
        const price = parseFloat(amountOut) / parseFloat(amountIn);
        return price;
    } catch (error) {
        console.error(`Error getting quote price for ${poolAddress}:`, error);
        return null;
    }
}

async function getAmmPrice(poolAddress, tokenInSymbol, tokenOutSymbol, provider) {
    const tokenIn = oracleConfig.tokens[tokenInSymbol].address;
    const tokenOut = oracleConfig.tokens[tokenOutSymbol].address;

    try {
        // Get decimals for both tokens
        const tokenInContract = new ethers.Contract(tokenIn, ["function decimals() view returns (uint8)"], provider);
        const tokenOutContract = new ethers.Contract(tokenOut, ["function decimals() view returns (uint8)"], provider);

        const [decimalsIn, decimalsOut] = await Promise.all([
            tokenInContract.decimals(),
            tokenOutContract.decimals()
        ]);

        // Create pool contract instance
        const poolContract = new ethers.Contract(poolAddress, AMM_ABI, provider);

        // Get quote for 1 token (scaled by decimals)
        const amountIn = ethers.utils.parseUnits("1", decimalsIn);

        // Call getAmountOut
        const amountOutRaw = await poolContract.getAmountOut(amountIn, tokenIn);
        const amountOut = ethers.utils.formatUnits(amountOutRaw, decimalsOut);

        // Calculate price ratio
        const price = parseFloat(amountOut);
        console.log(`AMM price for ${tokenInSymbol}/${tokenOutSymbol}: ${price}`);
        return price;
    } catch (error) {
        console.error(`Error getting AMM price for ${poolAddress}:`, error);
        return null;
    }
}

async function calculateTokenPrice(tokenSymbol, tokenConfig) {
    const provider = new ethers.providers.JsonRpcProvider(oracleConfig.rpcUrl);
    const prices = [];
    let priceIndex = 0;
    const allPriceData = {
        prices: [],
        twapData: [],
        quoteData: [],
        ammData: []
    };

    for (const pool of tokenConfig.pools) {
        const knownPrice = oracleConfig.knownPrices[pool.counterToken];
        console.log(`\nProcessing pool: ${pool.address}`);
        console.log(`Pool type: ${pool.type}`);
        console.log(`Known price for ${pool.counterToken}: ${knownPrice}`);

        if (pool.type === 'CL') {
            // Run TWAP and quote calculations in parallel
            const [twapResult, quotePrice] = await Promise.all([
                getClPoolPrice(pool.address, pool.twapConfigs, provider, knownPrice, pool.isCounterTokenFirst, tokenSymbol, pool.counterToken),
                getQuotePrice(
                    pool.address,
                    tokenSymbol,
                    pool.counterToken,
                    1,
                    pool.tickSpacing,
                    provider
                )
            ]);

            if (twapResult) {
                allPriceData.twapData.push({
                    poolAddress: pool.address,
                    data: twapResult.allPrices
                });

                const twapUsdPrice = knownPrice / twapResult.priceForCalculation;
                prices.push(twapUsdPrice);
                allPriceData.prices.push({
                    type: 'TWAP',
                    poolAddress: pool.address,
                    price: twapUsdPrice
                });
                console.log(`Price ${++priceIndex}: ${twapUsdPrice} (from Short TWAP)`);
            }

            if (quotePrice) {
                const quoteUsdPrice = quotePrice * knownPrice;
                prices.push(quoteUsdPrice);
                allPriceData.quoteData.push({
                    poolAddress: pool.address,
                    price: quoteUsdPrice
                });
                console.log(`Price ${++priceIndex}: ${quoteUsdPrice} (from Quote)`);
            }

        } else if (pool.type === 'AMM') {
            const ammPrice = await getAmmPrice(
                pool.address,
                tokenSymbol,
                pool.counterToken,
                provider
            );

            if (ammPrice) {
                const ammUsdPrice = knownPrice * ammPrice;
                prices.push(ammUsdPrice);
                allPriceData.ammData.push({
                    poolAddress: pool.address,
                    price: ammUsdPrice
                });
                console.log(`Price ${++priceIndex}: ${ammUsdPrice} (from AMM)`);
            }
        }
    }

    // Calculate average price from all valid results
    const validPrices = prices.filter(p => p !== null && p !== undefined && isFinite(p));
    if (validPrices.length === 0) {
        throw new Error(`No valid prices found for ${tokenSymbol}`);
    }

    const averagePrice = validPrices.reduce((a, b) => a + b, 0) / validPrices.length;

    return {
        price: averagePrice,
        priceData: allPriceData
    };
}

async function main() {
    console.log('Starting price calculations...');

    const results = {};
    for (const [token, config] of Object.entries(oracleConfig.tokensToPrice)) {
        console.log(`\nProcessing token: ${token}`);
        try {
            const priceResult = await calculateTokenPrice(token, config);
            results[token] = {
                usdPrice: priceResult.price.toFixed(6),
                timestamp: new Date().toISOString(),
                priceData: priceResult.priceData
            };
        } catch (error) {
            console.error(`Error calculating price for ${token}:`, error);
            results[token] = { error: error.message };
        }
    }

    console.log('\nPrice Results:');
    console.log(JSON.stringify(results, null, 2));
}

// Execute the script
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });

// Analyze observation
// analyzeTwapObservability()
//     .then(() => process.exit(0))
//     .catch((error) => {
//         console.error('Fatal error:', error);
//         process.exit(1);
//     });