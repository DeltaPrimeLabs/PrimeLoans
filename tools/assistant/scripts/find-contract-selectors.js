const fs = require('fs');
const path = require('path');
const ethers = require('ethers');
const readline = require('readline');

// ABI for Diamond Loupe interface
const DIAMOND_LOUPE_ABI = [
    "function facets() external view returns (tuple(address facetAddress, bytes4[] functionSelectors)[] memory facets_)",
    "function facetFunctionSelectors(address _facet) external view returns (bytes4[] memory)",
    "function facetAddresses() external view returns (address[] memory)",
    "function facetAddress(bytes4 _functionSelector) external view returns (address)"
];

// Network configurations
const NETWORKS = {
    avalanche: {
        rpc: "https://api.avax.network/ext/bc/C/rpc",
        diamond: "0x2916B3bf7C35bd21e63D01C93C62FB0d4994e56D"
    },
    arbitrum: {
        rpc: "https://arb1.arbitrum.io/rpc",
        diamond: "0x62Cf82FB0484aF382714cD09296260edc1DC0c6c"
    }
};

// Helper function to get selectors from contract interface
function getSelectors(contractInterface) {
    const signatures = Object.keys(contractInterface.functions);
    return signatures.reduce((acc, signature) => {
        // Skip init function as it's special
        if (signature !== 'init(bytes)') {
            const selector = contractInterface.getSighash(signature);
            acc.push({
                signature,
                selector,
                name: signature.split('(')[0]
            });
        }
        return acc;
    }, []);
}

// Helper function to recursively find all JSON files
function findJsonFiles(startPath) {
    let results = [];

    function recursiveFind(currentPath) {
        const files = fs.readdirSync(currentPath);
        for (const file of files) {
            const filePath = path.join(currentPath, file);
            const stat = fs.statSync(filePath);

            if (stat.isDirectory()) {
                recursiveFind(filePath);
            } else if (file.endsWith('.json')) {
                try {
                    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    if (content.abi) {
                        results.push({
                            path: filePath,
                            name: file.replace('.json', ''),
                            fullPath: filePath,
                            abi: content.abi
                        });
                    }
                } catch (e) {
                    // Skip invalid JSON files
                }
            }
        }
    }

    recursiveFind(startPath);
    return results;
}

// Helper function for fuzzy matching
function fuzzyMatch(pattern, str) {
    pattern = pattern.toLowerCase();
    str = str.toLowerCase();

    let score = 0;
    let patternIdx = 0;
    let strIdx = 0;

    while (patternIdx < pattern.length && strIdx < str.length) {
        if (pattern[patternIdx] === str[strIdx]) {
            score++;
            patternIdx++;
        }
        strIdx++;
    }

    return {
        score: score,
        lengthDiff: Math.abs(pattern.length - str.length)
    };
}

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

async function findContractSelectors(contractPatternName = null) {
    try {
        const artifactsPath = path.join(process.cwd(), 'artifacts/contracts');
        const contractName = contractPatternName || await promptUser('Enter the contract name pattern:');

        const contractFiles = findJsonFiles(artifactsPath);

        const matches = contractFiles
            .map(file => ({
                ...file,
                matchScore: fuzzyMatch(contractName, file.name)
            }))
            .filter(file => file.matchScore.score > 0)
            .sort((a, b) => {
                // First sort by score
                if (b.matchScore.score !== a.matchScore.score) {
                    return b.matchScore.score - a.matchScore.score;
                }
                // Then by length difference (prefer closer length matches)
                return a.matchScore.lengthDiff - b.matchScore.lengthDiff;
            })
            .slice(0, 5);

        if (matches.length === 0) {
            console.error('No matching contracts found');
            return;
        }

        // If we have an exact match and a pattern was provided, use it directly
        let selectedContract;
        if (contractPatternName && matches.length > 0 && matches[0].name.toLowerCase() === contractPatternName.toLowerCase()) {
            selectedContract = matches[0];
            console.log(`Found exact match: ${selectedContract.name}`);
        } else {
            const selectedIndex = await promptUser(
                'Select the contract:',
                matches.map(m => `${m.name} (${m.path})`)
            );
            selectedContract = matches[selectedIndex];
        }

        const contractInterface = new ethers.utils.Interface(selectedContract.abi);
        const selectors = getSelectors(contractInterface);

        console.log('\nFunction Selectors:');
        console.log('-------------------');
        selectors.forEach(({ signature, selector, name }) => {
            console.log(`\nFunction: ${name}`);
            console.log(`Signature: ${signature}`);
            console.log(`Selector: ${selector}`);
        });

        // Optional: Check if these selectors exist in a deployed diamond
        const checkDiamond = await promptUser('\nWould you like to check these selectors against a deployed diamond? (y/n)');

        if (checkDiamond.toLowerCase() === 'y') {
            const networks = Object.keys(NETWORKS);
            const selectedNetworkIndex = await promptUser('Select network:', networks);
            const network = networks[selectedNetworkIndex];

            const provider = new ethers.providers.JsonRpcProvider(NETWORKS[network].rpc);
            const diamond = new ethers.Contract(NETWORKS[network].diamond, DIAMOND_LOUPE_ABI, provider);

            console.log('\nChecking selectors against diamond...');
            console.log('-----------------------------------');

            for (const { signature, selector, name } of selectors) {
                const facetAddress = await diamond.facetAddress(selector);
                const status = facetAddress === ethers.constants.AddressZero ?
                    'Not in diamond' :
                    `Exists in diamond at ${facetAddress}`;

                console.log(`\nFunction: ${name}`);
                console.log(`Signature: ${signature}`);
                console.log(`Selector: ${selector}`);
                console.log(`Status: ${status}`);
            }
        }

    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}

if (require.main === module) {
    const contractName = process.argv[2];
    findContractSelectors(contractName)
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Error:', error);
            process.exit(1);
        });
}

module.exports = { findContractSelectors };