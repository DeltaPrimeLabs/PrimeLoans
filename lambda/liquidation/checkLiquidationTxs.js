const {ethers} = require('ethers');
const EthDater = require("ethereum-block-by-date");
const fromWei = (val) => parseFloat(ethers.utils.formatEther(val));
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const Promise = require('bluebird');
const TOKEN_ADDRESSES_AVALANCHE = require("../../common/addresses/avax/token_addresses.json");
const TOKEN_ADDRESSES_ARBITRUM = require("../../common/addresses/arbitrum/token_addresses.json");
const fromBytes32 = require('ethers').utils.parseBytes32String;
const knownPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const formatUnits = (val, decimalPlaces) => parseFloat(ethers.utils.formatUnits(val, decimalPlaces));
const cliProgress = require('cli-progress');

const sPrimeUniswapAbi = require('./sPrimeUniswap.json');
const sPrimeAbi = require('./sPrime.json');
const sPrimeAddress = '0xd38C5cEca20Fb43503E108ed8d4CaCA5B57E730E';
const sPrimeUniswapAddress = '0x04d36A9aAD2072C69E4B0Cb2A403D8a893064945';
const sPrimeContract = new ethers.Contract(sPrimeAddress, sPrimeAbi, getWallet('avalanche'));
const sPrimeUniswapContract = new ethers.Contract(sPrimeUniswapAddress, sPrimeUniswapAbi, getWallet('arbitrum'));
const SMARTL_LOANS_FACTORY_ABI = [
    'function getAllLoans() view returns (address[] memory)',
    'function getOwnerOfLoan(address loan) view returns (address)',
];
const CHAIN = 'arbitrum';
let factoryContract = new ethers.Contract('0x3Ea9D480295A73fd2aF95b4D96c2afF88b21B03D', SMARTL_LOANS_FACTORY_ABI, getProvider(CHAIN));
let primeAccounts = []
let sPrimeHolders = []

function getRpcUrl(chain) {
    if(chain === 'arbitrum'){
        // return 'https://arb1.arbitrum.io/rpc'
        return 'https://nd-820-127-885.p2pify.com/eb20dbbf452bafebd4ea76aa69c6629e'
    } else if(chain === 'avalanche'){
        // return 'https://avalanche-mainnet.core.chainstack.com/ext/bc/C/rpc/409fa087db6ba9d631bce0d258a14484'
        return 'https://avax.nirvanalabs.xyz/avalanche_aws/ext/bc/C/rpc?apikey=284d7cde-5c20-46a9-abee-2e3932cdb771'
        // return 'https://nd-033-589-713.p2pify.com/d41fdf9956747a40bae4edec06ad4ab9/ext/bc/C/rpc'
    }
}

function getProvider(chain) {
    return new ethers.providers.JsonRpcProvider(getRpcUrl(chain));
}

function getWallet(chain){
    return new ethers.Wallet(knownPrivateKey, getProvider(chain));
}

async function getTimestampFromBlockNumber(blockNumber, provider) {
    const block = await provider.getBlock(blockNumber);
    return block.timestamp;
}

async function getTxs(url){
    return fetch(url).then((res) => {
        // console.log(JSON.stringify(res))
        return res.json()
    });
}

// const getBlockForTimestamp = async (timestamp) => {
//     const dater = new EthDater(getProvider());
//
//     return await dater.getDate(
//       timestamp, // Date, required. Any valid moment.js value: string, milliseconds, Date() object, moment() object.
//       true // Block after, optional. Search for the nearest block before or after the given date. By default true.
//     );
//   }

function getPricesWithLatestTimestamp(prices, symbol) {
    if (symbol in prices) {
        let symbolPriceObject = prices[symbol];
        let currentNewestTimestampIndex = 0;
        for (let i = 0; i < symbolPriceObject.length; i++) {
            if (symbolPriceObject[i].timestampMilliseconds > symbolPriceObject[currentNewestTimestampIndex].timestampMilliseconds) {
                currentNewestTimestampIndex = i;
            }
        }
        return symbolPriceObject[currentNewestTimestampIndex].dataPoints[0].value;
    } else {
        throw new Error(`Symbol ${symbol} not found in the prices object`);
    }
}

