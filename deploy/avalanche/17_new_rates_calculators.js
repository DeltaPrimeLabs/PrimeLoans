import hre from "hardhat";

const { embedCommitHash } = require("../../tools/scripts/embed-commit-hash");
import verifyContract from "../../tools/scripts/verify-contract";
const {ethers} = require("hardhat");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    embedCommitHash(
        "UsdcVariableUtilisationRatesCalculator",
        "./contracts/deployment/avalanche"
    );

    embedCommitHash(
        "UsdtVariableUtilisationRatesCalculator",
        "./contracts/deployment/avalanche"
    );

    let result = await deploy("UsdcVariableUtilisationRatesCalculator", {
        contract: 'contracts/deployment/avalanche/UsdcVariableUtilisationRatesCalculator.sol:UsdcVariableUtilisationRatesCalculator',
        from: deployer,
        gasLimit: 15000000,
        args: [],
    });

    console.log(
        `Deployed UsdcVariableUtilisationRatesCalculator at address: ${result.address}`
    );

    await verifyContract(hre,
        {
            address: result.address,
            contract: `contracts/deployment/avalanche/UsdcVariableUtilisationRatesCalculator.sol:UsdcVariableUtilisationRatesCalculator`,
            constructorArguments: []
        });
    console.log(`Verified UsdcVariableUtilisationRatesCalculator`)

    result = await deploy("UsdtVariableUtilisationRatesCalculator", {
        contract: 'contracts/deployment/avalanche/UsdtVariableUtilisationRatesCalculator.sol:UsdtVariableUtilisationRatesCalculator',
        from: deployer,
        gasLimit: 15000000,
        args: [],
    });

    console.log(
        `Deployed UsdtVariableUtilisationRatesCalculator at address: ${result.address}`
    );

    await verifyContract(hre,
        {
            address: result.address,
            contract: `contracts/deployment/avalanche/UsdtVariableUtilisationRatesCalculator.sol:UsdtVariableUtilisationRatesCalculator`,
            constructorArguments: []
        });
    console.log(`Verified UsdtVariableUtilisationRatesCalculator`)
};

module.exports.tags = ["avalanche-rates-calculator"];
