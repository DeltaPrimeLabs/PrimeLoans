const axios = require('axios');
const ethers = require('ethers');
const diff = require('diff');
const readline = require('readline');

// We'll create a simple color function in case chalk import fails
const colors = {
    red: (text) => `\x1b[31m${text}\x1b[0m`,
    green: (text) => `\x1b[32m${text}\x1b[0m`,
    reset: (text) => `\x1b[0m${text}`
};

// Explorer API configurations
const EXPLORERS = {
    avalanche: {
        name: 'Snowtrace',
        baseUrl: 'https://api.snowtrace.io/api',
        apiKey: process.env.SNOWTRACE_API_KEY
    },
    arbitrum: {
        name: 'Arbiscan',
        baseUrl: 'https://api.arbiscan.io/api',
        apiKey: process.env.ARBISCAN_API_KEY
    }
};

// Create readline interface for prompts
function createInterface() {
    return readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
}

async function promptUser(message, choices = null) {
    const rl = createInterface();

    return new Promise((resolve) => {
        if (choices) {
            console.log('\n' + message);
            choices.forEach((choice, index) => {
                console.log(`[${index}] ${choice}`);
            });

            rl.question('\nPlease select by number: ', (answer) => {
                rl.close();
                resolve(parseInt(answer.trim()));
            });
        } else {
            rl.question(message + ' ', (answer) => {
                rl.close();
                resolve(answer.trim());
            });
        }
    });
}

// Helper function to fetch verified contract source code
async function getVerifiedContract(address, network) {
    const explorer = EXPLORERS[network];
    if (!explorer) {
        throw new Error(`Unsupported network: ${network}`);
    }

    if (!explorer.apiKey) {
        throw new Error(`API key for ${explorer.name} not found in environment variables`);
    }

    try {
        const response = await axios.get(explorer.baseUrl, {
            params: {
                module: 'contract',
                action: 'getsourcecode',
                address: address,
                apikey: explorer.apiKey
            }
        });

        if (response.data.status !== '1' || !response.data.result?.[0]) {
            throw new Error(`Failed to fetch contract source code for ${address}`);
        }

        const contractData = response.data.result[0];
        if (contractData.Proxy === '1') {
            console.log(`Warning: ${address} is a proxy contract. Fetching implementation...`);
            return getVerifiedContract(contractData.Implementation, network);
        }

        return {
            sourcecode: contractData.SourceCode,
            abi: JSON.parse(contractData.ABI),
            contractName: contractData.ContractName,
            compilerVersion: contractData.CompilerVersion
        };
    } catch (error) {
        console.error(`Error fetching contract: ${error.message}`);
        throw error;
    }
}

// Helper function to parse function body from source code
function extractFunctionBody(sourceCode, functionName) {
    // This is a simplified version - in practice, you'd want to use a proper Solidity parser
    const functionRegex = new RegExp(`function\\s+${functionName}\\s*\\([^{]*{([^}]*)}`, 'g');
    const match = functionRegex.exec(sourceCode);
    return match ? match[1].trim() : null;
}

// Rest of the functions remain the same, just update the color usage
async function compareContracts(address1, address2, network) {
    console.log(`\nFetching and comparing contracts...`);

    const contract1 = await getVerifiedContract(address1, network);
    const contract2 = await getVerifiedContract(address2, network);

    console.log('\nContract Information:');
    console.log('--------------------');
    console.log(`Contract 1: ${contract1.contractName} (${address1})`);
    console.log(`Contract 2: ${contract2.contractName} (${address2})`);
    console.log(`Compiler: ${contract1.compilerVersion} -> ${contract2.compilerVersion}`);

    // Compare interfaces
    const interface1 = new ethers.utils.Interface(contract1.abi);
    const interface2 = new ethers.utils.Interface(contract2.abi);

    const functions1 = Object.keys(interface1.functions);
    const functions2 = Object.keys(interface2.functions);

    // Find added, removed, and modified functions
    const addedFunctions = functions2.filter(f => !functions1.includes(f));
    const removedFunctions = functions1.filter(f => !functions2.includes(f));
    const commonFunctions = functions1.filter(f => functions2.includes(f));

    // Print interface changes
    console.log('\nInterface Changes:');
    console.log('------------------');

    if (addedFunctions.length > 0) {
        console.log('\nAdded Functions:');
        addedFunctions.forEach(f => {
            console.log(colors.green(`+ ${f}`));
        });
    }

    if (removedFunctions.length > 0) {
        console.log('\nRemoved Functions:');
        removedFunctions.forEach(f => {
            console.log(colors.red(`- ${f}`));
        });
    }

    // Compare implementation of common functions
    console.log('\nFunction Implementation Changes:');
    console.log('-------------------------------');

    for (const funcSig of commonFunctions) {
        const funcName = funcSig.split('(')[0];
        const body1 = extractFunctionBody(contract1.sourcecode, funcName);
        const body2 = extractFunctionBody(contract2.sourcecode, funcName);

        if (body1 && body2 && body1 !== body2) {
            console.log(`\nFunction: ${funcSig}`);
            console.log('Changes:');

            const changes = diff.diffLines(body1, body2);
            changes.forEach(change => {
                const text = change.value.replace(/\n$/, '');
                if (change.added) {
                    console.log(colors.green(`+ ${text}`));
                } else if (change.removed) {
                    console.log(colors.red(`- ${text}`));
                } else {
                    console.log(`  ${text}`);
                }
            });
        }
    }

    // Overall contract diff
    console.log('\nOverall Contract Changes:');
    console.log('------------------------');

    const changes = diff.diffLines(contract1.sourcecode, contract2.sourcecode);
    changes.forEach(change => {
        if (change.added || change.removed) {
            const text = change.value.replace(/\n$/, '');
            if (change.added) {
                console.log(colors.green(`+ ${text}`));
            } else {
                console.log(colors.red(`- ${text}`));
            }
        }
    });
}


async function main() {
    try {
        // Check if addresses were passed as command line arguments
        const [,, address1, address2] = process.argv;

        let selectedNetwork;
        let contractAddress1;
        let contractAddress2;

        if (address1 && address2) {
            // Use provided addresses
            contractAddress1 = address1;
            contractAddress2 = address2;

            // For provided addresses, default to avalanche network or let user choose
            const networks = Object.keys(EXPLORERS);
            const selectedNetworkIndex = await promptUser('Select network:', networks);
            selectedNetwork = networks[selectedNetworkIndex];
        } else {
            // If no addresses provided, go into interactive mode
            const networks = Object.keys(EXPLORERS);
            const selectedNetworkIndex = await promptUser('Select network:', networks);
            selectedNetwork = networks[selectedNetworkIndex];

            contractAddress1 = await promptUser('Enter first contract address:');
            contractAddress2 = await promptUser('Enter second contract address:');
        }

        await compareContracts(contractAddress1, contractAddress2, selectedNetwork);

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Error:', error);
            process.exit(1);
        });
}

module.exports = { compareContracts };