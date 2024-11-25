import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("DepositRewarderERC20", "./contracts");

    const sAVAXAddress = "0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE"
    let ggAVAXAddress = "0xA25EaF2906FA1a3a13EdAc9B9657108Af7B703e3";

    const WavaxPoolTUPAddress = "0xD26E504fc642B96751fD55D3E68AF295806542f5";
    const USDTPoolTUPAddress = "0xd222e10D7Fe6B7f9608F14A8B5Cf703c74eFBcA1";

    const USDCPoolTUPAddress = "0x2323dAC85C6Ab9bd6a8B5Fb75B0581E31232d12b";
    const BTCPoolTUPAddress = "0x475589b0Ed87591A893Df42EC6076d2499bB63d0";

    const pool = BTCPoolTUPAddress;
    const rewardToken = ggAVAXAddress;


    let _args = [rewardToken, pool];

    let depositRewarderERC20Contract = await deploy("DepositRewarderERC20", {
        from: deployer,
        args: _args,
    });


    console.log(
        `DepositRewarder implementation deployed at address: ${depositRewarderERC20Contract.address}`
    );


    await new Promise(r => setTimeout(r, 20000));

    await verifyContract(hre,
        {
            address: depositRewarderERC20Contract.address,
            contract: `contracts/DepositRewarderERC20.sol:DepositRewarderERC20`,
            constructorArguments: _args
        });
    console.log(`Verified DepositRewarder`);
};

module.exports.tags = ["avalanche-deposit-rewarder-erc20"];
