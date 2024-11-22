//FIRESTORE config
const functions = require("firebase-functions");
const admin = require('firebase-admin');
admin.initializeApp();


const factoryAddress = "0x3Ea9D480295A73fd2aF95b4D96c2afF88b21B03D";
//const jsonRPC = "https://api.avax.network/ext/bc/C/rpc";
const jsonRPC = "https://avalanche-mainnet.infura.io/v3/44a75435541f40cdac3945feaf38ba26"

const WrapperBuilder = require('@redstone-finance/evm-connector').WrapperBuilder;
const FACTORY = require(`./SmartLoansFactory.json`);
const LOAN = require(`./SmartLoanGigaChadInterface.json`);
const ethers = require("ethers");
const fs = require("fs");
const CACHE_LAYER_URLS = require('./redstone-cache-layer-urls.json');


const provider = new ethers.providers.JsonRpcProvider(jsonRPC);
const wallet = (new ethers.Wallet("0xca63cb3223cb19b06fa42110c89ad21a17bad22ea061e5a2c2487bd37b71e809"))
               .connect(provider);

let factory = new ethers.Contract(factoryAddress, FACTORY.abi, provider);

const fromWei = val => parseFloat(ethers.utils.formatEther(val));

function wrap(contract) {
    return WrapperBuilder.wrap(contract).usingDataService(
        {
          dataServiceId: 'redstone-avalanche-prod',
          uniqueSignersCount: 3,
          disablePayloadsDryRun: true
        },
        CACHE_LAYER_URLS.urls
      );
}

exports.scheduledFunction = functions
    .runWith({timeoutSeconds: 120, memory: "1GB"})
    .pubsub.schedule('* * * * *')    
    .onRun(async (context) => {
        functions.logger.info("Getting loans");
        let loanAddresses = await factory.getAllLoans();
        const batchTime = new Date().getTime();
        const db = admin.firestore();
        const batch = writeBatch(db);
        let actions = loanAddresses.map(async loanAddress => {                
            let loanContract = new ethers.Contract(loanAddress, LOAN.abi, wallet);
            loanContract = wrap(loanContract);
            let status = await loanContract.getFullLoanStatus();
            let loan = {
                time: batchTime,
                address: loanAddress,
                total: fromWei(status[0]),
                debt: fromWei(status[1]),
                collateral:  fromWei(status[0]) - fromWei(status[1]),
                health: fromWei(status[3])
            };
            batch.collection('loans').doc(loanAddress).set(loan);            
        });
    await Promise.all(actions);
    const res = await batch.commit();
    functions.logger.info(`Upaded ${loanAddresses.length} loans.`);
    return null;
});




