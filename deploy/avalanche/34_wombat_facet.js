import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("WombatFacet", "./contracts/facets/avalanche");

    let WombatFacet = await deploy("WombatFacet", {
        from: deployer,
        args: [],
    });


    console.log(
        `WombatFacet implementation deployed at address: ${WombatFacet.address}`
    );

    await verifyContract(hre,
        {
            address: WombatFacet.address,
            contract: `contracts/facets/avalanche/WombatFacet.sol:WombatFacet`,
            constructorArguments: []
        });
    console.log(`Verified WombatFacet`);
};

module.exports.tags = ["avalanche-wombat-facet"];
