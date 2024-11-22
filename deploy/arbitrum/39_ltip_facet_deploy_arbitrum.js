import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("LTIPFacet", "./contracts/facets/arbitrum");

    let LTIPFacet = await deploy("LTIPFacet", {
        from: deployer,
        gasLimit: 100000000,
        args: [],
    });


    console.log(
        `LTIPFacet implementation deployed at address: ${LTIPFacet.address}`
    );

    await verifyContract(hre,
        {
            address: LTIPFacet.address,
            contract: `contracts/facets/arbitrum/LTIPFacet.sol:LTIPFacet`,
            constructorArguments: []
        });
    console.log(`Verified LTIPFacet`);
};

module.exports.tags = ["arbitrum-ltip-facet"];
