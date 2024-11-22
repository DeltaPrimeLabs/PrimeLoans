/* eslint prefer-const: "off" */
const {ethers} = require("hardhat");
export const ZERO = ethers.constants.AddressZero;

async function getContractSelectors(contractName, wallet) {
    const contract = await ethers.getContractAt(contractName, ZERO, wallet);
    const signatures = Object.keys(contract.interface.functions)
    for(const signature of signatures){
        console.log(`${signature} -> ${contract.interface.getSighash(signature)}`)
    }
}

exports.getContractSelectors = getContractSelectors