import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("YieldYakFacet", "./contracts/facets/avalanche");

    let YieldYakFacet = await deploy("YieldYakFacet", {
        from: deployer,
        gasLimit: 15000000,
        args: [],
    });


    console.log(
        `YieldYakFacet implementation deployed at address: ${YieldYakFacet.address}`
    );

    await verifyContract(hre,
        {
            address: YieldYakFacet.address,
            contract: `contracts/facets/avalanche/YieldYakFacet.sol:YieldYakFacet`,
            constructorArguments: []
        });
    console.log(`Verified YieldYakFacet`);
};

module.exports.tags = ["avalanche-yieldyak-facet"];
