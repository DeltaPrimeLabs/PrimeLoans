import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import hre from "hardhat";
const networkName = hre.network.name;
import { deployLinearIndex } from "./7_linear_indices";
import { initPool } from "./8_pools_init";
import createMigrationFile from "../../tools/scripts/create-migration-file";
import TOKEN_ADDRESSES from "../../common/addresses/arbitrum/token_addresses.json";
import {pool} from "../../test/_helpers";
import verifyContract from "../../tools/scripts/verify-contract";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("Pool", "./contracts");

    embedCommitHash("UsdtPool", "./contracts/deployment/arbitrum");
    embedCommitHash("UsdtPoolFactory", "./contracts/deployment/arbitrum");
    embedCommitHash("UsdtPoolTUP", "./contracts/proxies/tup/arbitrum");

    embedCommitHash("DaiPool", "./contracts/deployment/arbitrum");
    embedCommitHash("DaiPoolFactory", "./contracts/deployment/arbitrum");
    embedCommitHash("DaiPoolTUP", "./contracts/proxies/tup/arbitrum");

    embedCommitHash("FraxPool", "./contracts/deployment/arbitrum");
    embedCommitHash("FraxPoolFactory", "./contracts/deployment/arbitrum");
    embedCommitHash("FraxPoolTUP", "./contracts/proxies/tup/arbitrum");

    await deployPool(
        deploy,
        deployer,
        admin,
        "UsdtPool",
        "UsdtPoolFactory",
        "UsdtPoolTUP"
    );

    embedCommitHash("UsdtBorrowIndex", "./contracts/deployment/arbitrum");
    embedCommitHash("UsdtDepositIndex", "./contracts/deployment/arbitrum");

    await deployLinearIndex(
        "UsdtBorrowIndex",
        "UsdtPoolTUP",
        deploy,
        deployer,
        admin
    );
    await deployLinearIndex(
        "UsdtDepositIndex",
        "UsdtPoolTUP",
        deploy,
        deployer,
        admin
    );

    embedCommitHash(
        "UsdtVariableUtilisationRatesCalculator",
        "./contracts/deployment/arbitrum"
    );

    let result = await deploy("UsdtVariableUtilisationRatesCalculator", {
        contract: "contracts/deployment/arbitrum/UsdtVariableUtilisationRatesCalculator.sol:UsdtVariableUtilisationRatesCalculator",
        from: deployer,
        gasLimit: 80000000,
        args: [],
    });

    console.log(
        `Deployed UsdtVariableUtilisationRatesCalculator at address: ${result.address}`
    );
    await verifyContract(hre,
        {
            address: result.address,
            contract: `contracts/deployment/arbitrum/UsdtVariableUtilisationRatesCalculator.sol:UsdtVariableUtilisationRatesCalculator`,
            constructorArguments: []
        });
    console.log(`Verified DaiVariableUtilisationRatesCalculator`);
    console.log(`Verified UsdtVariableUtilisationRatesCalculator`);

    await initPool(
        deploy,
        deployer,
        "UsdtVariableUtilisationRatesCalculator",
        "UsdtPoolTUP",
        "UsdtDepositIndexTUP",
        "UsdtBorrowIndexTUP",
        TOKEN_ADDRESSES["USDT"]
    );

    let tokenManagerTUP = await ethers.getContract("TokenManagerTUP");
    let tokenManager = await ethers.getContractAt(
        "TokenManager",
        tokenManagerTUP.address
    );

    const usdtPoolTUP = await ethers.getContract("UsdtPoolTUP");

    let newLendingPools = [pool("USDT", usdtPoolTUP.address)];

    await tokenManager.addPoolAssets(newLendingPools);
    console.log(`Added new USDT pool ${usdtPoolTUP.address}`);

    await deployPool(
        deploy,
        deployer,
        admin,
        "DaiPool",
        "DaiPoolFactory",
        "DaiPoolTUP"
    );

    embedCommitHash("DaiBorrowIndex", "./contracts/deployment/arbitrum");
    embedCommitHash("DaiDepositIndex", "./contracts/deployment/arbitrum");

    await deployLinearIndex(
        "DaiBorrowIndex",
        "DaiPoolTUP",
        deploy,
        deployer,
        admin
    );
    await deployLinearIndex(
        "DaiDepositIndex",
        "DaiPoolTUP",
        deploy,
        deployer,
        admin
    );

    embedCommitHash(
        "DaiVariableUtilisationRatesCalculator",
        "./contracts/deployment/arbitrum"
    );

    result = await deploy("DaiVariableUtilisationRatesCalculator", {
        contract: "contracts/deployment/arbitrum/DaiVariableUtilisationRatesCalculator.sol:DaiVariableUtilisationRatesCalculator",
        from: deployer,
        gasLimit: 80000000,
        args: [],
    });

    console.log(
        `Deployed DaiVariableUtilisationRatesCalculator at address: ${result.address}`
    );

    await verifyContract(hre,
        {
            address: result.address,
            contract: `contracts/deployment/arbitrum/DaiVariableUtilisationRatesCalculator.sol:DaiVariableUtilisationRatesCalculator`,
            constructorArguments: []
        });
    console.log(`Verified DaiVariableUtilisationRatesCalculator`);

    await initPool(
        deploy,
        deployer,
        "DaiVariableUtilisationRatesCalculator",
        "DaiPoolTUP",
        "DaiDepositIndexTUP",
        "DaiBorrowIndexTUP",
        TOKEN_ADDRESSES["DAI"]
    );

    tokenManagerTUP = await ethers.getContract("TokenManagerTUP");
    tokenManager = await ethers.getContractAt(
        "TokenManager",
        tokenManagerTUP.address
    );

    const daiPoolTUP = await ethers.getContract("DaiPoolTUP");

    newLendingPools = [pool("DAI", daiPoolTUP.address)];

    await tokenManager.addPoolAssets(newLendingPools);
    console.log(`Added new DAI pool ${daiPoolTUP.address}`);

    await deployPool(
        deploy,
        deployer,
        admin,
        "FraxPool",
        "FraxPoolFactory",
        "FraxPoolTUP"
    );

    embedCommitHash("FraxBorrowIndex", "./contracts/deployment/arbitrum");
    embedCommitHash("FraxDepositIndex", "./contracts/deployment/arbitrum");

    await deployLinearIndex(
        "FraxBorrowIndex",
        "FraxPoolTUP",
        deploy,
        deployer,
        admin
    );
    await deployLinearIndex(
        "FraxDepositIndex",
        "FraxPoolTUP",
        deploy,
        deployer,
        admin
    );

    embedCommitHash(
        "FraxVariableUtilisationRatesCalculator",
        "./contracts/deployment/arbitrum"
    );

    result = await deploy("FraxVariableUtilisationRatesCalculator", {
        contract: "contracts/deployment/arbitrum/FraxVariableUtilisationRatesCalculator.sol:FraxVariableUtilisationRatesCalculator",
        from: deployer,
        gasLimit: 80000000,
        args: [],
    });

    console.log(
        `Deployed FraxVariableUtilisationRatesCalculator at address: ${result.address}`
    );

    await verifyContract(hre,
        {
            address: result.address,
            contract: `contracts/deployment/arbitrum/FraxVariableUtilisationRatesCalculator.sol:FraxVariableUtilisationRatesCalculator`,
            constructorArguments: []
        });
    console.log(`Verified FraxVariableUtilisationRatesCalculator`);

    await initPool(
        deploy,
        deployer,
        "FraxVariableUtilisationRatesCalculator",
        "FraxPoolTUP",
        "FraxDepositIndexTUP",
        "FraxBorrowIndexTUP",
        TOKEN_ADDRESSES["FRAX"]
    );

    tokenManagerTUP = await ethers.getContract("TokenManagerTUP");
    tokenManager = await ethers.getContractAt(
        "TokenManager",
        tokenManagerTUP.address
    );

    const fraxPoolTUP = await ethers.getContract("FraxPoolTUP");

    newLendingPools = [pool("FRAX", fraxPoolTUP.address)];

    await tokenManager.addPoolAssets(newLendingPools);
    console.log(`Added new FRAX pool ${fraxPoolTUP.address}`);
};

