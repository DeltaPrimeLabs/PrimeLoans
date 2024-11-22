import LOAN_FACTORYTUP from '../../deployments/avalanche/SmartLoansFactoryTUP.json'
import LOAN_FACTORY from '../../deployments/avalanche/SmartLoansFactory.json'
import addresses from '../../common/addresses/avax/token_addresses.json';
import TOKEN_ADDRESSES from '../../common/addresses/avax/token_addresses.json';
import {erc20ABI, fromBytes32, getLiquidationAmounts} from "../../test/_helpers";
import TOKEN_MANAGER from '../../deployments/avalanche/TokenManager.json';
import TOKEN_MANAGER_TUP from '../../deployments/avalanche/TokenManagerTUP.json';
import SMART_LOAN_DIAMOND from '../../deployments/avalanche/SmartLoanDiamondBeacon.json';
import {ethers} from 'hardhat'
import {
    awaitConfirmation,
    getLiquidatorSigner, unstakeGlp,
    unstakeStakedPositions,
    unstakeYieldYak,
    unwindPangolinLPPositions,
    unwindTraderJoeLPPositions,
    wrapLoan
} from "./utlis";

const args = require('yargs').argv;
const https = require('https');
const network = args.network ? args.network : 'localhost';
const interval = args.interval ? args.interval : 10;

const {getUrlForNetwork} = require("../scripts/helpers");
const fs = require('fs');
const {fromWei, formatUnits} = require("../../test/_helpers");
const {parseUnits} = require("ethers/lib/utils");
const path = require("path");

require('console-stamp')(console, {
    format: ':date(yyyy/mm/dd HH:MM:ss.l)'
} );

const PRIVATE_KEY = fs.readFileSync(path.resolve(__dirname, "./.private")).toString().trim();
const RPC_URL = getUrlForNetwork(network);
let liquidator_wallet = getLiquidatorSigner(network);

let provider = new ethers.providers.JsonRpcProvider(RPC_URL)
let wallet = (new ethers.Wallet(PRIVATE_KEY)).connect(provider);
const factory = new ethers.Contract(LOAN_FACTORYTUP.address, LOAN_FACTORY.abi, wallet);


async function wrapLoanStatus(loanAddress) {
    let loan = await wrapLoan(loanAddress, wallet);
    let rawStatus = await loan.getFullLoanStatus();
    let status = {
        value: rawStatus[0].toString(),
        debt: rawStatus[1].toString(),
        getThresholdWeightedValue: rawStatus[2].toString(),
        healthRatio: parseFloat(rawStatus[3].toString()),
        isSolvent: parseInt(rawStatus[4].toString()) == 1 ? true : false
    };
    return status;
}

function getTokenManager(tokenManagerAddress) {
    return new ethers.Contract(tokenManagerAddress, TOKEN_MANAGER.abi, wallet);
}

async function getAllLoans() {
    return await factory.getAllLoans();
}

async function getInsolventLoans() {
    let loans = await getAllLoans();
    console.log(`Found ${loans.length} loans.`)
    let insolventLoans = []
    await Promise.all(loans.map(async (loan) => {
        if ((await wrapLoanStatus(loan)).isSolvent === false) {
            insolventLoans.push(loan)
        }
    }));
    console.log(`${insolventLoans.length} out of ${loans.length} are insolvent.`)
    return insolventLoans
}

