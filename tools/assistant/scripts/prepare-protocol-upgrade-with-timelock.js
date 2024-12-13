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

// List of functions to automatically skip
const EXCLUDED_FUNCTIONS = [
    '_getAllPricesForLiquidation',
    '_getHealthRatio',
    '_getHealthRatioWithPrices',
    '_getThresholdWeightedValue',
    '_getThresholdWeightedValuePayable',
    'extractTimestampsAndAssertAllAreEqual',
    'getPrice'
];

// Network configurations
const NETWORKS = {
    avalanche: {
        rpc: "https://api.avax.network/ext/bc/C/rpc",
        diamond: "0x2916B3bf7C35bd21e63D01C93C62FB0d4994e56D",
        timelock: "0x5C31bF6E2E9565B854E7222742A9a8e3f78ff358"
    },
    arbitrum: {
        rpc: "https://arb1.arbitrum.io/rpc",
        diamond: "0x62Cf82FB0484aF382714cD09296260edc1DC0c6c",
        timelock: "0x43D9A211BDdC5a925fA2b19910D44C51D5c9aa93"
    }
};

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
        output: process.stdout,
        terminal: true
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
                const selection = parseInt(answer.trim());
                if (Number.isInteger(selection) && selection >= 0 && selection < choices.length) {
                    rl.close();
                    resolve(selection);
                } else {
                    console.log(`Invalid selection. Please enter a number between 0 and ${choices.length - 1}`);
                    rl.question('Please select again: ', (newAnswer) => {
                        rl.close();
                        resolve(parseInt(newAnswer.trim()));
                    });
                }
            });
        } else {
            rl.question(message + ' ', (answer) => {
                rl.close();
                resolve(answer.trim());
            });
        }
    });
}

async function selectNetwork() {
    const networks = Object.keys(NETWORKS);
    const selectedIndex = await promptUser('Select network:', networks);
    return networks[selectedIndex];
}

async function getDiamondState(network, provider, contract) {
    const diamond = new ethers.Contract(NETWORKS[network].diamond, DIAMOND_LOUPE_ABI, provider);

    const existingSelectors = new Map();
    const selectorToFunction = new Map();
    const selectorToAddress = new Map();

    for (const func of contract.abi.filter(item => item.type === 'function')) {
        const types = func.inputs.map(input => input.type);
        const selector = ethers.utils.id(`${func.name}(${types.join(',')})`).slice(0, 10);
        const facetAddress = await diamond.facetAddress(selector);

        if (facetAddress === ethers.constants.AddressZero) {
            existingSelectors.set(selector, false);
            selectorToFunction.set(selector, func.name);
            selectorToAddress.set(selector, 'Not in diamond');
        } else {
            existingSelectors.set(selector, facetAddress);
            selectorToFunction.set(selector, func.name);
            selectorToAddress.set(selector, facetAddress);
        }
    }

    return { existingSelectors, selectorToFunction, selectorToAddress };
}

