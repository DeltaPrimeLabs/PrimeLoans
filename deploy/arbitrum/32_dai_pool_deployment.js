import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import hre from "hardhat";
import verifyContract from "../../tools/scripts/verify-contract";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    // embedCommitHash("Pool", "./contracts");
    // embedCommitHash("DaiPool", "./contracts/deployment/arbitrum");
    // embedCommitHash("DaiVariableUtilisationRatesCalculator", "./contracts/deployment/arbitrum");

    const pool = await deploy("Pool", {
        contract: "contracts/Pool.sol:Pool",
        from: deployer,
        gasLimit: 80000000,
        args: [],
    });

    console.log(
        `Deployed Pool at address: ${pool.address}`
    );

    await verifyContract(hre,
        {
            address: pool.address,
            contract: `contracts/Pool.sol:Pool`,
            constructorArguments: []
        });
    console.log(`Verified Pool`);

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


module.exports.tags = ["arbitrum-pool"];
