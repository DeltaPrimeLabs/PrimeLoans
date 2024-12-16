const fs = require('fs');
const path = require('path');
const axios = require('axios');
const ethers = require('ethers');
const diff = require('diff');
const readline = require('readline');
const Anthropic = require('@anthropic-ai/sdk');

// Initialize Anthropic client
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

// Simple color functions for terminals without chalk
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

async function analyzeChangesWithClaude(oldCode, newCode) {
    try {
        // First, get a basic diff to identify changed areas
        const changes = diff.structuredPatch('old.sol', 'new.sol', oldCode, newCode);

        // Extract relevant parts around changes
        let relevantChanges = [];
        changes.hunks.forEach(hunk => {
            const context = [];

            // Add some lines before the change for context
            const beforeStart = Math.max(hunk.oldStart - 5, 0);
            for (let i = beforeStart; i < hunk.oldStart; i++) {
                const line = oldCode.split('\n')[i];
                if (line) context.push(`Context: ${line}`);
            }

            // Add the changes
            hunk.lines.forEach(line => {
                if (line.startsWith('+')) {
                    context.push(`Added: ${line.substring(1)}`);
                } else if (line.startsWith('-')) {
                    context.push(`Removed: ${line.substring(1)}`);
                }
            });

            relevantChanges.push(context.join('\n'));
        });

        const prompt = `You are a smart contract security expert. I will show you the changes between two versions of a Solidity smart contract.
The contract name is ${changes.oldHeader}. Here are the relevant changes:

${relevantChanges.join('\n\n')}

Please analyze these changes and provide:
1. A summary of key functional changes
2. Potential security implications
3. Any timing or access control modifications
4. Gas efficiency impacts
5. Breaking changes that might affect integrating contracts

Focus on the most important changes and their implications.`;

        const message = await anthropic.messages.create({
            model: "claude-3-opus-20240229",
            max_tokens: 4000,
            messages: [{
                role: "user",
                content: prompt
            }],
        });

        return message.content;

    } catch (error) {
        console.error('Error calling Claude API:', error.message);
        if (error.message.includes('too long')) {
            // If still too long, try with even less context
            try {
                const basicChangesPrompt = `You are a smart contract security expert. Here's a high-level summary of changes between two versions of a Solidity contract:

Key changes found:
${diff.createPatch('contract', oldCode, newCode)
                    .split('\n')
                    .filter(line => line.startsWith('+') || line.startsWith('-'))
                    .slice(0, 100) // Limit to first 100 changes
                    .join('\n')}

Please analyze these changes focusing on:
1. Security implications
2. Access control changes
3. Critical functional changes
4. Potential risks`;

                const fallbackMessage = await anthropic.messages.create({
                    model: "claude-3-opus-20240229",
                    max_tokens: 4000,
                    messages: [{
                        role: "user",
                        content: basicChangesPrompt
                    }],
                });

                return fallbackMessage.content;
            } catch (fallbackError) {
                throw new Error('Failed to analyze changes even with reduced context: ' + fallbackError.message);
            }
        }
        throw error;
    }
}

function createLineDiffs(oldLines, newLines) {
    // Create array of line objects with state
    let lineMap = [];
    let i = 0, j = 0;

    while (i < oldLines.length || j < newLines.length) {
        if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
            lineMap.push({ type: 'unchanged', content: oldLines[i], lineNum: i });
            i++;
            j++;
        } else {
            let foundMatch = false;
            let lookAhead = 1;
            const MAX_LOOKAHEAD = 5;

            while (!foundMatch && lookAhead <= MAX_LOOKAHEAD) {
                if (i + lookAhead < oldLines.length &&
                    j < newLines.length &&
                    oldLines[i + lookAhead] === newLines[j]) {
                    for (let k = 0; k < lookAhead; k++) {
                        lineMap.push({ type: 'removed', content: oldLines[i + k], lineNum: i + k });
                    }
                    i += lookAhead;
                    foundMatch = true;
                } else if (i < oldLines.length &&
                    j + lookAhead < newLines.length &&
                    oldLines[i] === newLines[j + lookAhead]) {
                    for (let k = 0; k < lookAhead; k++) {
                        lineMap.push({ type: 'added', content: newLines[j + k], lineNum: j + k });
                    }
                    j += lookAhead;
                    foundMatch = true;
                }
                lookAhead++;
            }

            if (!foundMatch) {
                if (i < oldLines.length) {
                    lineMap.push({ type: 'removed', content: oldLines[i], lineNum: i });
                    i++;
                }
                if (j < newLines.length) {
                    lineMap.push({ type: 'added', content: newLines[j], lineNum: j });
                    j++;
                }
            }
        }
    }
    return lineMap;
}

