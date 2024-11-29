const { ethers } = require('ethers');
const { table } = require('console');

const config = {
    arbitrum: {
        rpcUrl: "<REDACTED>",
        blockNumbers: [273278741, 272900000, 272600000, 272250000, 271900000, 271600000, 271250000],
        pools: {
            BTC: "0x275Caecf5542bF4a3CF64aa78a3f57dc9939675C",
            DAI: "0x7Dcf909B1E4b280bEe72C6A69b3a7Ed8adfb63f0",
            USDC: "0x5f3DB5899a7937c9ABF0A5Fc91718E6F813e4195",
            WETH: "0x2E2fE9Bc7904649b65B6373bAF40F9e2E0b883c5",
            ARB: "0x14c82CFc2c651700a66aBDd7dC375c9CeEFDDD72"
        }
    },
    avalanche: {
        rpcUrl: "<REDACTED>",
        blockNumbers: [52927410, 52885410, 52845410, 52800000, 52770000, 52720000, 52680000],
        pools: {
            WAVAX: "0xD26E504fc642B96751fD55D3E68AF295806542f5",
            USDC: "0x2323dAC85C6Ab9bd6a8B5Fb75B0581E31232d12b",
            BTC: "0x475589b0Ed87591A893Df42EC6076d2499bB63d0",
            ETH: "0xD7fEB276ba254cD9b34804A986CE9a8C3E359148",
            USDT: "0xd222e10D7Fe6B7f9608F14A8B5Cf703c74eFBcA1"
        }
    }
};

// ABI for the pool contracts
const poolAbi = [
    "function getDepositRate() external view returns (uint256)",
    "function getBorrowingRate() external view returns (uint256)"
];

async function fetchRates(chainName, provider, poolName, poolAddress, blockNumber) {
    const contract = new ethers.Contract(poolAddress, poolAbi, provider);

    try {
        const [depositRate, borrowRate] = await Promise.all([
            contract.getDepositRate({ blockTag: blockNumber }),
            contract.getBorrowingRate({ blockTag: blockNumber })
        ]);

        return {
            chain: chainName,
            pool: poolName,
            block: blockNumber,
            depositRate: ethers.utils.formatUnits(depositRate, 18),
            borrowRate: ethers.utils.formatUnits(borrowRate, 18)
        };
    } catch (error) {
        console.error(`Error fetching rates for ${poolName} at block ${blockNumber}:`, error.message);
        return {
            chain: chainName,
            pool: poolName,
            block: blockNumber,
            depositRate: 'Error',
            borrowRate: 'Error'
        };
    }
}

function calculateAverages(results) {
    const averages = {};

    results.forEach(result => {
        const key = `${result.chain}-${result.pool}`;
        if (!averages[key]) {
            averages[key] = {
                chain: result.chain,
                pool: result.pool,
                depositRates: [],
                borrowRates: []
            };
        }

        if (result.depositRate !== 'Error') {
            averages[key].depositRates.push(parseFloat(result.depositRate));
        }
        if (result.borrowRate !== 'Error') {
            averages[key].borrowRates.push(parseFloat(result.borrowRate));
        }
    });

    return Object.values(averages).map(avg => ({
        Chain: avg.chain,
        Pool: avg.pool,
        'Avg Deposit Rate': avg.depositRates.length > 0
            ? `${((avg.depositRates.reduce((a, b) => a + b) / avg.depositRates.length) * 100).toFixed(2)}%`
            : 'Error',
        'Avg Borrow Rate': avg.borrowRates.length > 0
            ? `${((avg.borrowRates.reduce((a, b) => a + b) / avg.borrowRates.length) * 100).toFixed(2)}%`
            : 'Error'
    }));
}

async function main() {
    const results = [];

    for (const [chainName, chainConfig] of Object.entries(config)) {
        const provider = new ethers.providers.JsonRpcProvider(chainConfig.rpcUrl);

        for (const blockNumber of chainConfig.blockNumbers) {
            for (const [poolName, poolAddress] of Object.entries(chainConfig.pools)) {
                const rates = await fetchRates(chainName, provider, poolName, poolAddress, blockNumber);
                results.push(rates);
            }
        }
    }

    // Sort and display historical results
    results.sort((a, b) => {
        if (a.chain !== b.chain) return a.chain.localeCompare(b.chain);
        if (a.block !== b.block) return a.block - b.block;
        return a.pool.localeCompare(b.pool);
    });

    const formattedResults = results.map(r => ({
        Chain: r.chain,
        Pool: r.pool,
        Block: r.block.toString(),
        'Deposit Rate': `${(parseFloat(r.depositRate) * 100).toFixed(2)}%`,
        'Borrow Rate': `${(parseFloat(r.borrowRate) * 100).toFixed(2)}%`
    }));

    console.log('\nHistorical Rates:');
    console.table(formattedResults);

    // Calculate and display averages
    const averages = calculateAverages(results);

    // Sort averages by chain and pool
    averages.sort((a, b) => {
        if (a.Chain !== b.Chain) return a.Chain.localeCompare(b.Chain);
        return a.Pool.localeCompare(b.Pool);
    });

    console.log('\nAverage Rates:');
    console.table(averages);
}

main().catch(console.error);