async function prepareProtocolUpgradeWithTimelock() {
    try {
        const network = await selectNetwork();
        console.log(`\nSelected network: ${network}`);

        const targetAddress = NETWORKS[network].diamond;
        const provider = new ethers.providers.JsonRpcProvider(NETWORKS[network].rpc);

        console.log('\nFetching current diamond state...');
        const contractName = await promptUser('\nEnter the contract name pattern:');

        const artifactsPath = path.join(process.cwd(), 'artifacts/contracts');
        const contractFiles = findJsonFiles(artifactsPath);

        const matches = contractFiles
            .map(file => ({
                ...file,
                matchScore: fuzzyMatch(contractName, file.name)
            }))
            .filter(file => file.matchScore.score > 0)
            .sort((a, b) => b.matchScore.score - a.matchScore.score)
            .slice(0, 5);

        if (matches.length === 0) {
            console.error('No matching contracts found');
            return;
        }

        const selectedIndex = await promptUser(
            'Select the contract:',
            matches.map(m => `${m.name} (${m.path})`)
        );
        const selectedContract = matches[selectedIndex];

        const { existingSelectors, selectorToFunction, selectorToAddress } = await getDiamondState(network, provider, selectedContract);

        const cuts = [];
        const rollbackCuts = [];
        const facetAddress = await promptUser('\nEnter the facet address (new implementation):');

        // Keep track of skipped functions for reporting
        const automaticallySkipped = [];

        for (const func of selectedContract.abi.filter(item => item.type === 'function')) {
            const types = func.inputs.map(input => input.type);
            const selector = ethers.utils.id(`${func.name}(${types.join(',')})`).slice(0, 10);

            // Check if function should be automatically skipped
            if (EXCLUDED_FUNCTIONS.includes(func.name)) {
                automaticallySkipped.push(func.name);
                continue;
            }

            console.log(`\nFunction: ${func.name}`);
            console.log(`Selector: ${selector}`);
            console.log(`Current status: ${existingSelectors.get(selector) === false ?
                'Not in diamond' :
                `Exists in diamond at ${selectorToAddress.get(selector)}`}`);

            const action = await promptUser(
                'Choose action:',
                ['Skip', 'Add/Replace', 'Remove']
            );

            if (action === 0) continue;

            const exists = existingSelectors.get(selector) !== false;
            if (action === 1 && exists) {
                cuts.push({ selector, action: 1 });
                rollbackCuts.push({ selector, action: 1, prevAddress: selectorToAddress.get(selector) });
            } else if (action === 1 && !exists) {
                cuts.push({ selector, action: 0 });
                rollbackCuts.push({ selector, action: 2 });
            } else if (action === 2 && exists) {
                cuts.push({ selector, action: 2 });
                rollbackCuts.push({ selector, action: 0, prevAddress: selectorToAddress.get(selector) });
            } else {
                console.log('Invalid action for current selector state - skipping');
                continue;
            }
        }

        if (automaticallySkipped.length > 0) {
            console.log('\nAutomatically skipped the following functions:');
            automaticallySkipped.forEach(funcName => console.log(`- ${funcName}`));
        }

        if (cuts.length === 0) {
            console.log('\nNo changes selected.');
            return;
        }

        const groupedCuts = cuts.reduce((acc, cut) => {
            if (!acc[cut.action]) {
                acc[cut.action] = [];
            }
            acc[cut.action].push(cut.selector);
            return acc;
        }, {});

        const groupedRollbackCuts = rollbackCuts.reduce((acc, cut) => {
            if (!acc[cut.action]) {
                acc[cut.action] = { address: cut.prevAddress || ethers.constants.AddressZero, selectors: [] };
            }
            acc[cut.action].selectors.push(cut.selector);
            return acc;
        }, {});

        const diamondCut = Object.entries(groupedCuts).map(([action, selectors]) => [
            action === '2' ? ethers.constants.AddressZero : facetAddress,
            parseInt(action),
            selectors
        ]);

        const rollbackDiamondCut = Object.entries(groupedRollbackCuts).map(([action, { address, selectors }]) => [
            address,
            parseInt(action),
            selectors
        ]);

        console.log('\nDiamond Cut Details:');
        diamondCut.forEach(([facetAddr, action, selectors]) => {
            console.log(`\nAction: ${['Add', 'Replace', 'Remove'][action]}`);
            console.log(`Facet Address: ${facetAddr}`);
            console.log('Function Selectors:');
            selectors.forEach(selector => console.log(`- ${selector} (${selectorToFunction.get(selector)}) [${selectorToAddress.get(selector)}]`));
        });

        const contractFormat = JSON.stringify(diamondCut, null, 4)
            .replace(/\"/g, '"')
            .replace(/\[/g, '\n    [')
            .replace(/\]\]/g, ']\n]');

        console.log('\nContract-Formatted Diamond Cut:');
        console.log(`[\n${contractFormat.slice(1, -1)}\n]`);

        const diamondInterface = new ethers.utils.Interface([
            `function diamondCut(
                tuple(
                    address facetAddress,
                    uint8 action,
                    bytes4[] functionSelectors
                )[] _diamondCut,
                address _init,
                bytes _calldata
            ) external`
        ]);

        const diamondCalldata = diamondInterface.encodeFunctionData('diamondCut', [
            diamondCut,
            ethers.constants.AddressZero,
            '0x'
        ]);

        console.log('\nPlease provide a description of this diamond cut operation:');
        console.log('(This will be included in the report and can be used for documentation)');
        const description = await promptUser('Description:');

        console.log('\nPrepare Timelock Transaction');
        const timelockAction = await promptUser(
            'Select timelock action:',
            ['Queue and Execute Transactions', 'Cancel Transaction']
        );

        console.log('\nEnter ETA (Estimated Time of Arrival) for the timelock:');
        console.log('Format: YYYY-MM-DD HH:mm');
        console.log('Example: 2024-12-25 14:30');

        const etaInput = await promptUser('Enter date and time:');
        const eta = Math.floor(new Date(etaInput).getTime() / 1000);

        if (isNaN(eta)) {
            throw new Error('Invalid date format');
        }

        const timelockInterface = new ethers.utils.Interface([
            'function queueTransaction(address target, uint256 value, string memory signature, bytes memory data, uint256 eta) public returns (bytes32)',
            'function cancelTransaction(address target, uint256 value, string memory signature, bytes memory data, uint256 eta) public',
            'function executeTransaction(address target, uint256 value, string memory signature, bytes memory data, uint256 eta) public payable returns (bytes memory)'
        ]);

        const timelockParams = [
            targetAddress,
            0,
            '',
            diamondCalldata,
            eta
        ];

        let queueCalldata = '';
        let executeCalldata = '';
        let cancelCalldata = '';
        let actionName = '';
        let rollbackTimelockCalldata = '';

        if (timelockAction === 0) {
            // Queue and Execute
            queueCalldata = timelockInterface.encodeFunctionData('queueTransaction', timelockParams);
            executeCalldata = timelockInterface.encodeFunctionData('executeTransaction', timelockParams);
            actionName = 'queueAndExecute';
        } else {
            // Cancel
            cancelCalldata = timelockInterface.encodeFunctionData('cancelTransaction', timelockParams);
            actionName = 'cancelTransaction';
        }

        // Prepare rollback diamond cut calldata
        const rollbackDiamondCalldata = diamondInterface.encodeFunctionData('diamondCut', [
            rollbackDiamondCut,
            ethers.constants.AddressZero,
            '0x'
        ]);

        // Generate rollback timelock calldata (only for queue and execute)
        if (timelockAction === 0) {
            const rollbackTimelockParams = [
                targetAddress,
                0,
                '',
                rollbackDiamondCalldata,
                eta
            ];
            rollbackTimelockCalldata = timelockInterface.encodeFunctionData('queueTransaction', rollbackTimelockParams);
        }

        // Format the report content
        const timestamp = Math.floor(Date.now() / 1000);
        const filename = `diamond-cut-timelock-${timestamp}.md`;
        const fileContent = `# Timelock Protocol Upgrade Operation Report
> Generated on: ${new Date().toISOString()}

## Operation Description
${description}

## Network Details
- **Network:** ${network}
- **Target Diamond:** \`${targetAddress}\`
- **New Facet Address:** \`${facetAddress}\`
- **Timelock Address:** \`${NETWORKS[network].timelock}\`

## Timelock Details
- **Action:** \`${actionName}\`
- **ETA:** ${new Date(eta * 1000).toISOString()} (Unix: ${eta})

## Diamond Cut Details

### Contract Format
\`\`\`json
${contractFormat}
\`\`\`

### Changes Summary
${diamondCut.map(([facetAddr, action, selectors]) => `
#### ${['Add', 'Replace', 'Remove'][action]} Operations
- **Facet Address:** \`${facetAddr}\`
- **Function Selectors:**
${selectors.map(selector => `  - \`${selector}\` (${selectorToFunction.get(selector)}) [${selectorToAddress.get(selector)}]`).join('\n')}
`).join('\n')}

## Generated Calldata

### Diamond Cut Calldata
\`\`\`
${diamondCalldata}
\`\`\`

### Timelock Transaction Calldata
${timelockAction === 0 ? `
#### Queue Transaction Calldata
\`\`\`
${queueCalldata}
\`\`\`

#### Execute Transaction Calldata
\`\`\`
${executeCalldata}
\`\`\`
` : `
#### Cancel Transaction Calldata
\`\`\`
${cancelCalldata}
\`\`\`
`}

