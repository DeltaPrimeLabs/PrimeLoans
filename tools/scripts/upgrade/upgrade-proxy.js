import {getUrlForNetwork} from "../helpers";

const {ethers} = require("hardhat");

const fs = require('fs');

var provider;

module.exports.upgradeProxy = async function upgradeProxy(networkName, contractName, proxy, proxyName) {
    const key = fs.readFileSync(`./.secrets/${networkName}/admin`).toString().trim();
    let privateKeyWallet = new ethers.Wallet(key);

    const address = require(`../../../deployments/${networkName}/${contractName}.json`).address;

    provider = new ethers.providers.JsonRpcProvider(getUrlForNetwork(networkName));

    let wallet = privateKeyWallet.connect(provider);

    const proxyContract = new ethers.Contract(proxy.address, proxy.abi, wallet);

    await proxyContract.upgradeTo(address)

    return `${proxyName} upgraded to ${contractName} at address: ${address}`;
}

