const loanAddress = "0x4a4B8C28922FfC8F1E7Ce0969B49962a926B1184";
const jsonRPC = "https://api.avax.network/ext/bc/C/rpc";

const ARTIFACT = require(`../../artifacts/contracts/interfaces/SmartLoanGigaChadInterface.sol/SmartLoanGigaChadInterface.json`);
const ethers = require("ethers");
const fs = require("fs");
const {wrapContract} = require("../../src/utils/blockchain");
const {fromWei, fromBytes32} = require("../../test/_helpers");

const key = fs.readFileSync("./.secret").toString().trim();
let mnemonicWallet = new ethers.Wallet(key);
let provider = new ethers.providers.JsonRpcProvider(jsonRPC);
let wallet = mnemonicWallet.connect(provider);

let loan = new ethers.Contract(loanAddress, ARTIFACT.abi, wallet);
let wrappedLoan;

run().then(() => console.log('Finished!'))

async function run() {
    await prepare();
    await getData();
}

async function prepare() {
    wrappedLoan = await wrapContract(loan);
}

async function getData() {
    console.log('getData')
    // await vectorFinanceRewards('0x91F78865b239432A1F1Cc1fFeC0Ac6203079E6D7', loanAddress, 18, wallet.provider.getSigner(wallet.address))

    console.log('Balances: ');

    let balances = await loan.getAllAssetsBalances();
    balances.forEach(
        balance => {
            console.log('Symbol: ', fromBytes32(balance[0]))
            console.log('Balance in wei: ', balance[1].toString())
        });

    console.log('Staked positions: ')

    let positions = await loan.getStakedPositions()
    positions.forEach(
        (position, i) => {
            console.log('Position ', i)
            console.log('Asset address: ', position[0])
            console.log('Symbol: ', fromBytes32(position[1]))
            console.log('Identifier: ', fromBytes32(position[2]))
        });

    console.log('Loan status: ',)

    let status = (await wrappedLoan.getFullLoanStatus()).map(el => fromWei(el));
    console.log('Total value: ', status[0])
    console.log('Debt: ', status[1])
    console.log('TWV: ', status[2])
    console.log('Health: ', status[3])
    console.log('Solvent: ', status[4] === 1e-18)
}