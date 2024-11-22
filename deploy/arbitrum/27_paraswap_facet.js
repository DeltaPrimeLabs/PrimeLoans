import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";
const web3Abi  = require('web3-eth-abi');
const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("ParaSwapFacet", "./contracts/facets");

    let ParaSwapFacet = await deploy("ParaSwapFacet", {
        from: deployer,
        gasLimit: 50000000,
        args: [],
    });


    console.log(
        `ParaSwapFacet implementation deployed at address: ${ParaSwapFacet.address}`
    );

    await verifyContract(hre,
        {
            address: ParaSwapFacet.address,
            contract: `contracts/facets/ParaSwapFacet.sol:ParaSwapFacet`,
            constructorArguments: []
        });
    console.log(`Verified ParaSwapFacet`);
};

module.exports.tags = ["arbitrum-paraswap-facet"];
