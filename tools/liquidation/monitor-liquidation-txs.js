const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const https = require('https');

function readLastUsedBlockNumber(){
    return fs.readFileSync('./tools/liquidation/lastUsedBlock').toString().trim();
}

function writeLastUsedBlockNumber(lastUsedBlockNumber){
    fs.writeFileSync('./tools/liquidation/lastUsedBlock', lastUsedBlockNumber, 'utf8');
}


async function getTxs(url){
    return fetch(url).then((res) => {return res.json()});
}

async function postData(url = '', data = {}) {
    // Default options are marked with *
    const response = await fetch(url, {
        method: 'POST', // *GET, POST, PUT, DELETE, etc.
        mode: 'cors', // no-cors, *cors, same-origin
        cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
        credentials: 'same-origin', // include, *same-origin, omit
        headers: {
            'Content-Type': 'application/json'
            // 'Content-Type': 'application/x-www-form-urlencoded',
        },
        redirect: 'follow', // manual, *follow, error
        referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
        body: JSON.stringify(data) // body data type must match "Content-Type" header
    });
    return response.status; // parses JSON response into native JavaScript objects
}

function reportFailedLiquidationTxs(txHashes){
    console.log(`Reporting failed txs: ${txHashes}`)
    postData('https://hc-ping.com/a0098c33-3762-4a00-943c-34bf0da4ff1f/fail', { failedLiquidations: txHashes })
        .then((statusCode) => {
            if(statusCode === 200){
                console.log('Ping succeeded.'); // JSON data parsed by `data.json()` call
            }
        });
}


function healthcheckPing() {
    console.log(`[HEALTHCHECK] Ping!`);
    // BETA-HR: https://hc-ping.com/3bd80bcc-e9c8-48b8-8f44-e672bb498700
    // BETA-LTV: https://hc-ping.com/5db347bf-6516-4f9b-99ce-5bdcd88e12d0
    // BETA-2k-2k: https://hc-ping.com/cdc33b7f-e908-4598-8c0b-f0343c2cffd4
    // LoansThatStayInsolvent: https://hc-ping.com/d96fe5e4-6843-44d3-8c2c-813ee82f2285
    // FailedLiquidationTxs: https://hc-ping.com/a0098c33-3762-4a00-943c-34bf0da4ff1f
    https.get('https://hc-ping.com/a0098c33-3762-4a00-943c-34bf0da4ff1f').on('error', (err) => {
        console.log('Ping failed: ' + err)
    });
}


async function getTxHistory() {
    healthcheckPing();

    const address = '0xe8D4E496ef28A0A6E0F2ce7805ff12482D8FdCE6';
    const apiKey = ';'
    const lastBlock = readLastUsedBlockNumber();
    const startBlock = lastBlock !== undefined ? (Number(lastBlock) + 1).toString() : 0;
    const endBlock = 99999999;
    const txPerPage = 1000;

    const url = `https://api.snowtrace.io/api?module=account&action=txlist` +
        `&address=${address}` +
        `&startblock=${startBlock}` +
        `&endblock=${endBlock}` +
        `&page=1` +
        `&offset=${txPerPage}` +
        `&sort=asc` +
        `&apikey=${apiKey}`

    let result = (await getTxs(url))['result']

    console.log(`Got ${result.length} transactions`)

    let counter = 0;
    let txHashes = [];
    for(const tx of result){
        if(tx['functionName'].includes('execute') && tx['isError'] === '1'){
            counter++;
            writeLastUsedBlockNumber(tx['blockNumber']);
            txHashes.push(tx['hash'])
        }
    }
    if(txHashes.length > 0){
        reportFailedLiquidationTxs(txHashes);
    }
    console.log(`${counter} of the txs are LIQUIDATION txs`)
    setTimeout(getTxHistory, 60 * 1000);
}

const run = getTxHistory;

run();