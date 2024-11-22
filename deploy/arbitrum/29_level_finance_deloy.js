import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";
const web3Abi  = require('web3-eth-abi');
const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("LevelFinanceFacet", "./contracts/facets/arbitrum");

    let LevelFinanceFacet = await deploy("LevelFinanceFacet", {
        from: deployer,
        gasLimit: 50000000,
        gasPrice: 120000000,
        args: [],
    });


    console.log(
        `LevelFinanceFacet implementation deployed at address: ${LevelFinanceFacet.address}`
    );

    await verifyContract(hre,
        {
            address: LevelFinanceFacet.address,
            contract: `contracts/facets/arbitrum/LevelFinanceFacet.sol:LevelFinanceFacet`,
            constructorArguments: []
        });
    console.log(`Verified LevelFinanceFacet`);

};

module.exports.tags = ["arbi-level-finance"];
