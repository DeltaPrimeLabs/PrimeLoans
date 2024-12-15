import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("YieldYakSwapArbitrumFacet", "./contracts/facets/arbitrum");

    let YieldYakSwapArbitrumFacet = await deploy("YieldYakSwapArbitrumFacet", {
        from: deployer,
        args: [],
    });


    console.log(
        `YieldYakSwapArbitrumFacet implementation deployed at address: ${YieldYakSwapArbitrumFacet.address}`
    );

    await new Promise(r => setTimeout(r, 10000));

    await verifyContract(hre,
        {
            address: YieldYakSwapArbitrumFacet.address,
            contract: `contracts/facets/arbitrum/YieldYakSwapArbitrumFacet.sol:YieldYakSwapArbitrumFacet`,
            constructorArguments: []
        });
    console.log(`Verified YieldYakSwapArbitrumFacet`);
};

module.exports.tags = ["arbitrum-yield-yak-swap-arbitrum-facet"];
