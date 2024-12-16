const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const { spawn } = require('child_process');
const readline = require('readline');

// Initialize OpenAI (you'll need to set OPENAI_API_KEY in your environment)
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Available scripts configuration
const SCRIPTS = {
    'find-contract-selectors': {
        path: path.join(__dirname, 'scripts', 'find-contract-selectors.js'),
        description: 'Shows function selectors for a given contract',
        patterns: [
            'selectors for',
            'show selectors',
            'get selectors',
            'what are the selectors',
            'contract selectors',
            'function selectors',
            'selectors of',
            'can you show me selectors',
            'show me selectors',
            'show me the selectors'
        ],
        extractParams: (text) => {
            // Clean and normalize the input text
            const cleanText = text
                .toLowerCase()
                .replace(/\s+/g, ' ')
                .replace(/[^\w\s]/g, '');

            // Try to find contract name after known patterns
            for (const pattern of SCRIPTS['find-contract-selectors'].patterns) {
                const regex = new RegExp(`${pattern}\\s+(?:of\\s+)?([\\w\\s]+)$`, 'i');
                const match = text.match(regex);
                if (match) {
                    // Clean up the contract name by removing spaces and common words
                    const contractName = match[1]
                        .replace(/(facet|contract|prod|the)/gi, '')
                        .replace(/\s+/g, '')
                        .trim();
                    return [contractName];
                }
            }

            // Fallback: try to find any word combinations that might be a contract name
            const contractWords = cleanText.split(' ');
            const potentialContract = contractWords
                .filter(word => word.length > 3) // Filter out short words
                .filter(word => !['show', 'me', 'the', 'selectors', 'of', 'for', 'contract', 'facet'].includes(word))
                .join('');

            return potentialContract ? [potentialContract] : null;
        }
    },
    'protocol-upgrade-with-timelock': {
        path: path.join(__dirname, 'scripts', 'prepare-protocol-upgrade-with-timelock.js'),
        description: 'Prepares protocol upgrade data, including diamondCut calldata, timelock calldata and final report',
        patterns: [
            'prepare diamond cut',
            'generate diamond cut',
            'create diamond cut',
            'upgrade facet',
            'diamond upgrade',
            'diamond cut',
            'timelock',
            'prepare timelock',
            'upgrade',
            'protocol upgrade'
        ],
        extractParams: (text) => [] // No params needed as script handles all prompts
    },
    'check-pools-surplus': {
        path: path.join(__dirname, 'scripts', 'check-pools-surplus.js'),
        description: 'Shows surplus/deficit situation for lending pools',
        patterns: [
            'check surplus',
            'show surplus',
            'pool surplus',
            'check pool surplus',
            'pool balance',
            'check pool balance',
            'show pool balance',
            'check pools',
            'pool status',
            'surplus status'
        ],
        extractParams: (text) => {
            const networks = ['avalanche', 'arbitrum', 'all'];
            // Try to find network specification in the text
            for (const network of networks) {
                if (text.toLowerCase().includes(network)) {
                    return [network];
                }
            }
            return ['all']; // Default to all networks if none specified
        }
    },
    'compare-contracts': {
        path: path.join(__dirname, 'scripts', 'compare-contracts.js'),
        description: 'Compares verified contract code between two addresses on a method-by-method basis',
        patterns: [
            'compare contracts',
            'compare implementations',
            'compare code',
            'diff contracts',
            'show differences',
            'show changes',
            'contract diff',
            'implementation diff',
            'code differences',
            'compare addresses'
        ],
        extractParams: (text) => {
            // Try to find two addresses in the text
            const addressRegex = /0x[a-fA-F0-9]{40}/g;
            const addresses = text.match(addressRegex);

            if (addresses && addresses.length >= 2) {
                return [addresses[0], addresses[1]];
            }

            // If we can't find two addresses, return null to trigger interactive mode
            return null;
        }
    },
    'analyze-token-exposure': {
        path: path.join(__dirname, 'scripts', 'analyze-token-exposure.js'),
        description: 'Analyzes token holdings across all Prime Accounts, showing total exposure and top holders',
        patterns: [
            'analyze token exposure',
            'check token exposure',
            'show token exposure',
            'token distribution',
            'token holders',
            'token balances',
            'analyze holdings',
            'check holdings',
            'token analysis',
            'exposure analysis',
            'analyze exposure',
            'check exposure'
        ],
        extractParams: (text) => [] // No params needed as script handles all prompts interactively
    }
};

// Create readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function analyzeRequest(userInput) {
    try {
        const prompt = `
Given the user request: "${userInput}"

Available scripts and their purposes:
${Object.entries(SCRIPTS).map(([name, config]) =>
            `- ${name}: ${config.description}`
        ).join('\n')}

Analyze the request and provide a JSON response with:
1. Which script (if any) is most appropriate for this request
2. Confidence level (0-100) that this is the right script
3. Brief explanation of why

Return your response in JSON format with the following structure:
{
    "scriptName": "script-name-or-null",
    "confidence": number,
    "explanation": "explanation"
}`;

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo-0125",
            messages: [{ role: "user", content: prompt }],
            temperature: 0,
            response_format: { type: "json_object" }
        });

        return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
        console.error('Error analyzing request:', error);
        return null;
    }
}

async function promptConfirmation(message) {
    return new Promise((resolve) => {
        rl.question(`${message} (y/n): `, (answer) => {
            resolve(answer.toLowerCase() === 'y');
        });
    });
}

async function executeScript(scriptName, params) {
    return new Promise((resolve, reject) => {
        const script = SCRIPTS[scriptName];

        // Temporarily pause the main readline interface
        rl.pause();

        const process = spawn('node', [script.path, ...params], {
            stdio: ['inherit', 'inherit', 'inherit']
        });

        process.on('close', (code) => {
            // Resume the main readline interface
            rl.resume();
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Script exited with code ${code}`));
            }
        });
    });
}

async function processUserInput(input) {
    try {
        // Analyze the request using GPT
        const analysis = await analyzeRequest(input);

        if (!analysis || !analysis.scriptName || analysis.confidence < 70) {
            console.log('\nI\'m not sure what script to use for this request.');
            if (analysis?.explanation) {
                console.log('Reason:', analysis.explanation);
            }
            return;
        }

        const script = SCRIPTS[analysis.scriptName];
        if (!script) {
            console.log('\nScript not found:', analysis.scriptName);
            return;
        }

        // Extract parameters
        const params = script.extractParams(input);
        if (!params) {
            console.log('\nCouldn\'t determine the required parameters from your request.');
            return;
        }

        // Show intention and ask for confirmation
        console.log(`\nI'll use the '${analysis.scriptName}' script with parameters: ${params.join(', ')}`);
        console.log('Reason:', analysis.explanation);

        const confirmed = await promptConfirmation('Should I proceed?');
        if (!confirmed) {
            console.log('Operation cancelled.');
            return;
        }

        // Execute the script
        await executeScript(analysis.scriptName, params);

    } catch (error) {
        console.error('Error:', error.message);
    }
}

async function startAssistant() {
    console.log('DeltaAI Agent ready! (Type "exit" to quit)');

    const askQuestion = () => {
        rl.question('\nHow can I be of an assistance to you today? ', async (input) => {
            if (input.toLowerCase() === 'exit') {
                rl.close();
                return;
            }

            await processUserInput(input);
            askQuestion();
        });
    };

    askQuestion();
}

// Start the assistant
startAssistant();