async function getRedstonePrices(tokenSymbols, chain) {
    const dataServiceId = process.env.dataServiceId ?? `redstone-${chain}-prod`;
    const url = `https://oracle-gateway-1.a.redstone.finance/data-packages/latest/${dataServiceId}`

    const redstonePrices = await (await fetch(url)).json();

    let result = {};
    for (const symbol of tokenSymbols) {
        try {
            result[symbol] = getPricesWithLatestTimestamp(redstonePrices, symbol);
        } catch {}
    }
    return result;
}

async function getDollarValue(decimals, balance, price) {
    return  formatUnits(balance, decimals) * price;

}

async function processSuccessfullLiquidationTx(tx, chain) {
    const abi = [
        "function balanceOf(address owner) view returns (uint256)",
        "function decimals() view returns (uint8)",
        "function symbol() view returns (string)",
        "event Transfer(address indexed from, address indexed to, uint amount)"
    ];
    let provider = getProvider(chain);
    let TOKEN_ADDRESSES = chain === 'arbitrum'? TOKEN_ADDRESSES_ARBITRUM : TOKEN_ADDRESSES_AVALANCHE;

    const hash = tx['hash']

    const txRes = await provider.getTransaction(hash);
    const receipt = await txRes.wait();
    let timestamp = await getTimestampFromBlockNumber(receipt.blockNumber, provider);

    const feeTransferLogs = receipt.logs.filter(log => log.topics[0] === '0xd5e79e0953563b535ee3d864e1ac35be98c6a24c9c38b6b91c358cea8c68939b');

    const tokenSymbols = Object.keys(TOKEN_ADDRESSES);
    const prices = await getRedstonePrices(tokenSymbols, chain);
    let totalUsdValue = 0;
    let usdValue = 0;
    let assetsTransferred = {};
    for (const log of feeTransferLogs) {
        const asset = fromBytes32(log.topics[2]);
        // console.log(`ASSET: ${asset}`)
        const [amount] = new ethers.utils.AbiCoder().decode(['uint256', 'uint256'], log.data);
        let erc20 = new ethers.Contract(TOKEN_ADDRESSES[asset], abi, provider);
        let decimals = await erc20.decimals();

        if (amount.gt(0)) {
            assetsTransferred[asset] = formatUnits(amount.toString(), decimals);
            let balanceString = amount.toString();
            usdValue = 0;
            try{
                usdValue = await getDollarValue(decimals, balanceString, prices[asset]);
            } catch (e) {
                console.log(`some error: ${e}`)
            }

            totalUsdValue += usdValue;
        }
    }

    return {totalUsdValue: totalUsdValue, assetsTransferred: assetsTransferred, timestamp: timestamp, blockNumber: receipt.blockNumber};
}

async function getSPrimeHoldersCached(chain =  'avalanche'){
    if(sPrimeHolders.length === 0){
        sPrimeHolders = await getSPrimeHolders(chain);
    }
    return sPrimeHolders;
}

async function getSPrimeHolders(chain = "arbitrum"){
        let chainId;
        let sPrimeHolders = [];
        let contractAddress = chain === "avalanche" ? sPrimeAddress : sPrimeUniswapAddress;

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
                    "x-api-key": '2hjmIoJ2wPBnaBbEjjqMOLp0plz'
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
            // if(page > 2){
            //     console.log('TODO: Remove after testing')
            //     progressBar1.stop();
            //     break;
            // }
        }

        sPrimeHolders = [...new Set(sPrimeHolders)];

        return sPrimeHolders;
}

// Function to fetch balance
async function fetchBalance(address) {
    return sPrimeUniswapContract.balanceOf(address);
}

async function fetchOwner(primeAccountAddress) {
    return factoryContract.ownerOf(primeAccountAddress);
}

