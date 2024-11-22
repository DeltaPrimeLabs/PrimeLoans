import hre, { ethers } from "hardhat";

const { embedCommitHash } = require("../../tools/scripts/embed-commit-hash");
import verifyContract from "../../tools/scripts/verify-contract";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    embedCommitHash('Pool', './contracts');

    embedCommitHash('WethPool', './contracts/deployment/arbitrum');
    embedCommitHash('BtcPool', './contracts/deployment/arbitrum');
    embedCommitHash('UsdcPool', './contracts/deployment/arbitrum');
    embedCommitHash('ArbPool', './contracts/deployment/arbitrum');

    let pools = {}

    let wethPool = await deploy("WethPool", {
        contract: "contracts/deployment/arbitrum/WethPool.sol:WethPool",
        from: deployer,
        gasLimit: 100000000,
        args: [],
    });

    pools["ETH"] = wethPool.address;
    console.log(`Deployed WethPool at address: ${wethPool.address}`);

    await verifyContract(hre,
        {
            address: wethPool.address,
            contract: `contracts/deployment/arbitrum/WethPool.sol:WethPool`,
            constructorArguments: []
        });
    console.log(`Verified WethPool`)



    let btcPool = await deploy("BtcPool", {
        contract: "contracts/deployment/arbitrum/BtcPool.sol:BtcPool",
        from: deployer,
        gasLimit: 100000000,
        args: [],
    });

    pools["BTC"] = btcPool.address;
    console.log(`Deployed BtcPool at address: ${btcPool.address}`);

    await verifyContract(hre,
        {
            address: btcPool.address,
            contract: `contracts/deployment/arbitrum/BtcPool.sol:BtcPool`,
            constructorArguments: []
        });
    console.log(`Verified BtcPool`)



    let usdcPool = await deploy("UsdcPool", {
        contract: "contracts/deployment/arbitrum/UsdcPool.sol:UsdcPool",
        from: deployer,
        gasLimit: 100000000,
        args: [],
    });

    pools["USDC"] = usdcPool.address;
    console.log(`Deployed UsdcPool at address: ${usdcPool.address}`);

    await verifyContract(hre,
        {
            address: usdcPool.address,
            contract: `contracts/deployment/arbitrum/UsdcPool.sol:UsdcPool`,
            constructorArguments: []
        });
    console.log(`Verified UsdcPool`)


    let arbPool = await deploy("ArbPool", {
        contract: "contracts/deployment/arbitrum/ArbPool.sol:ArbPool",
        from: deployer,
        gasLimit: 100000000,
        args: [],
    });

    pools["ARB"] = arbPool.address;
    console.log(`Deployed ArbPool at address: ${arbPool.address}`);

    await verifyContract(hre,
        {
            address: arbPool.address,
            contract: `contracts/deployment/arbitrum/ArbPool.sol:ArbPool`,
            constructorArguments: []
        });
    console.log(`Verified ArbPool`);

    console.log(Object.entries(pools))

};

module.exports.tags = ["arbitrum-pools-update"];