async function deployPool(deploy, deployer, admin, contract, poolFactory, tup) {
    let result = await deploy(poolFactory, {
        contract: `contracts/deployment/arbitrum/${poolFactory}.sol:${poolFactory}`,
        from: deployer,
        gasLimit: 50000000,
        args: [],
    });

    await verifyContract(hre,
        {
            address: result.address,
            contract: `contracts/deployment/arbitrum/${poolFactory}.sol:${poolFactory}`,
            constructorArguments: []
        });
    console.log(`${poolFactory} contract verified`);

    const factory = await ethers.getContract(poolFactory);

    const tx = await factory.deployPool();
    const receipt = await tx.wait();
    let poolAddress = receipt.events[0].args[1];

    console.log(
        `${contract} pool deployed at address: ${poolAddress} by a factory`
    );

    await verifyContract(hre,
        {
            address: poolAddress,
            contract: `contracts/deployment/arbitrum/${contract}.sol:${contract}`,
            constructorArguments: []
        });
    console.log(`Verified pool contract ${contract}`)

    createMigrationFile(
        networkName,
        contract,
        poolAddress,
        receipt.transactionHash
    );

    result = await deploy(tup, {
        contract: `contracts/proxies/tup/arbitrum/${tup}.sol:${tup}`,
        from: deployer,
        gasLimit: 80000000,
        args: [poolAddress, admin, []],
    });

    console.log(`${tup} deployed at address: ${result.address}`);

    await verifyContract(hre,
        {
            address: result.address,
            contract: `contracts/proxies/tup/arbitrum/${tup}.sol:${tup}`,
            constructorArguments: [poolAddress, admin, []]
        });
    console.log(`Verified ${tup}`)
}

module.exports.tags = ["arbitrum-stable-pools"];
