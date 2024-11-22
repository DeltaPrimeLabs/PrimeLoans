const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function getDepositorsAddressesFromChainbase(chain) {
    let chainId;
    let depositors = {};

    if (chain === "arbitrum") {
        chainId = 42161;
    } else if (chain == "avalanche") {
        chainId = 43114;
    }

    const pools = {
        "arbitrum": [
            "0x8FE3842e0B7472a57f2A2D56cF6bCe08517A1De0",
            "0x0BeBEB5679115f143772CfD97359BBcc393d46b3",
            "0x2B8C610F3fC6F883817637d15514293565C3d08A",
            "0x5CdE36c23f0909960BA4D6E8713257C6191f8C35",
            "0xd5E8f691756c3d7b86FD8A89A06497D38D362540"
        ],
        "avalanche": [
            "0xD26E504fc642B96751fD55D3E68AF295806542f5",   // AVAX
            "0xd222e10D7Fe6B7f9608F14A8B5Cf703c74eFBcA1",   // USDT
            "0x2323dAC85C6Ab9bd6a8B5Fb75B0581E31232d12b",   // USDC
            "0x475589b0Ed87591A893Df42EC6076d2499bB63d0",   // BTC
            "0xD7fEB276ba254cD9b34804A986CE9a8C3E359148"    // ETH
        ]
    }

    for (let pool of pools[chain]) {
        let page = 1;
        let limit = 100;
        let hasMoreDepositors = true;

        while (hasMoreDepositors) {
            const url = `https://api.chainbase.online/v1/token/holders?chain_id=${chainId}&contract_address=${pool}&page=${page}&limit=${limit}`;
            const response = await fetch(url, {
                headers: {
                    "x-api-key": ''
                }
            });
            const json = await response.json();

            if (json.data && json.data.length > 0) {
                depositors[pool] = depositors[pool] ? [...depositors[pool], ...json.data] : json.data;
                page++;

                await new Promise((resolve, reject) => setTimeout(resolve, 600));
            } else {
                hasMoreDepositors = false;
            }
        }
        depositors[pool] = [...new Set(depositors[pool])];
        console.log(`Found ${depositors[pool].length} depositors for ${pool} on ${chain} chain.`);

        // write depositors to depositors<POOL><BATCH_NUMBER>.json in batches of 500
        const batchSize = 300;
        const batchedDepositors = depositors[pool].reduce((acc, _, i) => i % batchSize ? acc : [...acc, depositors[pool].slice(i, i + batchSize)], []);
        for (let i = 0; i < batchedDepositors.length; i++) {
            fs.writeFileSync(`depositors${addressToPoolName(pool)}-batch-${i + 1}.json`, JSON.stringify(batchedDepositors[i]));
        }
    }

    return depositors;
}

function addressToPoolName(address) {
    const pools = {
        "0x2323dAC85C6Ab9bd6a8B5Fb75B0581E31232d12b": "USDC",
        "0xd222e10D7Fe6B7f9608F14A8B5Cf703c74eFBcA1": "USDT",
        "0x475589b0Ed87591A893Df42EC6076d2499bB63d0": "BTC",
        "0xD7fEB276ba254cD9b34804A986CE9a8C3E359148": "ETH",
        "0xD26E504fc642B96751fD55D3E68AF295806542f5": "AVAX"
    }

    return pools[address];

}

getDepositorsAddressesFromChainbase("avalanche").then((depositors) => {
});