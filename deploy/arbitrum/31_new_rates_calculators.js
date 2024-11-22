import hre from "hardhat";

const { embedCommitHash } = require("../../tools/scripts/embed-commit-hash");
import verifyContract from "../../tools/scripts/verify-contract";
const {ethers} = require("hardhat");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    embedCommitHash(
        "UsdcVariableUtilisationRatesCalculator",
        "./contracts/deployment/arbitrum"
    );

    let result = await deploy("UsdcVariableUtilisationRatesCalculator", {
        contract: 'contracts/deployment/arbitrum/UsdcVariableUtilisationRatesCalculator.sol:UsdcVariableUtilisationRatesCalculator',
        from: deployer,
        gasLimit: 80000000,
        args: [],
    });

    console.log(
        `Deployed UsdcVariableUtilisationRatesCalculator at address: ${result.address}`
    );

    await verifyContract(hre,
        {
            address: result.address,
            contract: `contracts/deployment/arbitrum/UsdcVariableUtilisationRatesCalculator.sol:UsdcVariableUtilisationRatesCalculator`,
            constructorArguments: []
        });
    console.log(`Verified UsdcVariableUtilisationRatesCalculator`)
};

module.exports.tags = ["arbitrum-rates-calculator"];
