import {ethers} from "hardhat";
import LOAN_FACTORYTUP from "../../deployments/avalanche/SmartLoansFactoryTUP.json";
import LOAN_FACTORY from "../../deployments/avalanche/SmartLoansFactory.json";
import {getLiquidatorSigner, wrapLoan} from "./utlis";
import {boolean} from "hardhat/internal/core/params/argumentTypes";
import {fromWei} from "../../test/_helpers";
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const {getUrlForNetwork} = require("../scripts/helpers");

const https = require('https');
const args = require('yargs').argv;
const network = args.network ? args.network : 'localhost';
const interval = args.interval ? args.interval : 30;
const MAX_INSOLVENCY_DURATION = args.duration ? args.duration : 180;

const RPC_URL = getUrlForNetwork(network);
let liquidator_wallet = getLiquidatorSigner(network);

const factory = new ethers.Contract(LOAN_FACTORYTUP.address, LOAN_FACTORY.abi, liquidator_wallet);


async function getAllLoans() {
    return await factory.getAllLoans();
}

async function wrapLoanIsSolvent(loanAddress) {
    let loan = await wrapLoan(loanAddress, liquidator_wallet);
    let isSolvent = (fromWei(await loan.getTotalValue()) - fromWei(await loan.vectorUSDC1Balance())) > fromWei(await loan.getDebt());
    // let isSolvent = Boolean(fromWei(await loan.getHealthRatio()) >= 0.98);
    return isSolvent;
}

async function getInsolventLoans() {
    let loans = await getAllLoans();
    console.log(`Found ${loans.length} loans.`)
    let insolventLoans = []
    await Promise.all(loans.map(async (loan) => {
        if ((await wrapLoanIsSolvent(loan)) === false) {
            insolventLoans.push(loan)
        }
    }));
    console.log(`${insolventLoans.length} out of ${loans.length} are insolvent.`)
    return insolventLoans
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

function loanInsolventPing(loanAddress){
    postData('https://hc-ping.com/d96fe5e4-6843-44d3-8c2c-813ee82f2285/fail', { insolventLoan: loanAddress })
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
    https.get('https://hc-ping.com/d96fe5e4-6843-44d3-8c2c-813ee82f2285').on('error', (err) => {
        console.log('Ping failed: ' + err)
    });
}

function updateLoansInsolventTimes(loans){
    for(const [index, loan] of loans.entries()){
        let currentDate = new Date();

        // Was insolvent before
        if(loan in insolventLoans){
            let insolvencyDurationSeconds = (currentDate - insolventLoans[loan]) / 1000;
            console.log(`[${index}/${loans.length}] Loan (${loan}) has been insolvent for over ${insolvencyDurationSeconds} seconds now!`)
            if(insolvencyDurationSeconds > MAX_INSOLVENCY_DURATION){
                console.log(`That's too long! Lemme snitch on the liquidation bots!`);
                loanInsolventPing(loan);
            } else {
                console.log(`Well, it sucks but ${insolvencyDurationSeconds} seconds is still less than ${MAX_INSOLVENCY_DURATION} seconds so let's give it some more time.`)
            }

        // Is insolvent for the first time
        } else {
            console.log(`[${index}/${loans.length}] Loan (${loan}) is first time insolvent [${currentDate}]`);
            insolventLoans[loan] = currentDate;
        }

        // Is no longer insolvent
        for(const k of Object.keys(insolventLoans)){
            if(!(loans.includes(k))){
                console.log(`${k} is now solvent`)
                delete insolventLoans[k];
            }
        }
    }
    console.log(`As of now ${Object.keys(insolventLoans).length} loans are insolvent.`)
}

async function monitorLoansThatStayInsolvent() {
    healthcheckPing();
    let loans = await getInsolventLoans();
    console.log(`Monitoring ${loans.length} loans.`)
    updateLoansInsolventTimes(loans);
    setTimeout(monitorLoansThatStayInsolvent, interval * 1000);
}

const run = monitorLoansThatStayInsolvent;

console.log(`Started monitoring loans that stay insolvent. Network: ${network} (${RPC_URL}) and interval ${interval} seconds. MAX_INSOLVENCY_DURATION = ${MAX_INSOLVENCY_DURATION}`);
let insolventLoans = {}
run();