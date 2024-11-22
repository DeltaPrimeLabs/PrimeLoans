import {getUrlForNetwork} from "../helpers";

const fs = require("fs");
const ethers = require("ethers");

function initWallet(networkName) {
    const key = fs.readFileSync(`./.secrets/${networkName}/deployer`).toString().trim();
    const provider = new ethers.providers.JsonRpcProvider(getUrlForNetwork(networkName));

    return new ethers.Wallet(key, provider);
}

function initContract(networkName, PROXY, IMPLEMENTATION_CONTRACT) {
    const wallet = initWallet(networkName);

    return new ethers.Contract(PROXY.address, IMPLEMENTATION_CONTRACT.abi, wallet);
}

function setNft(networkName, NFT, PROXY, CONTRACT_WITH_NFT_ACCESS) {
    initContract(networkName, PROXY, CONTRACT_WITH_NFT_ACCESS)
        .setAccessNFT(NFT.address)
        .then(
            (re) => {
                console.log(re)
            }
        );
}

function populateNFTUris(networkName, NFT) {
    const wallet = initWallet(networkName);
    const uris = fs.readFileSync("./tools/scripts/nft/uris.txt").toString().split("\n");

    const contract = new ethers.Contract(NFT.address, NFT.abi, wallet);

    contract.addAvailableUri(uris).then(
        () => {
            console.log("URIs successfully added!")
        }
    )
}

function getNFTsLeft(networkName, NFT) {
    const wallet = initWallet();

    const contract = new ethers.Contract(NFT.address, NFT.abi, wallet);

    contract.getAvailableUrisCount().then(
        (resp) => {
            console.log(resp)
        }
    )
}

/// EXPORTED FUNCTIONS

module.exports.setAccessNFT = function setAccessNFT(networkName, nftContractName, proxyContract, contractWithAccessNft) {
    const CONTRACT_WITH_ACCESS_NFT = require(`../../../deployments/${networkName}/${contractWithAccessNft}.json`);
    const PROXY_CONTRACT = require(`../../../deployments/${networkName}/${proxyContract}.json`);
    const NFT = require(`../../../deployments/${networkName}/${nftContractName}.json`);

    setNft(networkName, NFT, PROXY_CONTRACT, CONTRACT_WITH_ACCESS_NFT);
}

module.exports.populateNftUris = function populateNftUris(networkName, contractName) {
    const NFT = require(`../../../deployments/${networkName}/${contractName}.json`);

    populateNFTUris(networkName, NFT);
}

module.exports.getNftsLeft = function getNftsLeft(networkName, contractName) {
    const NFT = require(`../../../deployments/${networkName}/${contractName}.json`);

    getNFTsLeft(contractName, NFT);
}

