import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("TraderJoeV2ArbitrumFacet", "./contracts/facets/arbitrum");
    embedCommitHash("TraderJoeV2Facet", "./contracts/facets");

    let TraderJoeV2ArbitrumFacet = await deploy("TraderJoeV2ArbitrumFacet", {
        from: deployer,
        args: [],
    });


    console.log(
        `TraderJoeV2ArbitrumFacet implementation deployed at address: ${TraderJoeV2ArbitrumFacet.address}`
    );

    // sleep for 10 seconds to wait for the tx to be confirmed
    await new Promise(r => setTimeout(r, 10000));

    await verifyContract(hre,
        {
            address: TraderJoeV2ArbitrumFacet.address,
            contract: `contracts/facets/arbitrum/TraderJoeV2ArbitrumFacet.sol:TraderJoeV2ArbitrumFacet`,
            constructorArguments: []
        });
    console.log(`Verified TraderJoeV2ArbitrumFacet`);
};

module.exports.tags = ["arbitrum-tjv2"];