## Raw Timelock Parameters
- **Target:** \`${targetAddress}\`
- **Value:** 0
- **Signature:** _(empty)_
- **Data:** \`${diamondCalldata}\`
- **ETA:** ${eta}

### Automatically Skipped Functions
${automaticallySkipped.map(func => `- ${func}`).join('\n')}

${rollbackTimelockCalldata ? `
## Rollback Details

### Rollback Diamond Cut
\`\`\`json
${JSON.stringify(rollbackDiamondCut, null, 4)}
\`\`\`

### Rollback Timelock Calldata
\`\`\`
${rollbackTimelockCalldata}
\`\`\`

### Rollback Timelock Parameters
- **Target:** \`${targetAddress}\`
- **Value:** 0
- **Signature:** _(empty)_
- **Data:** \`${rollbackDiamondCalldata}\`
- **ETA:** ${eta}
` : ''}

---
_This report was generated by the DeltaAI Agent tool_`;

        fs.writeFileSync(filename, fileContent);

        console.log('\nTimelock Transaction Details:');
        if (timelockAction === 0) {
            console.log('Action: Queue and Execute');
            console.log('\nQueue Transaction:');
            console.log(`Target: ${targetAddress}`);
            console.log(`Timelock: ${NETWORKS[network].timelock}`);
            console.log(`ETA: ${new Date(eta * 1000).toISOString()}`);
            console.log('Calldata:');
            console.log(queueCalldata);

            console.log('\nExecute Transaction:');
            console.log(`Target: ${targetAddress}`);
            console.log(`Timelock: ${NETWORKS[network].timelock}`);
            console.log(`ETA: ${new Date(eta * 1000).toISOString()}`);
            console.log('Calldata:');
            console.log(executeCalldata);
        } else {
            console.log('Action: Cancel');
            console.log(`Target: ${targetAddress}`);
            console.log(`Timelock: ${NETWORKS[network].timelock}`);
            console.log(`ETA: ${new Date(eta * 1000).toISOString()}`);
            console.log('Calldata:');
            console.log(cancelCalldata);
        }

        console.log(`\nDetailed report saved to ${filename}`);
        console.log('\nDescription for ClickUp:');
        console.log('---');
        console.log(description);
        console.log('---');

    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}

if (require.main === module) {
    prepareProtocolUpgradeWithTimelock()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Error:', error);
            process.exit(1);
        });
}

module.exports = { prepareDiamondCut: prepareProtocolUpgradeWithTimelock };