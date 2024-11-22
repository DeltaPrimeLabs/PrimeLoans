import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

const { ethers } = require("hardhat");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("DepositSwapArbitrum");

    let depositSwapArbitrum = await deploy("DepositSwapArbitrum", {
        from: deployer,
        gasLimit: 50000000,
        args: [],
    });

    console.log(`Deployed DepositSwapArbitrum at address: ${depositSwapArbitrum.address}`);

    await verifyContract(hre, {
        address: depositSwapArbitrum.address,
        contract: "contracts/DepositSwapArbitrum.sol:DepositSwapArbitrum"
    })

    console.log('Verified DepositSwapArbitrum.')
};

module.exports.tags = ["arbitrum-deposit-swap"];
