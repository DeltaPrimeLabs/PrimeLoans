const { Multicall } = require('ethereum-multicall');
const { ethers } = require('ethers');
const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const sPrimeAvaxAddr = '0xd38C5cEca20Fb43503E108ed8d4CaCA5B57E730E';
const sPrimeArbAddr = '0x04d36A9aAD2072C69E4B0Cb2A403D8a893064945';

const vPrimeAvaxAddr = '0x228a19fC13932C67D538fEba858359E369e5a197';
const vPrimeArbAddr = '0x88fBaEa44b85fcC505c1aB1fD884c877A3b3dD42';

function getRpcUrl(chain) {
    if (chain === 'arbitrum') {
        return 'https://nd-820-127-885.p2pify.com/eb20dbbf452bafebd4ea76aa69c6629e'
    } else if (chain === 'avalanche') {
        return 'https://avax.nirvanalabs.xyz/avalanche_aws/ext/bc/C/rpc?apikey=284d7cde-5c20-46a9-abee-2e3932cdb771'
    }
}

function getProvider(chain) {
    return new ethers.providers.JsonRpcProvider(getRpcUrl(chain));
}

async function getSPrimeHolders(chain = "arbitrum") {
    let chainId;
    let sPrimeHolders = [];
    let contractAddress = chain === "avalanche" ? sPrimeAvaxAddr : sPrimeArbAddr;

    if (chain === "arbitrum") {
        chainId = 42161;
    } else if (chain === "avalanche") {
        chainId = 43114;
    }

    let page = 1;
    let limit = 100;
    let hasMoreHolders = true;

    while (hasMoreHolders) {
        const url = `https://api.chainbase.online/v1/token/holders?chain_id=${chainId}&contract_address=${contractAddress}&page=${page}&limit=${limit}`;
        const response = await fetch(url, {
            headers: {
                "x-api-key": ''
            }
        });
        const json = await response.json();

        if (json.data && json.data.length > 0) {
            sPrimeHolders = [...sPrimeHolders, ...json.data];
            page++;

            await new Promise((resolve, reject) => setTimeout(resolve, 600));
        } else {
            hasMoreHolders = false;
        }
    }

    sPrimeHolders = [...new Set(sPrimeHolders)];

    return sPrimeHolders;
}

async function getVPrimeHolders(chain) {
    let holders = [];

    let sPrimeHolders = await getSPrimeHolders(chain);

    const ethersProvider = getProvider(chain);
    const multicall = new Multicall({
        ethersProvider: ethersProvider,
        tryAggregate: true,
    });

    const vPrimeAddr = chain === 'avalanche' ? vPrimeAvaxAddr : vPrimeArbAddr;
    const vPrimeAbi = [
        {
            "inputs": [
                {
                    "internalType": "address",
                    "name": "account",
                    "type": "address"
                }
            ],
            "name": "balanceOf",
            "outputs": [
                {
                    "internalType": "uint256",
                    "name": "",
                    "type": "uint256"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "address",
                    "name": "",
                    "type": "address"
                }
            ],
            "name": "needsUpdate",
            "outputs": [
                {
                    "internalType": "bool",
                    "name": "",
                    "type": "bool"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [],
            "name": "getLastRecordedTotalSupply",
            "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
            "stateMutability": "view",
            "type": "function"
        },
    ];

    let votingPowerSum = ethers.BigNumber.from(0);
    const batchSize = 100;
    for (let i = 0; i < sPrimeHolders.length; i += batchSize) {
        const batch = sPrimeHolders.slice(i, i + batchSize);
        const aggregatedCall = [
            {
                reference: 'needsUpdate',
                contractAddress: vPrimeAddr,
                abi: vPrimeAbi,
                calls: batch.map(addr => ({
                    methodName: 'needsUpdate',
                    methodParameters: [addr],
                })),
            },
            {
                reference: 'votingPower',
                contractAddress: vPrimeAddr,
                abi: vPrimeAbi,
                calls: batch.map(addr => ({
                    methodName: 'balanceOf',
                    methodParameters: [addr],
                })),
            },
        ];
        const { results } = await multicall.call(aggregatedCall);
        for (let j = 0; j < results.needsUpdate.callsReturnContext.length; j++) {
            if (results.needsUpdate.callsReturnContext[j].returnValues[0]) {
                holders.push(batch[j]);
            }
        }
        for (let j = 0; j < results.votingPower.callsReturnContext.length; j++) {
            votingPowerSum = votingPowerSum.add(results.votingPower.callsReturnContext[j].returnValues[0]);
        }
    }

    const vPrime = new ethers.Contract(vPrimeAddr, vPrimeAbi, getProvider(chain));
    const totalVotingPower = await vPrime.getLastRecordedTotalSupply();

    console.log(`Found ${holders.length} vPrime holders that needs update on ${chain} chain.`);
    console.log(`Sum of voting power: ${ethers.utils.formatEther(votingPowerSum)}, total voting power: ${ethers.utils.formatEther(totalVotingPower)}`);

    // write holders to holders-<CHAIN_NAME>.json
    fs.writeFileSync(`holders-${chain}.json`, JSON.stringify(holders));

    return holders;
}

getVPrimeHolders("arbitrum");
