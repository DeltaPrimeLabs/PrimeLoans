const jsonRPC = "https://arbitrum-mainnet.core.chainstack.com/9a30fb13b2159a76c8e143c52d5579bf";
const fetch = require("node-fetch");

const FACTORY_ARTIFACT = require("../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json");
const fs = require("fs");
const ethers = require("ethers");
const key = fs.readFileSync("./.secret").toString().trim();
let mnemonicWallet = new ethers.Wallet(key);
let provider = new ethers.providers.JsonRpcProvider(jsonRPC);
let wallet = mnemonicWallet.connect(provider);

let factory = new ethers.Contract('0xFf5e3dDaefF411a1dC6CcE00014e4Bca39265c20', FACTORY_ARTIFACT.abi, wallet);


let collectedTotal = 0;
async function run() {
    let loans = await factory.getAllLoans();

    let resps = await Promise.all(loans.map(loan => fetch("https://2t8c1g5jra.execute-api.us-east-1.amazonaws.com/gmx-incentives/${loan}?network=arbitrum")))
    let jsons = await Promise.all(resps.map(json => json.json()))

    let collectedArb;
    jsons.forEach(
        json => {
            console.log(json)
            collectedTotal += json.arbCollected;
            // if (json.id.toLowerCase() === '0x59895aB032D1B5D5299cB67DAc73b9839D5CCEB2'.toLowerCase()) {
            //     console.log('address: ', json.id)
            //     console.log('collectedArb: ', collectedArb)
            //
            // }
        }
    )

    console.log('timestamp: ', Date.now());
    console.log('collectedTotal: ', collectedTotal)
}

run().then()