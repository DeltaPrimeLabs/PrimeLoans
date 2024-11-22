const {ethers} = require("hardhat");
const {getUrlForNetwork} = require("../scripts/helpers");
const { requestDataPackages } = require("redstone-sdk");
require('console-stamp')(console, {
    format: ':date(yyyy/mm/dd HH:MM:ss.l)'
} );

const fromWei = (val) => parseFloat(ethers.utils.formatEther(val));
const {WrapperBuilder} = require("@redstone-finance/evm-connector");
const LOAN_FACTORYTUP = require("../../deployments/avalanche/SmartLoansFactoryTUP.json");
const LOAN_FACTORY = require("../../deployments/avalanche/SmartLoansFactory.json");
const {getLiquidatorSigner, wrapLoan} = require("./utlis");
const PRIME_ACCOUNT_ABI = require('../../artifacts/contracts/interfaces/SmartLoanGigaChadInterface.sol/SmartLoanGigaChadInterface.json').abi

const https = require('https');
const args = require('yargs').argv;
const network = args.network ? args.network : 'avalanche';
const interval = args.interval ? args.interval : 240;

const RPC_URL = getUrlForNetwork(network);
let liquidator_wallet = getLiquidatorSigner(network);

const factory = new ethers.Contract(LOAN_FACTORYTUP.address, LOAN_FACTORY.abi, liquidator_wallet);


async function getAllLoans() {
    return await factory.getAllLoans();
}

async function wrapLoanIsSolvent(loanAddress) {
    let loan = await wrapLoan(loanAddress, liquidator_wallet);
    let isSolvent = Boolean(await loan.isSolvent());
    return isSolvent;
}

async function getWrappedPrimeAccounts(primeAccountAddresses, dataPackages){
    const wrappedPAs = []
    for(const pa of primeAccountAddresses){
        let primeAccount = new ethers.Contract(pa, PRIME_ACCOUNT_ABI, liquidator_wallet);
        wrappedPAs.push(WrapperBuilder.wrap(primeAccount).usingDataPackages(dataPackages))
    }
    console.log('Wrapped.')
    return wrappedPAs;
}

async function getInsolventLoans() {
    const batchSize = 300;
    let start;
    let resultFLS = [];
    let FLSPromises = [];
    let batchResultFLS = [];
    let dataPackages, batchWrappedPAs;

    let loans = await getAllLoans();
    // loans = loans.slice(3000, 4000);
    console.log(`Found ${loans.length} loans.`)
    console.log(`Batch size: ${batchSize}`)

    console.log('Got rs packages.')
    for(let i=0; i< Math.ceil(loans.length/batchSize); i++) {
        console.log(`Processing [${i*batchSize} - ${(i+1)*batchSize > loans.length ? loans.length : (i+1) * batchSize}] (${loans.length - i*batchSize > batchSize ? batchSize : loans.length - i*batchSize} PAs)`)
        FLSPromises = [];
        dataPackages = await requestDataPackages({
            dataServiceId: "redstone-avalanche-prod",
            uniqueSignersCount: 3,
        });

        start = new Date();
        batchWrappedPAs = await getWrappedPrimeAccounts(loans.slice(i*batchSize, (i+1)*batchSize), dataPackages);
        batchWrappedPAs.forEach((wpa) => FLSPromises.push(wpa.getFullLoanStatus()));
        batchResultFLS = await Promise.all(FLSPromises)
        resultFLS = resultFLS.concat(batchResultFLS)
        let end = new Date();
        console.log(`Processed in ${(end - start) / 1000}s`)


    }

    let totalValue, debt, _, healthRatio, isSolvent;
    for(const [i, pa] of loans.entries()) {
        [totalValue, debt, _, healthRatio, isSolvent] = resultFLS[i];
        let hr = fromWei(healthRatio);
        if(hr < 1.0){
            console.log(`[${pa}] INSOLVENT! tv: $${fromWei(totalValue)} debt: $${fromWei(debt)}, HR: ${hr}`)
        }
    }

    console.log('Finished')

    let insolventLoans = []
    return insolventLoans
}

function healthcheckPing() {
    // console.log(`[HEALTHCHECK] Ping!`);
    // BETA-HR: https://hc-ping.com/3bd80bcc-e9c8-48b8-8f44-e672bb498700
    // BETA-LTV: https://hc-ping.com/5db347bf-6516-4f9b-99ce-5bdcd88e12d0
    // BETA-2k-2k: https://hc-ping.com/cdc33b7f-e908-4598-8c0b-f0343c2cffd4
    // https.get('https://hc-ping.com/3bd80bcc-e9c8-48b8-8f44-e672bb498700').on('error', (err) => {
    //     console.log('Ping failed: ' + err)
    // });
}

async function liquidateInsolventLoans() {
    // healthcheckPing();
    let loans = await getInsolventLoans();
    setTimeout(liquidateInsolventLoans, interval * 1000);
}

const run = liquidateInsolventLoans;

console.log(`Started liquidation bot for network: ${network} (${RPC_URL}) and interval ${interval} seconds`);
run();