import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("YieldYakFacetArbi", "./contracts/facets/arbitrum");

    let YieldYakFacetArbi = await deploy("YieldYakFacetArbi", {
        from: deployer,
        args: [],
    });


    console.log(
        `YieldYakFacetArbi implementation deployed at address: ${YieldYakFacetArbi.address}`
    );

    await new Promise(r => setTimeout(r, 10000));

    await verifyContract(hre,
        {
            address: YieldYakFacetArbi.address,
            contract: `contracts/facets/arbitrum/YieldYakFacetArbi.sol:YieldYakFacetArbi`,
            constructorArguments: []
        });
    console.log(`Verified YieldYakFacetArbi`);
};

module.exports.tags = ["arbitrum-yield-yak-facet"];
