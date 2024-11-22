import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

const { ethers } = require("hardhat");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    // TODO: Change getExchangeIntermediaryContract in SushiSwapDEXFacet

    embedCommitHash("SushiSwapDEXFacet", "./contracts/facets/arbitrum");

    let SushiSwapDEXFacet = await deploy("SushiSwapDEXFacet", {
        from: deployer,
        gasLimit: 50000000,
        args: [],
    });

    console.log(
        `SushiSwapDEXFacet implementation deployed at address: ${SushiSwapDEXFacet.address}`
    );

    await verifyContract(hre,
        {
            address: SushiSwapDEXFacet.address,
            contract: `contracts/facets/arbitrum/SushiSwapDEXFacet.sol:SushiSwapDEXFacet`,
            constructorArguments: []
        });
    console.log(`Verified SushiSwapDEXFacet`);

};

module.exports.tags = ["arbitrum-sushi-dex"];
