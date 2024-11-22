import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("TraderJoeV2AvalancheFacet", "./contracts/facets/avalanche");

    let TraderJoeV2AvalancheFacet = await deploy("TraderJoeV2AvalancheFacet", {
        from: deployer,
        args: [],
    });


    console.log(
        `TraderJoeV2AvalancheFacet implementation deployed at address: ${TraderJoeV2AvalancheFacet.address}`
    );

    // sleep for 10 seconds to wait for the tx to be confirmed
    await new Promise(r => setTimeout(r, 10000));

    await verifyContract(hre,
        {
            address: TraderJoeV2AvalancheFacet.address,
            contract: `contracts/facets/avalanche/TraderJoeV2AvalancheFacet.sol:TraderJoeV2AvalancheFacet`,
            constructorArguments: []
        });
    console.log(`Verified TraderJoeV2AvalancheFacet`);
};

module.exports.tags = ["avalanche-tjv2"];
