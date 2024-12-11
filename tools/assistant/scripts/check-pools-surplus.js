const ethers = require('ethers');
const { formatUnits } = ethers.utils;

// ABI for the functions we need
const MINIMAL_ABI = [
    "function totalSupply() view returns (uint256)",
    "function totalBorrowed() view returns (uint256)",
    "function tokenAddress() view returns (address)",
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
];

const POOLS = {
    avalanche: {
        WavaxPoolTUP: {
            address: "0xaa39f39802F8C44e48d4cc42E088C09EDF4daad4",
            priceId: "avalanche-2"
        },
        UsdcPoolTUP: {
            address: "0x8027e004d80274FB320e9b8f882C92196d779CE8",
            priceId: "usd-coin"
        },
        BtcPoolTUP: {
            address: "0x70e80001bDbeC5b9e932cEe2FEcC8F123c98F738",
            priceId: "bitcoin"
        },
        EthPoolTUP: {
            address: "0x2A84c101F3d45610595050a622684d5412bdf510",
            priceId: "ethereum"
        },
        UsdtPoolTUP: {
            address: "0x1b6D7A6044fB68163D8E249Bce86F3eFbb12368e",
            priceId: "tether"
        }
    },
    arbitrum: {
        BtcPoolTUP: {
            address: "0x0ed7B42B74F039eda928E1AE6F44Eed5EF195Fb5",
            priceId: "bitcoin"
        },
        DaiPoolTUP: {
            address: "0xFA354E4289db87bEB81034A3ABD6D465328378f1",
            priceId: "dai"
        },
        WethPoolTUP: {
            address: "0x788A8324943beb1a7A47B76959E6C1e6B87eD360",
            priceId: "ethereum"
        },
        UsdcPoolTUP: {
            address: "0x8Ac9Dc27a6174a1CC30873B367A60AcdFAb965cc",
            priceId: "usd-coin"
        },
        ArbPoolTUP: {
            address: "0xC629E8889350F1BBBf6eD1955095C2198dDC41c2",
            priceId: "arbitrum"
        }
    }
};

const RPC_URLS = {
    avalanche: "https://api.avax.network/ext/bc/C/rpc",
    arbitrum: "https://arb1.arbitrum.io/rpc"
};

async function fetchTokenPrices(priceIds) {
    try {
        const uniquePriceIds = [...new Set(priceIds)];
        const idsParam = uniquePriceIds.join(',');
        const response = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${idsParam}&vs_currencies=usd`
        );
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching prices:', error);
        return {};
    }
}

async function checkPoolSurplus(poolName, poolConfig, provider, prices) {
    try {
        const pool = new ethers.Contract(poolConfig.address, MINIMAL_ABI, provider);

        // Get pool's token address
        const tokenAddress = await pool.tokenAddress();
        const token = new ethers.Contract(tokenAddress, MINIMAL_ABI, provider);

        // Get decimals and symbol
        const [decimals, symbol] = await Promise.all([
            token.decimals(),
            token.symbol()
        ]);

        // Get all required values
        const [totalSupply, totalBorrowed, tokenBalance] = await Promise.all([
            pool.totalSupply(),
            pool.totalBorrowed(),
            token.balanceOf(poolConfig.address)
        ]);

        // Calculate surplus
        const surplus = totalBorrowed.add(tokenBalance).sub(totalSupply);
        const surplusFormatted = formatUnits(surplus, decimals);

        // Calculate USD value
        const tokenPrice = prices[poolConfig.priceId]?.usd || 0;
        const surplusUsdValue = parseFloat(surplusFormatted) * tokenPrice;

        return {
            poolName,
            symbol,
            totalSupply: formatUnits(totalSupply, decimals),
            totalBorrowed: formatUnits(totalBorrowed, decimals),
            tokenBalance: formatUnits(tokenBalance, decimals),
            surplus: surplusFormatted,
            surplusUsd: surplusUsdValue.toFixed(2),
            tokenPrice: tokenPrice.toFixed(2)
        };
    } catch (error) {
        console.error(`Error checking ${poolName}:`, error.message);
        return null;
    }
}

async function checkAllPools(network = 'all') {
    const results = [];
    const networks = network === 'all' ? Object.keys(POOLS) : [network];

    // Collect all price IDs
    const allPriceIds = networks.flatMap(network =>
        Object.values(POOLS[network]).map(pool => pool.priceId)
    );

    // Fetch all prices at once
    const prices = await fetchTokenPrices(allPriceIds);

    for (const networkName of networks) {
        console.log(`\nChecking ${networkName} pools...`);
        const provider = new ethers.providers.JsonRpcProvider(RPC_URLS[networkName]);

        for (const [poolName, poolConfig] of Object.entries(POOLS[networkName])) {
            const result = await checkPoolSurplus(poolName, poolConfig, provider, prices);
            if (result) {
                results.push({ network: networkName, ...result });
            }
        }
    }

    // Display results
    console.log('\nPool Surplus Report');
    console.log('=================');

    let totalSurplusUsd = 0;

    results.forEach(result => {
        console.log(`\n${result.network.toUpperCase()} - ${result.poolName} (${result.symbol})`);
        console.log('Total Supply:', result.totalSupply);
        console.log('Total Borrowed:', result.totalBorrowed);
        console.log('Token Balance:', result.tokenBalance);
        console.log(`Surplus: ${result.surplus} ${result.symbol}`);
        console.log(`Token Price: $${result.tokenPrice}`);
        console.log(`Surplus Value: $${result.surplusUsd}`);

        totalSurplusUsd += parseFloat(result.surplusUsd);
    });

    console.log('\n=================');
    console.log(`Total Surplus Value: $${totalSurplusUsd.toFixed(2)}`);
}

// If running directly
if (require.main === module) {
    const network = process.argv[2] || 'all';
    if (!['all', 'avalanche', 'arbitrum'].includes(network)) {
        console.error('Invalid network. Use: avalanche, arbitrum, or all');
        process.exit(1);
    }

    checkAllPools(network)
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Error:', error);
            process.exit(1);
        });
}

module.exports = {
    checkPoolSurplus,
    checkAllPools,
    POOLS
};