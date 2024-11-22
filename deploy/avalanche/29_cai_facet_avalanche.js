import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";
import {embedCommitHash} from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("CaiFacet", "./contracts/facets/avalanche");

    let caiFacet = await deploy("CaiFacet", {
        from: deployer,
        gasLimit: 15000000,
        args: [],
    });

    console.log(`Deployed CaiFacet at address: ${caiFacet.address}`);

    await verifyContract(hre, {
        address: caiFacet.address,
        contract: "contracts/facets/avalanche/CaiFacet.sol:CaiFacet",
        constructorArguments: []
    })

    console.log('Verified CaiFacet.')
};

module.exports.tags = ["avalanche-cai-facet"];
