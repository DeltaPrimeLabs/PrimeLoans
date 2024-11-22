import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import hre from "hardhat";
import verifyContract from "../../tools/scripts/verify-contract";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("Pool", "./contracts");

    embedCommitHash("WethPool", "./contracts/deployment/arbitrum");
    embedCommitHash("UsdcPool", "./contracts/deployment/arbitrum");

    const wethPool = await deploy("WethPool", {
        contract: "contracts/deployment/arbitrum/WethPool.sol:WethPool",
        from: deployer,
        gasLimit: 20000000,
        args: [],
    });

    console.log(
        `Deployed WethPool at address: ${wethPool.address}`
    );

    await verifyContract(hre,
        {
            address: wethPool.address,
            contract: `contracts/deployment/arbitrum/WethPool.sol:WethPool`,
            constructorArguments: []
        });
    console.log(`Verified WethPool`);

    const usdcPool = await deploy("UsdcPool", {
        contract: "contracts/deployment/arbitrum/UsdcPool.sol:UsdcPool",
        from: deployer,
        gasLimit: 20000000,
        args: [],
    });

    console.log(
        `Deployed UsdcPool at address: ${usdcPool.address}`
    );

    await verifyContract(hre,
        {
            address: usdcPool.address,
            contract: `contracts/deployment/arbitrum/UsdcPool.sol:UsdcPool`,
            constructorArguments: []
        });
    console.log(`Verified UsdcPool`);

    const wethPoolTUP = await ethers.getContract("WethPoolTUP", admin);
    const usdcPoolTUP = await ethers.getContract("UsdcPoolTUP", admin);

    await wethPoolTUP.upgradeTo(wethPool.address);
    await usdcPoolTUP.upgradeTo(usdcPool.address);
};


module.exports.tags = ["arbitrum-pool-1"];