export async function liquidateLoan(loanAddress, tokenManagerAddress) {
    let loan = await wrapLoan(loanAddress, wallet);
    let ratio = fromWei(await loan.getHealthRatio());
    if (ratio < 0.98) {
        let tokenManager = getTokenManager(tokenManagerAddress);
        let poolTokens = await tokenManager.getAllPoolAssets();
        let maxBonus = (await loan.getMaxLiquidationBonus()).toNumber() / 1000;

        //TODO: optimize to unstake only as much as needed
        await unstakeGlp(loan, liquidator_wallet, provider);

        await unstakeStakedPositions(loan, provider);

        await unstakeYieldYak(loan, liquidator_wallet, provider);

        await unwindPangolinLPPositions(loan, liquidator_wallet, provider);

        await unwindTraderJoeLPPositions(loan, liquidator_wallet, provider);

        //TODO: calculate in the future
        const bonus = 0;

        const weiDebts = (await loan.getDebts());

        const debts = [];
        for (let debt of weiDebts) {
            let symbol = fromBytes32(debt.name);
            debts.push(
                {
                    name: symbol,
                    debt: formatUnits(debt.debt, await getTokenContract(TOKEN_ADDRESSES[symbol]).decimals())
                });
        }

        const balances = [];

        const weiBalances = (await loan.getAllAssetsBalances());
        for (let balance of weiBalances) {
            let symbol = fromBytes32(balance.name);

            balances.push(
                {
                    name: symbol,
                    //@ts-ignore
                    debtCoverage: fromWei(await tokenManager.debtCoverage(TOKEN_ADDRESSES[symbol])),
                    balance: formatUnits(balance.balance, await getTokenContract(TOKEN_ADDRESSES[symbol]).decimals())
                });
        }

        let loanIsBankrupt = fromWei(await loan.getTotalValue()) < fromWei(await loan.getDebt());

        let prices = (await loan.getAllAssetsPrices()).map(el => {
            return {
                dataFeedId: fromBytes32(el.name),
                value: formatUnits(el.price, 8)
            }
        });

        let {repayAmounts, deliveredAmounts} = getLiquidationAmounts(
            'LIQUIDATE',
            debts,
            balances,
            prices,
            1.04,
            bonus,
            loanIsBankrupt
        );

        let amountsToRepayInWei = [];

        for (const repayment of repayAmounts) {
            let tokenContract = await getTokenContract(addresses[repayment.name]);
            let decimals = await tokenContract.decimals();
            amountsToRepayInWei.push(parseUnits((Number(repayment.amount).toFixed(decimals) ?? 0).toString(), decimals));
        }

        for (const allowance of deliveredAmounts) {
            let tokenContract = await getTokenContract(addresses[allowance.name]);
            let decimals = await tokenContract.decimals();
            let delivered = parseUnits((Number(1.001 * allowance.amount).toFixed(decimals) ?? 0).toString(), decimals);
            await tokenContract.connect(wallet).approve(loan.address, delivered, {gasLimit: 8000000, gasPrice: 100_000_000_000});
        }
        const bonusInWei = (bonus * 1000).toFixed(0);

        if (!loanIsBankrupt) {
            let liqStartTime = new Date();

            let receipt = await awaitConfirmation(await loan.liquidateLoan(poolTokens, amountsToRepayInWei, bonusInWei, {gasLimit: 8000000, gasPrice: 100_000_000_000}), provider, 'flashloan liquidation', 60_000);

            console.log(`Sellout processed with ${receipt.status == 1 ? "success" : "failure"} in ${(new Date() - liqStartTime) / 1000} seconds.`);

        } else {
            console.log('This loan is bankrupt sir. I\'m not touching it, sawry!');
        }
    } else {
        console.log('Loan on the edge of solvency, aborting liquidation.');
    }
}


function healthcheckPing() {
    console.log(`[HEALTHCHECK] Ping!`);
    // BETA-HR: https://hc-ping.com/3bd80bcc-e9c8-48b8-8f44-e672bb498700
    // BETA-LTV: https://hc-ping.com/5db347bf-6516-4f9b-99ce-5bdcd88e12d0
    // BETA-2k-2k: https://hc-ping.com/cdc33b7f-e908-4598-8c0b-f0343c2cffd4
    https.get('https://hc-ping.com/cdc33b7f-e908-4598-8c0b-f0343c2cffd4').on('error', (err) => {
        console.log('Ping failed: ' + err)
    });
}

async function liquidateInsolventLoans() {
    healthcheckPing();
    let loans = await getInsolventLoans();
    console.log(`INSOLVENT LOANS[${loans.length}]: ${loans}`)

    for (const x in loans) {
        await liquidateLoan(loans[x], TOKEN_MANAGER_TUP.address);
    }
    setTimeout(liquidateInsolventLoans, interval * 1000);
}

const run = liquidateInsolventLoans;


function getTokenContract(address) {
    return new ethers.Contract(address, erc20ABI, wallet);
}

console.log(`Started liquidation bot for network: ${network} (${RPC_URL}) and interval ${interval}.`);
// run();

module.exports.liquidateInsolventLoans = liquidateInsolventLoans;