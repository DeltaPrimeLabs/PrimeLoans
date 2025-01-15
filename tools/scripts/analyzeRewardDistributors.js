const {ethers} = require('ethers');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

function getProvider() {
    return new ethers.providers.JsonRpcProvider('https://avax.nirvanalabs.xyz/avalanche_aws/ext/bc/C/rpc?apikey=284d7cde-5c20-46a9-abee-2e3932cdb771');
}

async function getEvents(url) {
    return fetch(url).then((res) => {
        return res.json()
    });
}

function secondsToString(seconds) {
    const days = Math.floor(seconds / 86400);
    seconds = seconds % 86400;
    const hours = Math.floor(seconds / 3600);
    seconds = seconds % 3600;
    const minutes = Math.floor(seconds / 60);
    seconds = seconds % 60;

    let str = `${days} days`;
    if (hours > 0) {
        str += ` ${hours} hours`;
    }
    if (minutes > 0) {
        str += ` ${minutes} minutes`;
    }
    if (seconds > 0) {
        str += ` ${seconds} seconds`;
    }

    return str;
}

async function isContract(address, provider) {
    const code = await provider.getCode(address);
    return code !== '0x';
}

async function getRewardPaidEvents(address, startBlock, endBlock, interface) {
    const eventsPerPage = 1000;
    let explorerRPC = 'https://api.snowtrace.io';
    let page = 1;
    let events = [];

    const rewardPaidTopic = interface.getEventTopic('RewardPaid');

    while(true) {
        let url = `${explorerRPC}/api?module=logs&action=getLogs` +
            `&address=${address}` +
            `&fromBlock=${startBlock}` +
            `&toBlock=${endBlock}` +
            `&page=${page}` +
            `&offset=${eventsPerPage}`;

        let apiResult = await getEvents(url);
        let logs = apiResult['result'];

        if (!Array.isArray(logs) || logs.length === 0) {
            break;
        }

        for (const log of logs) {
            try {
                if (log.topics[0] === rewardPaidTopic) {
                    const [, reward] = interface.decodeEventLog('RewardPaid', log.data, log.topics);
                    events.push({
                        address: log.address,
                        reward,
                        timestamp: parseInt(log.timeStamp, 16)
                    });
                }
            } catch (error) {
                console.error('Error processing log:', error);
                continue;
            }
        }

        if (logs.length < eventsPerPage) {
            break;
        }
        page += 1;
    }

    return events;
}

async function getMultisigTransactions(multisigAddress, startBlock, endBlock, provider) {
    const eventsPerPage = 1000;
    let explorerRPC = 'https://api.snowtrace.io';
    let page = 1;
    let events = [];

    while(true) {
        let url = `${explorerRPC}/api?module=account&action=txlist` +
            `&address=${multisigAddress}` +
            `&startblock=${startBlock}` +
            `&endblock=${endBlock}` +
            `&page=${page}` +
            `&offset=${eventsPerPage}` +
            `&sort=asc`;

        let apiResult = await getEvents(url);
        let txs = apiResult['result'];

        if (!Array.isArray(txs) || txs.length === 0) {
            break;
        }

        // For each transaction, get its receipt to check for RewardAdded events
        for (const tx of txs) {
            try {
                // Get transaction receipt to check for events
                let receiptUrl = `${explorerRPC}/api?module=proxy&action=eth_getTransactionReceipt&txhash=${tx.hash}`;
                let receiptResult = await getEvents(receiptUrl);
                let receipt = receiptResult['result'];

                if (receipt && receipt.logs) {
                    events.push({
                        txHash: tx.hash,
                        timestamp: parseInt(tx.timeStamp),
                        logs: receipt.logs
                    });
                }
            } catch (error) {
                console.error('Error getting transaction receipt:', error);
                continue;
            }
        }

        if (txs.length < eventsPerPage) {
            break;
        }
        page += 1;
    }

    return events;
}

