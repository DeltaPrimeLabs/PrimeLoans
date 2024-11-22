import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("GogoPoolFacet", "./contracts/facets/avalanche");

    let GogoPoolFacet = await deploy("GogoPoolFacet", {
        from: deployer,
        gasLimit: 15000000,
        args: [],
    });


    console.log(
        `GogoPoolFacet implementation deployed at address: ${GogoPoolFacet.address}`
    );

    await verifyContract(hre,
        {
            address: GogoPoolFacet.address,
            contract: `contracts/facets/avalanche/GogoPoolFacet.sol:GogoPoolFacet`,
            constructorArguments: []
        });
    console.log(`Verified GogoPoolFacet`);
};

module.exports.tags = ["avalanche-gogopool"];