async function getHoldersBalances(holders){
    let holdersBalances = []
    // Use Promise.map with concurrency option
    await Promise.map(holders, address => {
        return fetchBalance(address).then(balance => {
            return balance;
        });
    }, { concurrency: 300 }).then(results => {
        console.log('All balances fetched');
        holdersBalances = results.map(balance => Number(fromWei(balance)));
    }).catch(error => {
        console.error('Error fetching balances', error);
    });

    return holdersBalances;
}

async function isInRange(userAddress, blockNumber ){
    let methodName = 'binInRange';
    const tx = await sPrimeContract.populateTransaction[methodName](userAddress)
    let res = await sPrimeContract.signer.call(tx, blockNumber)
    try{
        let inRange =  sPrimeContract.interface.decodeFunctionResult(
            methodName,
            res
        );
        return inRange
    } catch (e) {
        if(e.errorArgs.concat().includes('No position')){
            return false;
        }
    }
}

async function getUserValueInTokenY(userAddress, blockNumber){
    let methodName = 'getUserValueInTokenY(address)';
    const tx = await sPrimeContract.populateTransaction[methodName](userAddress)
    let res = await sPrimeContract.signer.call(tx, blockNumber)
    try {
        let result =  sPrimeContract.interface.decodeFunctionResult(
            methodName,
            res
        );
        return result;
    } catch (e) {
        return 0;
    }

}

async function getUserValueInTokenYCurrent(userAddress, chain){
    // let methodName = 'getUserValueInTokenY(address)';
    // const tx = await sPrimeContract.populateTransaction[methodName](userAddress)
    // let res = await sPrimeContract.signer.call(tx, blockNumber)
    // try {
    //     let result =  sPrimeContract.interface.decodeFunctionResult(
    //         methodName,
    //         res
    //     );
    //     return result;
    // } catch (e) {
    //     return 0;
    // }
    let contract = chain === 'avalanche'? sPrimeContract : sPrimeUniswapContract;

    return contract['getUserValueInTokenY(address)'](userAddress);

}

async function getUsersValuesInTokenYCurrent(holders, chain){
    let usersValuesInTokenY = {}
    let usersValues;
    // Use Promise.map with concurrency option
    await Promise.map(holders, address => {
        return getUserValueInTokenYCurrent(address, chain).then(userValueInTokenY => {
            return userValueInTokenY;
        });
    }, { concurrency: 50 }).then(results => {
        // console.log('All user values fetched');
        usersValues = results.map(balance => Number(fromWei(balance.toString())))
    }).catch(error => {
        console.error('Error fetching in range', error);
    });

    for(let i=0; i<holders.length; i++){
        usersValuesInTokenY[holders[i]] = usersValues[i];
    }

    return usersValuesInTokenY;
}

async function getUserValuesInTokenY(holders, blockNumber){
    let usersValuesInTokenY = {}
    let usersValues;
    // Use Promise.map with concurrency option
    await Promise.map(holders, address => {
        return getUserValueInTokenY(address, blockNumber).then(userValueInTokenY => {
            return userValueInTokenY;
        });
    }, { concurrency: 50 }).then(results => {
        // console.log('All user values fetched');
        usersValues = results.map(balance => Number(fromWei(balance.toString())))
    }).catch(error => {
        console.error('Error fetching in range', error);
    });

    for(let i=0; i<holders.length; i++){
        usersValuesInTokenY[holders[i]] = usersValues[i];
    }

    return usersValuesInTokenY;
}

async function getHoldersIsInRange(holders, blockNumber){
    let holdersInRange = []
    // Use Promise.map with concurrency option
    await Promise.map(holders, address => {
        return isInRange(address, blockNumber).then(inRange => {
            return inRange;
        });
    }, { concurrency: 50 }).then(results => {
        // console.log('All in range fetched');
        holdersInRange = results;
    }).catch(error => {
        console.error('Error fetching in range', error);
    });

    holders = holders.filter((_, index) => holdersInRange[index]);

    return holders;
}

