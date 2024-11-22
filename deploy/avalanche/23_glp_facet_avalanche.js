import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("GLPFacet", "./contracts/facets/avalanche");

    let GLPFacet = await deploy("GLPFacet", {
        from: deployer,
        gasLimit: 15000000,
        args: [],
    });


    console.log(
        `GLPFacet implementation deployed at address: ${GLPFacet.address}`
    );

    await verifyContract(hre,
        {
            address: GLPFacet.address,
            contract: `contracts/facets/avalanche/GLPFacet.sol:GLPFacet`,
            constructorArguments: []
        });
    console.log(`Verified GLPFacet`);
};

module.exports.tags = ["avalanche-glp"];
