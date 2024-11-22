import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("TokenManager", "./contracts");

    let TokenManager = await deploy("TokenManager", {
        from: deployer,
        gasLimit: 100000000,
        args: [],
    });


    console.log(
        `TokenManager implementation deployed at address: ${TokenManager.address}`
    );

    await new Promise((resolve) => {
        setTimeout(resolve, 5000);
    });

    await verifyContract(hre,
        {
            address: TokenManager.address,
            contract: `contracts/TokenManager.sol:TokenManager`,
            constructorArguments: []
        });
    console.log(`Verified TokenManager`);
};

module.exports.tags = ["arbitrum-token-manager"];