async function getSPrimeRevSharingUsersAllocationsArbitrum(epoch = 0, tokenDistributionAmount = 10000){

    let sPrimeTotalSupply = fromWei(await sPrimeUniswapContract.totalSupply());
    let sPrimeHolders = await getSPrimeHolders();

    let holdersBalances = await getHoldersBalances(sPrimeHolders);
    let holdersInRange = await getHoldersIsInRange(sPrimeHolders);

    // sum of balances
    let totalBalance = holdersBalances.reduce((a, b) => a + b, 0);
    console.log(`Total balance: ${totalBalance}`);
    console.log(`Total supply: ${sPrimeTotalSupply}`)
    console.log(`Difference: ${sPrimeTotalSupply - totalBalance}`);
    // number of holders not in range
    let holdersNotInRange = holdersInRange.filter(inRange => !inRange);
    console.log(`Holders not in range: ${holdersNotInRange.length}`);
    // sum of balances of holders not in range
    let totalBalanceNotInRange = holdersBalances.filter((_, index) => !holdersInRange[index]).reduce((a, b) => a + b, 0);
    console.log(`Total balance not in range: ${totalBalanceNotInRange}`);
    // number of holders in range
    let holdersInRangeCount = holdersInRange.filter(inRange => inRange).length;
    console.log(`Holders in range: ${holdersInRangeCount}`);
    // sum of balances of holders in range
    let totalBalanceInRange = holdersBalances.filter((_, index) => holdersInRange[index]).reduce((a, b) => a + b, 0);
    console.log(`Total balance in range: ${totalBalanceInRange}`);

    let userAllocations = {}
    let biggestTokenAmount = 0;
    for(let i=0; i<sPrimeHolders.length; i++){
        if(holdersInRange[i]){
            let tokenAmount = tokenDistributionAmount * holdersBalances[i] / totalBalanceInRange;
            if(tokenAmount > biggestTokenAmount){
                biggestTokenAmount = tokenAmount;
            }
            userAllocations[sPrimeHolders[i]] = tokenAmount;
        } else {
            userAllocations[sPrimeHolders[i]] = 0;
        }
    }


    const objArray = Object.entries(userAllocations);

    // Step 2: Sort the array by the values
    objArray.sort((a, b) => b[1] - a[1]);

    // Step 3: Convert the sorted array back into an object
    const sortedObj = Object.fromEntries(objArray);

    // save user allocations to a JSON file
    fs.writeFileSync(`arbitrum/sPrimeRevSharingAllocationEpoch${epoch}.json`, JSON.stringify(sortedObj, null, 2));
    console.log(`Biggest token amount: ${biggestTokenAmount}`);

}

async function getLiquidationTxsBetweenBlocks(chain = 'avalanche', startBlock = 47425100, endBlock = 48834295) {
    // 47425100   (Jul-1-2024 17:16:36 UTC)
    // 48834295   (Aug-4-2024 12:39:38 UTC)

    const progressBar1 = new cliProgress.SingleBar({
        format: `Fetching liquidation txs between blocks ${startBlock} and ${endBlock} |{bar}| {percentage}% | Liquidator {value}/{total} Elapsed: {duration_formatted}`,
        barCompleteChar: '=',
        barIncompleteChar: ' ',
        hideCursor: true
    }, cliProgress.Presets.shades_classic);

    const liquidatorAddresses = [
        "0xD6F515Bf564F852939e2733f50a750e68e33E504",
        "0x0d25015D4567Cb6f450d58329bad6BC7eA718E67",
        "0x7e89663195f53CdaEc2F97a4CD9eC4606C5518e8",
        "0x8582FEc792dE46872fc69A5fF68A384b7f0C438D",
        "0xEBc567e074c954cE6FD370fD763E00A383E7005C",
    ];

    progressBar1.start(liquidatorAddresses.length, 0);

    const txPerPage = 100;
    let explorerRPC = chain === 'avalanche'? 'https://api.snowtrace.io' : 'https://api.arbiscan.io'
    const apiKeyArbiscan = 'XGXPCAQEJHHTZWC6YBR8JMX8HWZW61RGAQ'

    let liquidatorsTxs = [];
    for(const liquidatorAddress of liquidatorAddresses){
        let page = 1;
        while(true) {
            let url = `${explorerRPC}/api?module=account&action=txlist` +
                `&address=${liquidatorAddress}` +
                `&startblock=${startBlock}` +
                `&endblock=${endBlock}` +
                `&page=${page}` +
                `&offset=${txPerPage}` +
                `&sort=asc`

            if(chain === 'arbitrum'){
                url += `&apikey=${apiKeyArbiscan}`
            }

            let apiResult = await getTxs(url);
            let partialResult = apiResult['result'];
            if(apiResult.length === 0){
                break;
            }
            liquidatorsTxs.push(...partialResult);
            if(partialResult.length < txPerPage){
                break;
            }
            page += 1;
        }
        progressBar1.increment(1);
    }
    progressBar1.stop();

    console.log(`Found ${liquidatorsTxs.length} liquidators txs`)
    let liquidationTxs = liquidatorsTxs.filter(tx => tx['functionName'].includes('liquidateLoan'))
    console.log(`Found ${liquidationTxs.length} liquidation txs`)

    let successfullLiquidationTxs = liquidationTxs.filter(tx => tx['isError'] !== '1');
    console.log(`Found ${successfullLiquidationTxs.length} successfull liquidation txs`)


    return successfullLiquidationTxs;
}

