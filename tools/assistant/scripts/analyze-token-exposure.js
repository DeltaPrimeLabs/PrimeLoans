const ethers = require('ethers');
const readline = require('readline');

// ABI snippets we need
const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
];

const NETWORKS = {
    avalanche: {
        rpc: "https://api.avax.network/ext/bc/C/rpc",
        tokenManager: "0xF3978209B7cfF2b90100C6F87CEC77dE928Ed58e",
        smartLoansFactory: "0x3Ea9D480295A73fd2aF95b4D96c2afF88b21B03D",
        chainId: 43114,
        redstoneService: "redstone-avalanche-prod"
    },
    arbitrum: {
        rpc: "https://arb1.arbitrum.io/rpc",
        tokenManager: "0x0a0D954d4b0F0b47a5990C0abd179A90fF74E255",
        smartLoansFactory: "0xFf5e3dDaefF411a1dC6CcE00014e4Bca39265c20",
        chainId: 42161,
        redstoneService: "redstone-arbitrum-prod"
    }
};

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// Create readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Helper to format balance with decimals
function formatBalance(balance, decimals) {
    return ethers.utils.formatUnits(balance, decimals);
}

// Helper to format percentages
function formatPercentage(part, whole) {
    if (whole.isZero()) return '0.00%';
    return `${part.mul(10000).div(whole).toNumber() / 100}%`;
}

// Function to get prices from Redstone
async function getRedstonePrices(tokenSymbols, networkConfig) {
    const REDSTONE_CACHE_LAYER_URLS = [
        "https://oracle-gateway-1.a.redstone.finance",
        "https://oracle-gateway-2.a.redstone.finance"
    ];

    const url = `${REDSTONE_CACHE_LAYER_URLS[0]}/data-packages/latest/${networkConfig.redstoneService}`;
    const redstonePrices = await (await fetch(url)).json();

    let result = [];
    for (const symbol of tokenSymbols) {
        const symbolPriceObject = redstonePrices[symbol];
        if (!symbolPriceObject) {
            console.warn(`No price data found for ${symbol}`);
            result.push(0);
            continue;
        }

        let currentNewestTimestampIndex = 0;
        for (let i = 0; i < symbolPriceObject.length; i++) {
            if (symbolPriceObject[i].timestampMilliseconds > symbolPriceObject[currentNewestTimestampIndex].timestampMilliseconds) {
                currentNewestTimestampIndex = i;
            }
        }
        result.push(symbolPriceObject[currentNewestTimestampIndex].dataPoints[0].value);
    }
    return result;
}

async function getMultipleChoices(validTokens) {
    console.log("\nSelect tokens to analyze (options: numbers separated by commas, ranges like '1-4', or 'all'):");
    validTokens.forEach((token, i) => {
        console.log(`[${i}] ${token.symbol} (${token.address})`);
    });

    const answer = await question("\nEnter your selection: ");
    if (answer.toLowerCase() === 'all') {
        return validTokens;
    }

    const selections = answer.split(',').map(part => part.trim());
    const selectedIndices = new Set();

    for (const selection of selections) {
        if (selection.includes('-')) {
            const [start, end] = selection.split('-').map(num => parseInt(num));
            if (!isNaN(start) && !isNaN(end) && start <= end) {
                for (let i = start; i <= end; i++) {
                    if (i >= 0 && i < validTokens.length) {
                        selectedIndices.add(i);
                    }
                }
            }
        } else {
            const index = parseInt(selection);
            if (!isNaN(index) && index >= 0 && index < validTokens.length) {
                selectedIndices.add(index);
            }
        }
    }

    return Array.from(selectedIndices).sort((a, b) => a - b).map(i => validTokens[i]);
}

