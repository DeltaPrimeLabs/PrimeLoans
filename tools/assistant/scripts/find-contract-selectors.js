const fs = require('fs');
const path = require('path');
const ethers = require('ethers');
const readline = require('readline');

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
                    // Check if file is a contract artifact (should have an ABI)
                    if (content.abi) {
                        results.push({
                            path: filePath,
                            name: file.replace('.json', ''),
                            fullPath: filePath
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

    // Return a score based on matches and length difference
    return {
        score: score,
        lengthDiff: Math.abs(pattern.length - str.length)
    };
}

// Helper function to get function selector
function getFunctionSelector(functionName, types) {
    const signature = `${functionName}(${types.join(',')})`;
    return ethers.utils.id(signature).slice(0, 10);
}

// Create readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false  // Disable terminal mode to prevent double echo
});

async function promptUser(matches) {
    console.log('\nMultiple matching contracts found:');
    matches.forEach((match, index) => {
        console.log(`[${index}] ${match.name} (${match.path})`);
    });

    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: true // Add this line
        });

        const handleAnswer = (answer) => {
            const selection = parseInt(answer.trim());

            if (Number.isInteger(selection) && selection >= 0 && selection < matches.length) {
                rl.close();
                resolve(matches[selection]);
            } else {
                console.log(`Invalid selection. Please enter a number between 0 and ${matches.length - 1}`);
                rl.question('Please select a contract by number: ', handleAnswer);
            }
        };

        rl.question('\nPlease select a contract by number: ', handleAnswer);

        // Add error handler
        rl.on('error', (err) => {
            console.error('readline error:', err);
            rl.close();
            process.exit(1);
        });
    });
}

// Make sure main process handles cleanup
process.on('SIGINT', () => {
    console.log('\nExiting...');
    process.exit(0);
});

async function getContractSelectors(contractNamePattern) {
    try {
        // Find all contract artifacts
        const artifactsPath = path.join(process.cwd(), 'artifacts/contracts');
        const contractFiles = findJsonFiles(artifactsPath);

        // Find matching contracts
        const matches = contractFiles
            .map(file => ({
                ...file,
                matchScore: fuzzyMatch(contractNamePattern, file.name)
            }))
            .filter(file => file.matchScore.score > 0)
            .sort((a, b) => {
                // Sort by score (descending) and then by length difference (ascending)
                if (b.matchScore.score !== a.matchScore.score) {
                    return b.matchScore.score - a.matchScore.score;
                }
                return a.matchScore.lengthDiff - b.matchScore.lengthDiff;
            })
            .slice(0, 5); // Limit to top 5 matches

        if (matches.length === 0) {
            console.error('No matching contracts found');
            process.exit(1);
        }

        // If multiple matches, prompt user to select one
        const selectedContract = matches.length === 1 ?
            matches[0] :
            await promptUser(matches);

        // Read and parse the selected contract
        const artifact = JSON.parse(fs.readFileSync(selectedContract.fullPath, 'utf8'));
        const abi = artifact.abi;

        // Process functions and get their selectors
        const functionSelectors = abi
            .filter(item => item.type === 'function')
            .map(func => {
                const types = func.inputs.map(input => input.type);
                const selector = getFunctionSelector(func.name, types);

                return {
                    name: func.name,
                    signature: `${func.name}(${types.join(',')})`,
                    selector: selector,
                    stateMutability: func.stateMutability,
                    inputs: func.inputs,
                    outputs: func.outputs
                };
            });

        console.log(`\nFunction selectors for ${selectedContract.name}:`);
        console.log('----------------------------------------');
        functionSelectors.forEach(func => {
            console.log(`\nFunction: ${func.name}`);
            console.log(`Signature: ${func.signature}`);
            console.log(`Selector: ${func.selector}`);
            console.log(`State Mutability: ${func.stateMutability}`);
            console.log('Inputs:', func.inputs.map(input => `${input.type} ${input.name}`).join(', ') || 'none');
            console.log('Outputs:', func.outputs.map(output => output.type).join(', ') || 'none');
        });

        rl.close();
        return functionSelectors;
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

// Check if contract name pattern is provided as command line argument
if (process.argv.length < 3) {
    console.error('Please provide the contract name pattern as an argument');
    console.error('Usage: node find-contract-selectors.js ContractNamePattern');
    process.exit(1);
}

const contractNamePattern = process.argv[2];
getContractSelectors(contractNamePattern);