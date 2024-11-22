import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";
const web3Abi  = require('web3-eth-abi');
const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("SmartLoansFactory");

    let SmartLoansFactory = await deploy("SmartLoansFactory", {
        from: deployer,
        gasLimit: 50000000,
        args: [],
    });


    console.log(
        `SmartLoansFactory implementation deployed at address: ${SmartLoansFactory.address}`
    );

    await verifyContract(hre,
        {
            address: SmartLoansFactory.address,
            contract: `contracts/SmartLoansFactory.sol:SmartLoansFactory`,
            constructorArguments: []
        });
    console.log(`Verified SmartLoansFactory`);

};

module.exports.tags = ["arbitrum-slf"];