async function analyzeToken(tokenContract, selectedToken, primeAccounts, totalAccounts, tokenPrice) {
    const BATCH_SIZE = 100;
    const balances = new Map();
    let totalBalance = ethers.BigNumber.from(0);
    let holders = 0;
    let totalDollarValue = 0;

    for (let i = 0; i < primeAccounts.length; i += BATCH_SIZE) {
        const batch = primeAccounts.slice(i, i + BATCH_SIZE);
        const batchBalances = await Promise.all(
            batch.map(account => tokenContract.balanceOf(account))
        );

        batchBalances.forEach((balance, j) => {
            if (!balance.isZero()) {
                balances.set(batch[j], balance);
                totalBalance = totalBalance.add(balance);
                totalDollarValue += Number(formatBalance(balance, selectedToken.decimals)) * tokenPrice;
                holders++;
            }
        });

        const progress = Math.min(i + BATCH_SIZE, primeAccounts.length);
        const progressPercent = (progress / primeAccounts.length * 100).toFixed(2);
        console.log(`Progress for ${selectedToken.symbol}: ${progress}/${primeAccounts.length} accounts (${progressPercent}%)`);
    }

    return { balances, totalBalance, holders, totalDollarValue };
}

async function displayTokenAnalysis(tokenData, selectedToken, totalAccounts, tokenPrice) {
    const { balances, totalBalance, holders, totalDollarValue } = tokenData;

    console.log(`\nAnalysis Results for ${selectedToken.symbol}`);
    console.log("=".repeat(50));
    console.log(`Total Exposure: ${formatBalance(totalBalance, selectedToken.decimals)} ${selectedToken.symbol}`);
    console.log(`Total Value: $${totalDollarValue.toFixed(2)}`);
    console.log(`Number of Holders: ${holders}`);
    console.log(`Percentage of Prime Accounts holding token: ${((holders / totalAccounts) * 100).toFixed(2)}%`);

    if (holders > 0) {
        const sortedHolders = Array.from(balances.entries())
            .sort((a, b) => b[1].sub(a[1]))
            .slice(0, 10);

        let cumulativeBalance = ethers.BigNumber.from(0);
        let cumulativeDollarValue = 0;

        console.log("\nTop 10 Holders:");
        console.log("-".repeat(50));

        sortedHolders.forEach(([address, balance], i) => {
            cumulativeBalance = cumulativeBalance.add(balance);
            const balanceFormatted = formatBalance(balance, selectedToken.decimals);
            const dollarValue = Number(balanceFormatted) * tokenPrice;
            cumulativeDollarValue += dollarValue;

            console.log(`${i + 1}. ${address}:`);
            console.log(`   Balance: ${balanceFormatted} ${selectedToken.symbol} ($${dollarValue.toFixed(2)})`);
            console.log(`   Share of Total Supply: ${formatPercentage(balance, totalBalance)}`);
            console.log(`   Cumulative Share: ${formatPercentage(cumulativeBalance, totalBalance)} ($${cumulativeDollarValue.toFixed(2)})`);
        });

        // Distribution analysis
        const distributions = {
            large: { threshold: totalBalance.div(10), count: 0, total: ethers.BigNumber.from(0), dollarValue: 0 },
            medium: { threshold: totalBalance.div(100), count: 0, total: ethers.BigNumber.from(0), dollarValue: 0 },
            small: { threshold: totalBalance.div(1000), count: 0, total: ethers.BigNumber.from(0), dollarValue: 0 }
        };

        balances.forEach((balance) => {
            const balanceValue = Number(formatBalance(balance, selectedToken.decimals)) * tokenPrice;
            if (balance.gte(distributions.large.threshold)) {
                distributions.large.count++;
                distributions.large.total = distributions.large.total.add(balance);
                distributions.large.dollarValue += balanceValue;
            } else if (balance.gte(distributions.medium.threshold)) {
                distributions.medium.count++;
                distributions.medium.total = distributions.medium.total.add(balance);
                distributions.medium.dollarValue += balanceValue;
            } else {
                distributions.small.count++;
                distributions.small.total = distributions.small.total.add(balance);
                distributions.small.dollarValue += balanceValue;
            }
        });

        console.log("\nHolder Distribution:");
        console.log("-".repeat(50));
        Object.entries(distributions).forEach(([size, data]) => {
            console.log(`${size.charAt(0).toUpperCase() + size.slice(1)} Holders:`);
            console.log(`   Count: ${data.count} (${((data.count / holders) * 100).toFixed(2)}% of holders)`);
            console.log(`   Total: ${formatBalance(data.total, selectedToken.decimals)} ${selectedToken.symbol}`);
            console.log(`   Value: $${data.dollarValue.toFixed(2)}`);
            console.log(`   Share: ${formatPercentage(data.total, totalBalance)}`);
        });
    }
}

