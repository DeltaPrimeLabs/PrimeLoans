import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    let AddressBlacklist = await deploy("AddressBlacklist", {
        from: deployer,
        args: [],
    });


    console.log(
        `AddressBlacklist deployed at address: ${AddressBlacklist.address}`
    );

    await verifyContract(hre,
        {
            address: AddressBlacklist.address,
            contract: `contracts/AddressBlacklist.sol:AddressBlacklist`,
            constructorArguments: []
        });
    console.log(`Verified AddressBlacklist`);



};

module.exports.tags = ["avalanche-address-blacklist"];