async function analyzeRewardDistributor(rewardDistributor, startBlock, rewardTokenSymbol, rewardToken) {
    const eventsByHash = new Map(); // Use Map to track unique transactions
    const uniqueTransfers = new Map();

    const provider = getProvider();
    const endBlock = await provider.getBlockNumber();
    const MULTISIG_ADDRESS = '0x44AfCcF712E8A097a6727B48b57c75d7A85a9B0c';

    const eventAbi = [
        "event RewardAdded(uint256 reward)",
        "event RewardsDurationUpdated(uint256 duration)",
        "event RewardPaid(address indexed account, uint256 reward)"
    ];
    const interface = new ethers.utils.Interface(eventAbi);

    const rewardsPaidByContract = new Map();
    const eventsPerPage = 1000;
    let explorerRPC = 'https://api.snowtrace.io';
    let events = [];
    let page = 1;

    const rewardAddedTopic = interface.getEventTopic('RewardAdded');
    const durationUpdatedTopic = interface.getEventTopic('RewardsDurationUpdated');

    console.log('Fetching events from rewarder...');

    // Get events directly from rewarder
    let processedLogs = 0;
    let previousLogsLength = -1; // To detect if we're getting the same logs

    while(true) {
        let url = `${explorerRPC}/api?module=logs&action=getLogs` +
            `&address=${rewardDistributor}` +
            `&fromBlock=${startBlock}` +
            `&toBlock=${endBlock}` +
            `&page=${page}` +
            `&offset=${eventsPerPage}`;

        console.log(`Fetching page ${page}...`);
        let apiResult = await getEvents(url);
        let logs = apiResult['result'];

        if (!Array.isArray(logs) || logs.length === 0) {
            console.log('No more logs found.');
            break;
        }

        // Check if we're getting the same logs as before
        if (logs.length === previousLogsLength) {
            console.log('Received same number of logs as previous page, breaking to avoid infinite loop');
            break;
        }
        previousLogsLength = logs.length;

        console.log(`Processing ${logs.length} logs on page ${page}`);

        for (const log of logs) {
            processedLogs++;
            try {
                const topics = log.topics;
                const timestamp = parseInt(log.timeStamp, 16);

                if (topics[0] === rewardAddedTopic) {
                    const [reward] = interface.decodeEventLog('RewardAdded', log.data, topics);
                    const rewardAmount = parseFloat(ethers.utils.formatEther(reward));
                    // Store in Map using transaction hash as key
                    eventsByHash.set(log.transactionHash, {
                        hash: log.transactionHash,
                        timestamp,
                        message: `notifyRewardsAmounts ${rewardAmount} ${rewardTokenSymbol}`
                    });
                }
                else if (topics[0] === durationUpdatedTopic) {
                    const [duration] = interface.decodeEventLog('RewardsDurationUpdated', log.data, topics);
                    const seconds = parseFloat(duration.toString());
                    events.push({
                        timestamp,
                        message: `setRewardsDuration ${seconds} seconds${seconds >= 86400 ? ` (${secondsToString(seconds)})` : ''}`
                    });
                }
            } catch (error) {
                console.error('Error processing log:', error);
                continue;
            }
        }

        if (logs.length < eventsPerPage) {
            console.log('Reached last page of logs');
            break;
        }

        page += 1;

        // Add a safety check to prevent infinite loops
        if (page > 100) { // Arbitrary limit, adjust as needed
            console.log('Reached maximum page limit, stopping');
            break;
        }
    }

    console.log(`Finished processing ${processedLogs} total logs`);

    // Get multisig transactions
    const multisigTxs = await getMultisigTransactions(MULTISIG_ADDRESS, startBlock, endBlock, provider);

    console.log('\nAnalyzing multisig transactions...');
    for (const tx of multisigTxs) {
        if (tx.logs) {
            for (const log of tx.logs) {
                try {
                    if (log.address.toLowerCase() === rewardDistributor.toLowerCase() &&
                        log.topics[0] === rewardAddedTopic) {
                        const [reward] = interface.decodeEventLog('RewardAdded', log.data, log.topics);
                        const rewardAmount = parseFloat(ethers.utils.formatEther(reward));
                        // Store in same Map - will overwrite if already exists
                        eventsByHash.set(tx.txHash, {
                            hash: tx.txHash,
                            timestamp: tx.timestamp,
                            message: `notifyRewardsAmounts ${rewardAmount} ${rewardTokenSymbol} (via Multisig)`
                        });
                    }
                } catch (error) {
                    console.error('Error processing multisig log:', error);
                    continue;
                }
            }
        }
    }

    events.push(...eventsByHash.values());

    // Fetch token transfers
    let txs = [];
    let next;
    while(true) {
        let url = `https://api.routescan.io/v2/network/mainnet/evm/43114/address/${rewardDistributor}/erc20-transfers?ecosystem=avalanche&includedChainIds=43114` +
            `&direction=received` +
            `&limit=100`;
        if (next) {
            url += `&next=${next}`;
        }

        let apiResult = await getEvents(url);
        let partialResult = apiResult['items'];
        txs.push(...partialResult);
        next = apiResult['link']['nextToken'];

        if (!next) {
            break;
        }
    }

    const addressMapping = {
        '0x18c244c62372df1b933cd455769f9b4ddb820f0c': 'DeltaPrime',
        '0x6cafe2f3a293736dc13a08a03a272d1dd36affd1': 'Avalanche',
        '0x44afccf712e8a097a6727b48b57c75d7a85a9b0c': 'Multisig'
    };

    console.log(`Fund txs:`)
    console.log(txs.map(el => el.txHash));

    const rewardTokenReceiveTxs = txs.filter(tx => tx.tokenAddress.toLowerCase() === rewardToken.toLowerCase());
    const totalTokensSentPerAddress = {}

    rewardTokenReceiveTxs.forEach(tx => {
        const from = tx.from.toLowerCase();
        const rewardInWei = ethers.BigNumber.from(tx.amount);
        const reward = parseFloat(ethers.utils.formatEther(rewardInWei));
        events.push({
            timestamp: Math.floor(new Date(tx.timestamp).getTime() / 1000),
            message: `${addressMapping[from] || from} FUND with ${reward} ${rewardTokenSymbol}`
        });
        totalTokensSentPerAddress[addressMapping[from] || from] = (totalTokensSentPerAddress[addressMapping[from] || from] || 0) + reward;
    });

    const totalTokensFunded = Object.values(totalTokensSentPerAddress).reduce((acc, val) => acc + val, 0);

    // Calculate total rewards notified
    const totalNotifyAmount = events
        .filter(e => e.message.includes('notifyRewardsAmounts'))
        .reduce((acc, evt) => {
            const amount = parseFloat(evt.message.split(' ')[1]);
            return acc + amount;
        }, 0);

    // notifyRewardsAmounts tx hashes
    const notifyRewardsAmountsTxs = events
        .filter(e => e.message.includes('notifyRewardsAmounts')).map(el => el.hash)

    console.log(`XXX: ${notifyRewardsAmountsTxs}`)

    // Track outgoing transfers
    let outTxs = [];
    next = undefined;
    while(true) {
        let url = `https://api.routescan.io/v2/network/mainnet/evm/43114/address/${rewardDistributor}/erc20-transfers?ecosystem=avalanche&includedChainIds=43114` +
            `&direction=sent` +
            `&limit=100`;
        if (next) {
            url += `&next=${next}`;
        }

        let apiResult = await getEvents(url);
        let partialResult = apiResult['items'];
        outTxs.push(...partialResult);
        next = apiResult['link']['nextToken'];

        if (!next) {
            break;
        }
    }

    const rewardTokenSentTxs = outTxs.filter(tx => tx.tokenAddress.toLowerCase() === rewardToken.toLowerCase());
    const recipientAddresses = new Set(rewardTokenSentTxs.map(tx => tx.to));

    // Get RewardPaid events from the main rewarder
    let mainEvents = await getRewardPaidEvents(rewardDistributor, startBlock, endBlock, interface);
    let totalRewardsPaid = ethers.BigNumber.from(0);
    let rewardsFromMainContract = ethers.BigNumber.from(0);

    for (const event of mainEvents) {
        totalRewardsPaid = totalRewardsPaid.add(event.reward);
        rewardsFromMainContract = rewardsFromMainContract.add(event.reward);
    }
    rewardsPaidByContract.set(rewardDistributor, rewardsFromMainContract);

    // Check each recipient address for RewardPaid events
    console.log('\nChecking recipient contracts for RewardPaid events:');
    for (const address of recipientAddresses) {
        if (await isContract(address, provider)) {
            const contractEvents = await getRewardPaidEvents(address, startBlock, endBlock, interface);
            if (contractEvents.length > 0) {
                let contractTotal = ethers.BigNumber.from(0);
                for (const event of contractEvents) {
                    contractTotal = contractTotal.add(event.reward);
                    totalRewardsPaid = totalRewardsPaid.add(event.reward);
                }
                rewardsPaidByContract.set(address, contractTotal);
                console.log(`Contract ${address}: ${ethers.utils.formatEther(contractTotal)} rewards paid`);
            }
        }
    }



    // Show outgoing transactions
    console.log('\nAll outgoing transactions:');
    for (const tx of rewardTokenSentTxs) {
        // Only count each transfer once by its transaction hash
        if (!uniqueTransfers.has(tx.txHash)) {
            uniqueTransfers.set(tx.txHash, tx);
        }
    }

    const transfersWithoutRewardPaid = [];
    const rewardPaidTopic = interface.getEventTopic('RewardPaid');

    console.log('\nXXX_SUSPICIOUS_TXS:')
    for (const tx of rewardTokenSentTxs) {
        if (!uniqueTransfers.has(tx.txHash)) {
            uniqueTransfers.set(tx.txHash, tx);

            // Get transaction receipt to check for RewardPaid event
            let receiptUrl = `${explorerRPC}/api?module=proxy&action=eth_getTransactionReceipt&txhash=${tx.txHash}`;
            let receiptResult = await getEvents(receiptUrl);
            let receipt = receiptResult['result'];

            if (receipt && receipt.logs) {
                // Check if any log in this transaction is a RewardPaid event from our contract
                const hasRewardPaidEvent = receipt.logs.some(log =>
                    log.address.toLowerCase() === rewardDistributor.toLowerCase() &&
                    log.topics[0] === rewardPaidTopic
                );

                if (!hasRewardPaidEvent) {
                    console.log(tx.txHash);
                    transfersWithoutRewardPaid.push({
                        txHash: tx.txHash,
                        to: tx.to,
                        amount: parseFloat(ethers.utils.formatEther(tx.amount)),
                        timestamp: new Date(tx.timestamp).toLocaleString()
                    });
                }
            }
        }
    }
    console.log('XXX_END_SUSPICIOUS_TXS')

// Calculate totals from unique transfers
    const totalSentOut = Array.from(uniqueTransfers.values()).reduce((acc, tx) => {
        return acc + parseFloat(ethers.utils.formatEther(tx.amount));
    }, 0);

// Log suspicious transfers
    if (transfersWithoutRewardPaid.length > 0) {
        console.log('\nWARNING: Found transfers without corresponding RewardPaid events:');
        console.log('These transfers might be outside the reward claiming mechanism:');
        transfersWithoutRewardPaid.forEach(tx => {
            console.log(`- TX: ${tx.txHash}`);
            console.log(`  To: ${tx.to}`);
            console.log(`  Amount: ${tx.amount}`);
            console.log(`  Time: ${tx.timestamp}`);
        });

        const suspiciousAmount = transfersWithoutRewardPaid.reduce((acc, tx) => acc + tx.amount, 0);
        console.log(`\nTotal amount of suspicious transfers: ${suspiciousAmount}`);
        console.log(`This explains the ${suspiciousAmount} token difference between notified and sent amounts`);
    }

    const totalClaimedFormatted = parseFloat(ethers.utils.formatEther(totalRewardsPaid));


// Update the summary section to include this information
    console.log('\nTransfer totals (after deduplication and verification):');
    console.log('Total sent out through transfers:', totalSentOut);
    console.log('Total claimed through RewardPaid:', totalClaimedFormatted);
    console.log('Difference between sent and claimed:', totalSentOut - totalClaimedFormatted);
    if (transfersWithoutRewardPaid.length > 0) {
        console.log('Amount of suspicious transfers (no RewardPaid event):',
            transfersWithoutRewardPaid.reduce((acc, tx) => acc + tx.amount, 0));
    }


    // Sort and format events
    events = events.sort((e1, e2) => e1.timestamp - e2.timestamp);
    events = events.map(evt => ({
        timestamp: new Date(evt.timestamp * 1000).toLocaleString(),
        message: evt.message
    }));

    console.log('\nEvents:', events);
    console.log('\nRewards breakdown by contract:');
    for (const [address, amount] of rewardsPaidByContract.entries()) {
        console.log(`${address}: ${ethers.utils.formatEther(amount)} ${rewardTokenSymbol}`);
    }

    console.log('\nSummary:');
    console.log('Total tokens sent per address:', totalTokensSentPerAddress);
    console.log('Total tokens funded:', totalTokensFunded);
    console.log('Used in notifyRewardAmount:', totalNotifyAmount);
    console.log('Total claimed (all contracts):', totalClaimedFormatted);
    console.log('True unused tokens:', totalTokensFunded - totalNotifyAmount);

    // Additional verification
    const erc20Abi = ["function balanceOf(address) view returns (uint256)"];
    const tokenContract = new ethers.Contract(rewardToken, erc20Abi, provider);
    const currentBalance = await tokenContract.balanceOf(rewardDistributor);
    const currentBalanceFormatted = parseFloat(ethers.utils.formatEther(currentBalance));

    console.log('\nBalance verification:');
    console.log('Current balance:', currentBalanceFormatted);
    console.log('Expected balance (funded - claimed):', totalTokensFunded - totalClaimedFormatted);
    console.log('Balance difference:', currentBalanceFormatted - (totalTokensFunded - totalClaimedFormatted));

    // Check if reward period is finished
    rewarderAbi = ["function finishAt() view returns (uint256)"];
    const rewarder = new ethers.Contract(rewardDistributor, rewarderAbi, provider);
    const finishAt = await rewarder.finishAt();
    const currentTimestamp = (await provider.getBlock('latest')).timestamp;
    console.log('\nReward period status:');
    console.log('Current reward period finished:', currentTimestamp > finishAt);

    console.log('\nTransfer totals:');
    console.log('Total sent out through transfers:', totalSentOut);
    console.log('Total claimed through RewardPaid:', totalClaimedFormatted);
    console.log('Difference between sent and claimed:', totalSentOut - totalClaimedFormatted);
}