async function analyzeTokenExposure() {
    try {
        // 1. Select network
        console.log("\nSelect network:");
        Object.keys(NETWORKS).forEach((net, i) => console.log(`[${i}] ${net}`));
        const networkIndex = parseInt(await question("Enter network number: "));
        const network = Object.keys(NETWORKS)[networkIndex];
        const networkConfig = NETWORKS[network];

        // Setup provider
        const provider = new ethers.providers.JsonRpcProvider(networkConfig.rpc);

        // Initialize contracts
        const tokenManager = new ethers.Contract(
            networkConfig.tokenManager,
            [
                "function getAllTokenAssets() view returns (bytes32[])",
                "function getAssetAddress(bytes32, bool) view returns (address)",
            ],
            provider
        );

        const smartLoansFactory = new ethers.Contract(
            networkConfig.smartLoansFactory,
            [
                "function getAllLoans() view returns (address[])",
                "function getLoansLength() view returns (uint256)"
            ],
            provider
        );

        // 2. Get all supported tokens
        console.log("\nFetching supported tokens...");
        const tokenAssets = await tokenManager.getAllTokenAssets();
        const tokenAddresses = await Promise.all(
            tokenAssets.map(asset => tokenManager.getAssetAddress(asset, true))
        );

        // Get token details
        const tokens = await Promise.all(
            tokenAddresses.map(async (address, i) => {
                const token = new ethers.Contract(address, ERC20_ABI, provider);
                try {
                    const symbol = ethers.utils.parseBytes32String(tokenAssets[i]);
                    const decimals = await token.decimals();
                    return { address, symbol, decimals };
                } catch (error) {
                    console.log(`Warning: Could not parse token at ${address}, error: ${error.message}`);
                    return null;
                }
            })
        );

        // Filter out any failed token fetches
        const validTokens = tokens.filter(token => token !== null);

        // 3. Get token selection from user
        const selectedTokens = await getMultipleChoices(validTokens);
        if (selectedTokens.length === 0) {
            console.log("No valid tokens selected.");
            return;
        }

        // 4. Get token prices
        console.log("\nFetching token prices...");
        const tokenPrices = await getRedstonePrices(
            selectedTokens.map(token => token.symbol),
            networkConfig
        );

        // 5. Get Prime Accounts
        console.log("\nFetching Prime Accounts...");
        const primeAccounts = await smartLoansFactory.getAllLoans();
        console.log(`Found ${primeAccounts.length} Prime Accounts`);

        let totalProtocolValue = 0;

        // 6. Analyze each selected token
        for (let i = 0; i < selectedTokens.length; i++) {
            const token = selectedTokens[i];
            const tokenPrice = tokenPrices[i];

            console.log(`\nAnalyzing ${token.symbol} (Price: $${tokenPrice})...`);
            const tokenContract = new ethers.Contract(token.address, ERC20_ABI, provider);
            const tokenData = await analyzeToken(tokenContract, token, primeAccounts, primeAccounts.length, tokenPrice);

            totalProtocolValue += tokenData.totalDollarValue;
            await displayTokenAnalysis(tokenData, token, primeAccounts.length, tokenPrice);
        }

        console.log("\nTotal Protocol Value Analysis");
        console.log("=".repeat(50));
        console.log(`Total Protocol Value: $${totalProtocolValue.toFixed(2)}`);

    } catch (error) {
        console.error("Error:", error);
        if (error.reason) console.error("Reason:", error.reason);
    } finally {
        rl.close();
    }
}

// Run the analysis
analyzeTokenExposure();