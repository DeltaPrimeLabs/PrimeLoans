import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    const ARBITRUM_OWNER_MULTISIG = "0xDfA6706FC583b635CD6daF0E3915901A2fBaBAaD";
    const AVALANCHE_OWNER_MULTISIG = "0x44AfCcF712E8A097a6727B48b57c75d7A85a9B0c";
    const ARBITRUM_ADMIN_MULTISIG = "0xa9Ca8462aB2949ADa86297904e09Ab4Eb12cdCf0";
    const AVALANCHE_ADMIN_MULTISIG = "0x6855A3cA53cB01646A9a3e6d1BC30696499C0b4a";
    const INITIAL_DELAY = 60 * 60 * 24; // 15 minutes

    const constructorArgs = [
        ARBITRUM_ADMIN_MULTISIG,
        INITIAL_DELAY,
    ];

    let TimeLock = await deploy("Timelock", {
        from: deployer,
        gasLimit: 50000000,
        args: constructorArgs,
    });


    console.log(
        `TimeLock implementation deployed at address: ${TimeLock.address}`
    );

    await verifyContract(hre,
        {
            address: TimeLock.address,
            contract: `contracts/TimeLock.sol:Timelock`,
            constructorArguments: constructorArgs,
        });
    console.log(`Verified TimeLock`);
};

module.exports.tags = ["arbitrum-timelock"];
