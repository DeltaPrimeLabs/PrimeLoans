const contractAddress = "0xD446eb1660F766d533BeCeEf890Df7A69d26f7d1";
const contractMethod = "getPriceFromId";
const jsonRPC = "https://api.avax.network/ext/bc/C/rpc";

const ethers = require("ethers");
const fs = require("fs");

const key = fs.readFileSync("./.secret").toString().trim();
let mnemonicWallet = new ethers.Wallet(key);
let provider = new ethers.providers.JsonRpcProvider(jsonRPC);
let wallet = mnemonicWallet.connect(provider);

const LBTokenAbi = [
    'function balanceOf(address account, uint256 id) external view returns (uint256)',
    'function getActiveId() external view returns (uint24)',
    'function getPriceFromId(uint24 id) external view returns (uint256 price)',
    'function name() external view returns (string memory)',
    'function approveForAll(address spender, bool approved) external'
]

let contract = new ethers.Contract(contractAddress, LBTokenAbi, wallet);

contract[contractMethod](10).then(
    res => {
        console.log(res);
    }
)

