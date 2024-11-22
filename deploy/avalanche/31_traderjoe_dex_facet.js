import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("TraderJoeDEXFacet", "./contracts/facets/avalanche");

    let TraderJoeDEXFacet = await deploy("TraderJoeDEXFacet", {
        from: deployer,
        gasLimit: 15000000,
        args: [],
    });


    console.log(
        `TraderJoeDEXFacet implementation deployed at address: ${TraderJoeDEXFacet.address}`
    );

    await verifyContract(hre,
        {
            address: TraderJoeDEXFacet.address,
            contract: `contracts/facets/avalanche/TraderJoeDEXFacet.sol:TraderJoeDEXFacet`,
            constructorArguments: []
        });
    console.log(`Verified TraderJoeDEXFacet`);
};

module.exports.tags = ["avalanche-traderjoe-dex-facet"];
