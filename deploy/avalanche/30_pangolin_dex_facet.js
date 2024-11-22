import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("PangolinDEXFacet", "./contracts/facets/avalanche");

    let PangolinDEXFacet = await deploy("PangolinDEXFacet", {
        from: deployer,
        gasLimit: 15000000,
        args: [],
    });


    console.log(
        `PangolinDEXFacet implementation deployed at address: ${PangolinDEXFacet.address}`
    );

    await verifyContract(hre,
        {
            address: PangolinDEXFacet.address,
            contract: `contracts/facets/avalanche/PangolinDEXFacet.sol:PangolinDEXFacet`,
            constructorArguments: []
        });
    console.log(`Verified PangolinDEXFacet`);
};

module.exports.tags = ["avalanche-pangolin-dex-facet"];
