import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("GLPFacetArbi", "./contracts/facets/arbitrum");

    let GLPFacetArbi = await deploy("GLPFacetArbi", {
        from: deployer,
        args: [],
    });


    console.log(
        `GLPFacetArbi implementation deployed at address: ${GLPFacetArbi.address}`
    );

    await verifyContract(hre,
        {
            address: GLPFacetArbi.address,
            contract: `contracts/facets/arbitrum/GLPFacetArbi.sol:GLPFacetArbi`,
            constructorArguments: []
        });
    console.log(`Verified GLPFacetArbi`);
};

module.exports.tags = ["arbitrum-glp"];
