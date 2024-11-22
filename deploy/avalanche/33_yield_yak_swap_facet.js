import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("YieldYakSwapFacet", "./contracts/facets/avalanche");

    let YieldYakSwapFacet = await deploy("YieldYakSwapFacet", {
        from: deployer,
        gasLimit: 15000000,
        args: [],
    });


    console.log(
        `YieldYakSwapFacet implementation deployed at address: ${YieldYakSwapFacet.address}`
    );

    await verifyContract(hre,
        {
            address: YieldYakSwapFacet.address,
            contract: `contracts/facets/avalanche/YieldYakSwapFacet.sol:YieldYakSwapFacet`,
            constructorArguments: []
        });
    console.log(`Verified YieldYakSwapFacet`);
};

module.exports.tags = ["avalanche-yieldyak-swap-facet"];