async function compareContracts(contract1, contract2) {
    console.log('\nContract Information:');
    console.log('====================');
    console.log(`Contract 1: ${contract1.contractName}`);
    console.log(`Contract 2: ${contract2.contractName}`);
    console.log(`Compiler: ${contract1.compilerVersion} -> ${contract2.compilerVersion}`);

    const CONTEXT_LINES = 2; // Number of lines to show before and after changes

    function extractFunctionBody(sourceCode, functionName) {
        const functionRegex = new RegExp(`function\\s+${functionName}\\s*\\([^{]*{([^}]*)}`, 'g');
        const match = functionRegex.exec(sourceCode);
        return match ? match[1].trim() : null;
    }

    function printDiffWithContext(funcSig, oldContent, newContent) {
        console.log(`\nFunction: ${funcSig}`);
        console.log('─'.repeat(funcSig.length + 10));

        const oldLines = oldContent.split('\n');
        const newLines = newContent.split('\n');
        const lineDiffs = createLineDiffs(oldLines, newLines);

        let lastPrinted = -1;
        let inChange = false;

        for (let i = 0; i < lineDiffs.length; i++) {
            const line = lineDiffs[i];

            if (line.type !== 'unchanged') {
                if (!inChange) {
                    console.log('');
                    const contextStart = Math.max(0, i - CONTEXT_LINES);
                    for (let j = contextStart; j < i; j++) {
                        console.log(`  ${lineDiffs[j].content}`);
                    }
                }

                const prefix = line.type === 'added' ? '+' : '-';
                const color = line.type === 'added' ? colors.green : colors.red;
                console.log(color(`${prefix} ${line.content}`));

                inChange = true;
                lastPrinted = i;
            } else if (inChange && i <= lastPrinted + CONTEXT_LINES) {
                console.log(`  ${line.content}`);
                lastPrinted = i;
            } else {
                inChange = false;
            }
        }
    }

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
    if (addedFunctions.length > 0 || removedFunctions.length > 0) {
        console.log('\nInterface Changes:');
        console.log('==================');

        if (addedFunctions.length > 0) {
            console.log('\nAdded Functions:');
            addedFunctions.forEach(f => console.log(colors.green(`+ ${f}`)));
        }

        if (removedFunctions.length > 0) {
            console.log('\nRemoved Functions:');
            removedFunctions.forEach(f => console.log(colors.red(`- ${f}`)));
        }
    }

    // Compare implementation of common functions
    console.log('\nFunction Implementation Changes:');
    console.log('===============================');

    for (const funcSig of commonFunctions) {
        const body1 = extractFunctionBody(contract1.sourcecode, funcSig.split('(')[0]);
        const body2 = extractFunctionBody(contract2.sourcecode, funcSig.split('(')[0]);

        if (body1 && body2 && body1 !== body2) {
            printDiffWithContext(funcSig, body1, body2);
        }
    }
}

async function analyzeContract(address1, address2, network) {
    const contract1 = await getVerifiedContract(address1, network);
    const contract2 = await getVerifiedContract(address2, network);

    if (process.env.ANTHROPIC_API_KEY) {
        console.log('\nFetching semantic analysis from Claude...');
        try {
            const analysis = await analyzeChangesWithClaude(
                contract1.sourcecode,
                contract2.sourcecode
            );

            console.log('\nClaude\'s Analysis:');
            console.log('=================\n');
            console.log(analysis);
        } catch (error) {
            console.error('Failed to get analysis from Claude:', error);
            console.log('Proceeding with standard diff comparison...');
        }
    }

    // Perform regular diff comparison
    await compareContracts(contract1, contract2);
}

async function main() {
    try {
        const [,, address1, address2] = process.argv;
        let selectedNetwork;
        let contractAddress1;
        let contractAddress2;

        if (!process.env.ANTHROPIC_API_KEY) {
            console.warn('\nWarning: ANTHROPIC_API_KEY not found in environment variables.');
            console.warn('Claude analysis will be skipped.\n');
        }

        if (address1 && address2) {
            contractAddress1 = address1;
            contractAddress2 = address2;

            const networks = Object.keys(EXPLORERS);
            const selectedNetworkIndex = await promptUser('Select network:', networks);
            selectedNetwork = networks[selectedNetworkIndex];
        } else {
            const networks = Object.keys(EXPLORERS);
            const selectedNetworkIndex = await promptUser('Select network:', networks);
            selectedNetwork = networks[selectedNetworkIndex];

            contractAddress1 = await promptUser('Enter first contract address:');
            contractAddress2 = await promptUser('Enter second contract address:');
        }

        await analyzeContract(contractAddress1, contractAddress2, selectedNetwork);

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

module.exports = { analyzeContract };