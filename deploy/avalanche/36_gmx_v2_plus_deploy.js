import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";
const web3Abi  = require('web3-eth-abi');
const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    // embedCommitHash("GmxV2PlusFacetAvalanche", "./contracts/facets/avalanche");
    embedCommitHash("GmxV2CallbacksFacetAvalanche", "./contracts/facets/avalanche");
    //
    // let GmxV2PlusFacetAvalanche = await deploy("GmxV2PlusFacetAvalanche", {
    //     from: deployer,
    //     gasLimit: 15000000,
    //     args: [],
    // });
    //
    //
    // console.log(
    //     `GmxV2PlusFacetAvalanche implementation deployed at address: ${GmxV2PlusFacetAvalanche.address}`
    // );
    //
    // // Wait 10 seconds for the transaction to be mined
    // await new Promise(r => setTimeout(r, 10000));
    //
    // await verifyContract(hre,
    //     {
    //         address: GmxV2PlusFacetAvalanche.address,
    //         contract: `contracts/facets/avalanche/GmxV2PlusFacetAvalanche.sol:GmxV2PlusFacetAvalanche`,
    //         constructorArguments: []
    //     });
    // console.log(`Verified GmxV2PlusFacetAvalanche`);

    let GmxV2CallbacksFacetAvalanche = await deploy("GmxV2CallbacksFacetAvalanche", {
        from: deployer,
        gasLimit: 15000000,
        args: [],
    });


    console.log(
        `GmxV2CallbacksFacetAvalanche implementation deployed at address: ${GmxV2CallbacksFacetAvalanche.address}`
    );

    // Wait 10 seconds for the transaction to be mined
    await new Promise(r => setTimeout(r, 10000));

    await verifyContract(hre,
        {
            address: GmxV2CallbacksFacetAvalanche.address,
            contract: `contracts/facets/avalanche/GmxV2CallbacksFacetAvalanche.sol:GmxV2CallbacksFacetAvalanche`,
            constructorArguments: []
        });
    console.log(`Verified GmxV2CallbacksFacetAvalanche`);
};

module.exports.tags = ["avax-gmx-v2-plus"];