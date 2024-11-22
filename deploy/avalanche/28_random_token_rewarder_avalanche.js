import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

const { ethers } = require("hardhat");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    const btcEligibleUsersListAddress = "0x4109d34B4fB8427ABc03D9D0C76c04bBe453D640";

    let randomTokenRewarder = await deploy("RandomTokenRewarder", {
        from: deployer,
        gasLimit: 15000000,
        args: [btcEligibleUsersListAddress],
    });

    console.log(`Deployed RandomTokenRewarder at address: ${randomTokenRewarder.address}`);

    await verifyContract(hre, {
        address: randomTokenRewarder.address,
        contract: "contracts/RandomTokenRewarder.sol:RandomTokenRewarder",
        constructorArguments: [btcEligibleUsersListAddress]
    })

    console.log('Verified RandomTokenRewarder.')
};

module.exports.tags = ["avalanche-random-token-rewarder"];
