import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

const { ethers } = require("hardhat");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("DepositSwapAvalanche");

    let depositSwap = await deploy("DepositSwapAvalanche", {
        from: deployer,
        gasLimit: 15000000,
        args: [],
    });

    console.log(`Deployed DepositSwapAvalanche at address: ${depositSwap.address}`);

    await verifyContract(hre, {
        address: depositSwap.address,
        contract: "contracts/DepositSwapAvalanche.sol:DepositSwapAvalanche"
    })

    console.log('Verified DepositSwapAvalanche.')
};

module.exports.tags = ["avalanche-deposit-swap"];
