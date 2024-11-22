import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import hre from "hardhat";
import verifyContract from "../../tools/scripts/verify-contract";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("Pool", "./contracts");
    embedCommitHash("DaiPool", "./contracts/deployment/arbitrum");
    // embedCommitHash("DaiVariableUtilisationRatesCalculator", "./contracts/deployment/arbitrum");

    const DaiPool = await deploy("DaiPool", {
        contract: "contracts/deployment/arbitrum/DaiPool.sol:DaiPool",
        from: deployer,
        gasLimit: 80000000,
        args: [],
    });

    console.log(
        `Deployed DaiPool at address: ${DaiPool.address}`
    );

    await verifyContract(hre,
        {
            address: DaiPool.address,
            contract: `contracts/deployment/arbitrum/DaiPool.sol:DaiPool`,
            constructorArguments: []
        });
    console.log(`Verified DaiPool`);

    // const DaiVariableUtilisationRatesCalculator = await deploy("DaiVariableUtilisationRatesCalculator", {
    //     contract: "contracts/deployment/arbitrum/DaiVariableUtilisationRatesCalculator.sol:DaiVariableUtilisationRatesCalculator",
    //     from: deployer,
    //     gasLimit: 80000000,
    //     args: [],
    // });
    //
    // console.log(
    //     `Deployed DaiVariableUtilisationRatesCalculator at address: ${DaiVariableUtilisationRatesCalculator.address}`
    // );
    //
    // await verifyContract(hre,
    //     {
    //         address: DaiVariableUtilisationRatesCalculator.address,
    //         contract: `contracts/deployment/arbitrum/DaiVariableUtilisationRatesCalculator.sol:DaiVariableUtilisationRatesCalculator`,
    //         constructorArguments: []
    //     });
    // console.log(`Verified DaiVariableUtilisationRatesCalculator`);
};


module.exports.tags = ["arbitrum-pool-dai"];