async function extractAssetsTransferredAndUsdValue(liquidationTxs, chain){
    let liquidationTxsData = {};

    const progressBar1 = new cliProgress.SingleBar({
        format: `Analyzing ${liquidationTxs.length} liquidation txs |{bar}| {percentage}% | Tx {value}/{total} Elapsed: {duration_formatted}`,
        barCompleteChar: '=',
        barIncompleteChar: ' ',
        hideCursor: true
    }, cliProgress.Presets.shades_classic);
    progressBar1.start(liquidationTxs.length, 0);

    for(const liquidationTx of liquidationTxs){
        let liquidationTxData = await processSuccessfullLiquidationTx(liquidationTx, chain);
        liquidationTxsData[liquidationTx['hash']] = {
            totalUsdValue: liquidationTxData['totalUsdValue'],
            assetsTransferred: liquidationTxData['assetsTransferred'],
            timestamp: liquidationTxData['timestampx'],
            blockNumber: liquidationTxData['blockNumber']
        };
        progressBar1.increment(1);
    }
    progressBar1.stop();

    console.log(`Processed txs: ${liquidationTxs.map(tx => tx['hash'])}`)

    return liquidationTxsData;
}

async function getSPrimeHoldersSharesAtBlock(blockNumber){
    // console.log('TODO: Implement historical sPrime holders fetching. Returning current sPrime holders for now');
    return getSPrimeHoldersCached('avalanche');
}

async function getUsersLiquidationsShares(liquidationsData){
    console.log(`Processing ${Object.keys(liquidationsData).length} liquidations user shares`)

    const progressBar1 = new cliProgress.SingleBar({
        format: `Analyzing user share across ${Object.keys(liquidationsData).length} liquidation txs |{bar}| {percentage}% | Tx {value}/{total} Elapsed: {duration_formatted}`,
        barCompleteChar: '=',
        barIncompleteChar: ' ',
        hideCursor: true
    }, cliProgress.Presets.shades_classic);
    progressBar1.start(Object.keys(liquidationsData).length, 0);

    let liquidationToUsersShares = {};
    for(const liquidationHash in liquidationsData){
        let liquidationData = liquidationsData[liquidationHash];

        let sPrimeHolders = await getSPrimeHoldersSharesAtBlock(liquidationData['blockNumber']);
        // console.log(`Found ${sPrimeHolders.length} sPrime holders at block ${liquidationData['blockNumber']}`);

        let sPrimeHoldersInRange = await getHoldersIsInRange(sPrimeHolders, liquidationData['blockNumber']);
        // console.log(`Found ${sPrimeHoldersInRange.length} sPrime holders in range at block ${liquidationData['blockNumber']}`);

        let usersValuesInTokenY = await getUserValuesInTokenY(sPrimeHoldersInRange, liquidationData['blockNumber']);
        let totalValueInTokenY = Object.values(usersValuesInTokenY).reduce((a, b) => a + b, 0);

        let usersLiquidationsShares = {};
        for(const userAddress in usersValuesInTokenY){
            usersLiquidationsShares[userAddress] = usersValuesInTokenY[userAddress] / totalValueInTokenY;
        }
        // check if usersLiquidationsShares sums up to 100%
        let sum = Object.values(usersLiquidationsShares).reduce((a, b) => a + b, 0);
        if(Math.abs(sum-1) > 1e-10){
            throw new Error(`Users liquidations shares do not sum up to 100%: ${sum}`);
        }

        liquidationToUsersShares[liquidationHash] = usersLiquidationsShares;

        progressBar1.increment(1);
    }
    progressBar1.stop();
    return liquidationToUsersShares;
}

