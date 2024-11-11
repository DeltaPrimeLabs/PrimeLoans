import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

const { ethers } = require("hardhat");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("SmartLoanWrappedNativeTokenFacet", "./contracts/facets");

    let smartLoanWrappedNativeTokenFacet = await deploy("SmartLoanWrappedNativeTokenFacet", {
        from: deployer,
        contract: "contracts/facets/SmartLoanWrappedNativeTokenFacet.sol:SmartLoanWrappedNativeTokenFacet",
        args: [],
    });

    console.log(`Deployed SmartLoanWrappedNativeTokenFacet at address: ${smartLoanWrappedNativeTokenFacet.address}`);

    await verifyContract(hre, {
        address: smartLoanWrappedNativeTokenFacet.address,
        contract: "contracts/facets/SmartLoanWrappedNativeTokenFacet.sol:SmartLoanWrappedNativeTokenFacet"
    })

    console.log('Verified SmartLoanWrappedNativeTokenFacet.')
};

module.exports.tags = ["arbitrum-wrapped-native-token-facet"];
