import { parseEther } from "viem";
import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();
    const LZ_ENDPOINT = "0x3c2269811836af69497E5F486A85D7316753cf62";
    embedCommitHash("Prime", "./contracts/token");

    let Prime = await deploy("Prime", {
        from: deployer,
        gasLimit: 15000000,
        args: [parseEther("40000000").toString()],
    });

    
    console.log(
        `Prime deployed at address: ${Prime.address}`
    );

    await verifyContract(hre,
        {
            address: Prime.address,
            contract: `contracts/token/Prime.sol:Prime`,
            constructorArguments: [parseEther("40000000").toString()]
        });
    console.log(`Verified Prime`);

    embedCommitHash("PrimeBridge", "./contracts/token");
    let PrimeBridge = await deploy("PrimeBridge", {
        from: deployer,
        gasLimit: 15000000,
        args: [Prime.address, "6", LZ_ENDPOINT],
    });

    
    console.log(
        `PrimeBridge deployed at address: ${PrimeBridge.address}`
    );

    await verifyContract(hre,
        {
            address: PrimeBridge.address,
            contract: `contracts/token/PrimeBridge.sol:PrimeBridge`,
            constructorArguments: [Prime.address, "6", LZ_ENDPOINT]
        });
    console.log(`Verified PrimeBridge`);
};

module.exports.tags = ["avalanche-prime"];
