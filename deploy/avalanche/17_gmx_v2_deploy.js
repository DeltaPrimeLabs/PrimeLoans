import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";
const web3Abi  = require('web3-eth-abi');
const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    // embedCommitHash("GmxV2FacetAvalanche", "./contracts/facets/avalanche");
    embedCommitHash("GmxV2CallbacksFacetAvalanche", "./contracts/facets/avalanche");

    // let GmxV2FacetAvalanche = await deploy("GmxV2FacetAvalanche", {
    //     from: deployer,
    //     gasLimit: 15000000,
    //     args: [],
    // });
    //
    //
    // console.log(
    //     `GmxV2FacetAvalanche implementation deployed at address: ${GmxV2FacetAvalanche.address}`
    // );
    //
    // await verifyContract(hre,
    //     {
    //         address: GmxV2FacetAvalanche.address,
    //         contract: `contracts/facets/avalanche/GmxV2FacetAvalanche.sol:GmxV2FacetAvalanche`,
    //         constructorArguments: []
    //     });
    // console.log(`Verified GmxV2FacetAvalanche`);

    let GmxV2CallbacksFacetAvalanche = await deploy("GmxV2CallbacksFacetAvalanche", {
        from: deployer,
        gasLimit: 15000000,
        args: [],
    });


    console.log(
        `GmxV2CallbacksFacetAvalanche implementation deployed at address: ${GmxV2CallbacksFacetAvalanche.address}`
    );

    await verifyContract(hre,
        {
            address: GmxV2CallbacksFacetAvalanche.address,
            contract: `contracts/facets/avalanche/GmxV2CallbacksFacetAvalanche.sol:GmxV2CallbacksFacetAvalanche`,
            constructorArguments: []
        });
    console.log(`Verified GmxV2CallbacksFacetAvalanche`);
};

module.exports.tags = ["avax-gmx-v2"];
