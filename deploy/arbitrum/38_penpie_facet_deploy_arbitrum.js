import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("PenpieFacet", "./contracts/facets/arbitrum");

    let PenpieFacet = await deploy("PenpieFacet", {
        from: deployer,
        args: [],
    });


    console.log(
        `PenpieFacet implementation deployed at address: ${PenpieFacet.address}`
    );

    // sleep for 5 seconds to let the tx be mined
    await new Promise((r) => setTimeout(r, 5000));

    await verifyContract(hre,
        {
            address: PenpieFacet.address,
            contract: `contracts/facets/arbitrum/PenpieFacet.sol:PenpieFacet`,
            constructorArguments: []
        });
    console.log(`Verified PenpieFacet`);
};

module.exports.tags = ["arbitrum-penpie-facet"];