// OLD ONES
// analyzeRewardDistributor('0x6d149Fcc150A3B097D7647408345898fe9db1ded', 47509821, 'sAVAX', '0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE');
// analyzeRewardDistributor('0x3750F8d6Df82699ada6bBd1463C4E91fCf37005D', 47509886, 'sAVAX', '0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE');
// analyzeRewardDistributor('0xB913aC229910d705297DEB1c168af3dA1416B227', 47509939, 'ggAVAX', '0xA25EaF2906FA1a3a13EdAc9B9657108Af7B703e3');
// analyzeRewardDistributor('0x50b0b59f14bA882BD511Fe08d1cdc975807a94A4', 47510076, 'ggAVAX', '0xA25EaF2906FA1a3a13EdAc9B9657108Af7B703e3');

// NEW ONES
// analyzeRewardDistributor('0x6373122eD8Eda8ECA439415709318DCB6ddC1af3', 50944148, 'sAVAX', '0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE'); // AVAX
// analyzeRewardDistributor('0xBC6Ef309f2eC71698eA310D62FF2E0543472D965', 50944621, 'sAVAX', '0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE'); // USDT
// analyzeRewardDistributor('0x596f6EFD98daF650CF98A1E62A53AB2a44e7E875', 50945439, 'ggAVAX', '0xA25EaF2906FA1a3a13EdAc9B9657108Af7B703e3'); // USDC
analyzeRewardDistributor('0x3FE9BE379eD15962AFAbE01c002B8c433C6Af4ec', 50945648, 'ggAVAX', '0xA25EaF2906FA1a3a13EdAc9B9657108Af7B703e3'); // BTC