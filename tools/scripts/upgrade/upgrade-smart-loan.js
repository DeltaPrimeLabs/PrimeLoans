import {getUrlForNetwork} from "../helpers";

const {ethers} = require("hardhat");
const UPGRADEABLE_BEACON = require("../../../artifacts/@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol/UpgradeableBeacon.json")

const fs = require('fs');

var provider;

async function upgradeBeacon(networkName, implementationName) {
    provider = new ethers.providers.JsonRpcProvider(getUrlForNetwork(networkName));

    const key = fs.readFileSync(`./.secrets/${networkName}/deployer`).toString().trim();
    let privateKeyWallet = new ethers.Wallet(key);

    let wallet = privateKeyWallet.connect(provider);

    const FACTORY_TUP = require(`../../../deployments/${networkName}/SmartLoansFactoryTUP.json`);
    const FACTORY = require(`../../../deployments/${networkName}/SmartLoansFactory.json`);
    const IMPLEMENTATION = require(`../../../deployments/${networkName}/${implementationName}.json`);

    const factory = new ethers.Contract(FACTORY_TUP.address, FACTORY.abi, wallet);

    const beaconAddress = await factory.upgradeableBeacon.call(0);
    const beacon = (await new ethers.Contract(beaconAddress, UPGRADEABLE_BEACON.abi)).connect(wallet);
    await beacon.upgradeTo(IMPLEMENTATION.address);

    return "New implementation address " + IMPLEMENTATION.address;
}

module.exports.upgradeSmartLoan = function upgradeSmartLoan(networkName, address) {
    upgradeBeacon(networkName, address).then(
        res => console.log(res),
        err => console.error(err)
    )
}

