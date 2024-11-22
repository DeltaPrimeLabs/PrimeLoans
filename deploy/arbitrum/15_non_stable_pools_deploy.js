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

    embedCommitHash("UniPool", "./contracts/deployment/arbitrum");
    embedCommitHash("UniPoolFactory", "./contracts/deployment/arbitrum");
    embedCommitHash("UniPoolTUP", "./contracts/proxies/tup/arbitrum");

    embedCommitHash("LinkPool", "./contracts/deployment/arbitrum");
    embedCommitHash("LinkPoolFactory", "./contracts/deployment/arbitrum");
    embedCommitHash("LinkPoolTUP", "./contracts/proxies/tup/arbitrum");

    embedCommitHash("ArbPool", "./contracts/deployment/arbitrum");
    embedCommitHash("ArbPoolFactory", "./contracts/deployment/arbitrum");
    embedCommitHash("ArbPoolTUP", "./contracts/proxies/tup/arbitrum");

    await deployPool(
        deploy,
        deployer,
        admin,
        "ArbPool",
        "ArbPoolFactory",
        "ArbPoolTUP"
    );

    embedCommitHash("ArbBorrowIndex", "./contracts/deployment/arbitrum");
    embedCommitHash("ArbDepositIndex", "./contracts/deployment/arbitrum");

    await deployLinearIndex(
        "ArbBorrowIndex",
        "ArbPoolTUP",
        deploy,
        deployer,
        admin
    );
    await deployLinearIndex(
        "ArbDepositIndex",
        "ArbPoolTUP",
        deploy,
        deployer,
        admin
    );

    embedCommitHash(
        "ArbVariableUtilisationRatesCalculator",
        "./contracts/deployment/arbitrum"
    );

    let result = await deploy("ArbVariableUtilisationRatesCalculator", {
        contract: "contracts/deployment/arbitrum/ArbVariableUtilisationRatesCalculator.sol:ArbVariableUtilisationRatesCalculator",
        from: deployer,
        gasLimit: 80000000,
        args: [],
    });

    console.log(
        `Deployed ArbVariableUtilisationRatesCalculator at address: ${result.address}`
    );
    await verifyContract(hre,
        {
            address: result.address,
            contract: `contracts/deployment/arbitrum/ArbVariableUtilisationRatesCalculator.sol:ArbVariableUtilisationRatesCalculator`,
            constructorArguments: []
        });
    console.log(`Verified ArbVariableUtilisationRatesCalculator`);

    await initPool(
        deploy,
        deployer,
        "ArbVariableUtilisationRatesCalculator",
        "ArbPoolTUP",
        "ArbDepositIndexTUP",
        "ArbBorrowIndexTUP",
        TOKEN_ADDRESSES["ARB"]
    );

    let tokenManagerTUP = await ethers.getContract("TokenManagerTUP");
    let tokenManager = await ethers.getContractAt(
        "TokenManager",
        tokenManagerTUP.address
    );

    const arbPoolTUP = await ethers.getContract("ArbPoolTUP");

    let newLendingPools = [pool("ARB", arbPoolTUP.address)];

    await tokenManager.addPoolAssets(newLendingPools);
    console.log(`Added new ARB pool ${arbPoolTUP.address}`);

    

    // await deployPool(
    //     deploy,
    //     deployer,
    //     admin,
    //     "UniPool",
    //     "UniPoolFactory",
    //     "UniPoolTUP"
    // );
    //
    // embedCommitHash("UniBorrowIndex", "./contracts/deployment/arbitrum");
    // embedCommitHash("UniDepositIndex", "./contracts/deployment/arbitrum");
    //
    // await deployLinearIndex(
    //     "UniBorrowIndex",
    //     "UniPoolTUP",
    //     deploy,
    //     deployer,
    //     admin
    // );
    // await deployLinearIndex(
    //     "UniDepositIndex",
    //     "UniPoolTUP",
    //     deploy,
    //     deployer,
    //     admin
    // );
    //
    // embedCommitHash(
    //     "UniVariableUtilisationRatesCalculator",
    //     "./contracts/deployment/arbitrum"
    // );
    //
    // let result = await deploy("UniVariableUtilisationRatesCalculator", {
    //     contract: "contracts/deployment/arbitrum/UniVariableUtilisationRatesCalculator.sol:UniVariableUtilisationRatesCalculator",
    //     from: deployer,
    //     gasLimit: 80000000,
    //     args: [],
    // });
    //
    // console.log(
    //     `Deployed UniVariableUtilisationRatesCalculator at address: ${result.address}`
    // );
    // await verifyContract(hre,
    //     {
    //         address: result.address,
    //         contract: `contracts/deployment/arbitrum/UniVariableUtilisationRatesCalculator.sol:UniVariableUtilisationRatesCalculator`,
    //         constructorArguments: []
    //     });
    // console.log(`Verified UniVariableUtilisationRatesCalculator`);
    //
    // await initPool(
    //     deploy,
    //     deployer,
    //     "UniVariableUtilisationRatesCalculator",
    //     "UniPoolTUP",
    //     "UniDepositIndexTUP",
    //     "UniBorrowIndexTUP",
    //     TOKEN_ADDRESSES["UNI"]
    // );
    //
    // let tokenManagerTUP = await ethers.getContract("TokenManagerTUP");
    // let tokenManager = await ethers.getContractAt(
    //     "TokenManager",
    //     tokenManagerTUP.address
    // );
    //
    // const uniPoolTUP = await ethers.getContract("UniPoolTUP");
    //
    // let newLendingPools = [pool("UNI", uniPoolTUP.address)];
    //
    // await tokenManager.addPoolAssets(newLendingPools);
    // console.log(`Added new UNI pool ${uniPoolTUP.address}`);
    //
    // await deployPool(
    //     deploy,
    //     deployer,
    //     admin,
    //     "LinkPool",
    //     "LinkPoolFactory",
    //     "LinkPoolTUP"
    // );
    //
    // embedCommitHash("LinkBorrowIndex", "./contracts/deployment/arbitrum");
    // embedCommitHash("LinkDepositIndex", "./contracts/deployment/arbitrum");
    //
    // await deployLinearIndex(
    //     "LinkBorrowIndex",
    //     "LinkPoolTUP",
    //     deploy,
    //     deployer,
    //     admin
    // );
    // await deployLinearIndex(
    //     "LinkDepositIndex",
    //     "LinkPoolTUP",
    //     deploy,
    //     deployer,
    //     admin
    // );
    //
    // embedCommitHash(
    //     "LinkVariableUtilisationRatesCalculator",
    //     "./contracts/deployment/arbitrum"
    // );
    //
    // result = await deploy("LinkVariableUtilisationRatesCalculator", {
    //     contract: "contracts/deployment/arbitrum/LinkVariableUtilisationRatesCalculator.sol:LinkVariableUtilisationRatesCalculator",
    //     from: deployer,
    //     gasLimit: 80000000,
    //     args: [],
    // });
    //
    // console.log(
    //     `Deployed LinkVariableUtilisationRatesCalculator at address: ${result.address}`
    // );
    //
    // await verifyContract(hre,
    //     {
    //         address: result.address,
    //         contract: `contracts/deployment/arbitrum/LinkVariableUtilisationRatesCalculator.sol:LinkVariableUtilisationRatesCalculator`,
    //         constructorArguments: []
    //     });
    // console.log(`Verified LinkVariableUtilisationRatesCalculator`);
    //
    // await initPool(
    //     deploy,
    //     deployer,
    //     "LinkVariableUtilisationRatesCalculator",
    //     "LinkPoolTUP",
    //     "LinkDepositIndexTUP",
    //     "LinkBorrowIndexTUP",
    //     TOKEN_ADDRESSES["LINK"]
    // );
    //
    // tokenManagerTUP = await ethers.getContract("TokenManagerTUP");
    // tokenManager = await ethers.getContractAt(
    //     "TokenManager",
    //     tokenManagerTUP.address
    // );
    //
    // const linkPoolTUP = await ethers.getContract("LinkPoolTUP");
    //
    // newLendingPools = [pool("LINK", linkPoolTUP.address)];
    //
    // await tokenManager.addPoolAssets(newLendingPools);
    // console.log(`Added new LINK pool ${linkPoolTUP.address}`);
};

async function deployPool(deploy, deployer, admin, contract, poolFactory, tup) {
    let result = await deploy(poolFactory, {
        contract: `contracts/deployment/arbitrum/${poolFactory}.sol:${poolFactory}`,
        from: deployer,
        gasLimit: 80000000,
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

module.exports.tags = ["arbitrum-non-stable-pools"];
