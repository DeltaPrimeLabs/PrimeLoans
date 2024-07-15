import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";
const web3Abi  = require('web3-eth-abi');
const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("GmxV2FacetArbitrum", "./contracts/facets/arbitrum");
    // embedCommitHash("GmxV2CallbacksFacetArbitrum", "./contracts/facets/arbitrum");

    let GmxV2FacetArbitrum = await deploy("GmxV2FacetArbitrum", {
        from: deployer,
        gasLimit: 100000000,
        args: [],
    });


    console.log(
        `GmxV2FacetArbitrum implementation deployed at address: ${GmxV2FacetArbitrum.address}`
    );

    await verifyContract(hre,
        {
            address: GmxV2FacetArbitrum.address,
            contract: `contracts/facets/arbitrum/GmxV2FacetArbitrum.sol:GmxV2FacetArbitrum`,
            constructorArguments: []
        });
    console.log(`Verified GmxV2FacetArbitrum`);

    // let GmxV2CallbacksFacetArbitrum = await deploy("GmxV2CallbacksFacetArbitrum", {
    //     from: deployer,
    //     gasLimit: 100000000,
    //     args: [],
    // });
    //
    //
    // console.log(
    //     `GmxV2CallbacksFacetArbitrum implementation deployed at address: ${GmxV2CallbacksFacetArbitrum.address}`
    // );
    //
    // await verifyContract(hre,
    //     {
    //         address: GmxV2CallbacksFacetArbitrum.address,
    //         contract: `contracts/facets/arbitrum/GmxV2CallbacksFacetArbitrum.sol:GmxV2CallbacksFacetArbitrum`,
    //         constructorArguments: []
    //     });
    // console.log(`Verified GmxV2CallbacksFacetArbitrum`);
};

module.exports.tags = ["arbi-gmx-v2"];