async function processLiquidationsRevenue(chain = 'avalanche', startBlock, endBlock){
    let finalUsersLiquidationsShares = {};
    let totalUsdSum = 0;
    let totalAssetsTransferred = {};
    let usersUsdSum = {};
    let liquidationTxs = await getLiquidationTxsBetweenBlocks(chain, startBlock, endBlock);

    // console.log('TODO: Remove after testing')
    // liquidationTxs = liquidationTxs.slice(1, 3);

    let processedLiquidationsData = await extractAssetsTransferredAndUsdValue(liquidationTxs, chain);

    // let usersLiquidationsShares = await getUsersLiquidationsShares(processedLiquidationsData);

    for(const liquidationHash in processedLiquidationsData){
        let liquidationData = processedLiquidationsData[liquidationHash];
        // let usersShares = usersLiquidationsShares[liquidationHash];
        totalUsdSum += liquidationData['totalUsdValue'];

        // // calculate users usd value
        // for(const userAddress in usersShares){
        //     let userShare = usersShares[userAddress];
        //     let userUsdValue = liquidationData['totalUsdValue'] * userShare;
        //     if(userAddress in usersUsdSum){
        //         usersUsdSum[userAddress] += userUsdValue;
        //     } else {
        //         usersUsdSum[userAddress] = userUsdValue;
        //     }
        //     totalUsdSum += userUsdValue;
        // }

        // calculate total assets transferred
        for(const asset in liquidationData['assetsTransferred']){
            let assetAmount = liquidationData['assetsTransferred'][asset];
            if(asset in totalAssetsTransferred){
                totalAssetsTransferred[asset] += assetAmount;
            } else {
                totalAssetsTransferred[asset] = assetAmount;
            }
        }
    }

    // for(const userAddress in usersUsdSum){
    //     finalUsersLiquidationsShares[userAddress] = usersUsdSum[userAddress] / totalUsdSum;
    // }

    console.log(finalUsersLiquidationsShares);
    console.log(totalAssetsTransferred);
    console.log(totalUsdSum);


}

async function checkSPrimeTotalValueMinted(chain){
    let sPrime = chain === 'avalanche'? sPrimeContract : sPrimeUniswapContract;
    let tokenYName = chain === 'avalanche'? 'AVAX' : 'ETH';
    let tokenYPrice = (await getRedstonePrices([tokenYName], chain))[tokenYName];
    console.log('Token Y price: ', tokenYPrice);
    console.log('Getting holders')
    let sPrimeHolders = await getSPrimeHolders(chain);
    console.log('Getting holders balances')
    let balances = await getUsersValuesInTokenYCurrent(sPrimeHolders, chain);
    let totalValue = Object.values(balances).reduce((a, b) => a + b, 0);
    console.log(`Total value in Token Y: ${totalValue} for chain ${chain}`);

}

// checkFailedLiquidationTxsEvents(1720952696, 1721471096);
// processSuccessfullLiquidationTx({hash: '0x365372c222960a9d56498f7537729caa6a9df39a7ef516c2d224bb70ced1e592'})
// processLiquidationsRevenue('avalanche', 48829999, 48872209);
// processLiquidationsRevenue('arbitrum', 239306466, 239656466);
checkSPrimeTotalValueMinted('arbitrum');