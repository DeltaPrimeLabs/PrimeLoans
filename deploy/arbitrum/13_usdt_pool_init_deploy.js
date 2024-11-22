import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import hre from "hardhat";
const networkName = hre.network.name;
import createMigrationFile from "../../tools/scripts/create-migration-file";
import { deployLinearIndex } from "./7_linear_indices";
import TOKEN_ADDRESSES from "../../common/addresses/arbitrum/token_addresses.json";
import { initPool } from "./8_pools_init";
import { pool, toBytes32 } from "../../test/_helpers";

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer, admin } = await getNamedAccounts();

  embedCommitHash("Pool", "./contracts");

  embedCommitHash("UsdtPool", "./contracts/deployment/arbitrum");
  embedCommitHash("UsdtPoolFactory", "./contracts/deployment/arbitrum");
  embedCommitHash("UsdtPoolTUP", "./contracts/proxies/tup/arbitrum");

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

  const result = await deploy("UsdtVariableUtilisationRatesCalculator", {
    contract: "contracts/deployment/arbitrum/UsdtVariableUtilisationRatesCalculator.sol:UsdtVariableUtilisationRatesCalculator",
    from: deployer,
    gasLimit: 8000000,
    args: [],
  });

  console.log(
    `Deployed UsdtVariableUtilisationRatesCalculator at address: ${result.address}`
  );

  await initPool(
    deploy,
    deployer,
    "UsdtVariableUtilisationRatesCalculator",
    "UsdtPoolTUP",
    "UsdtDepositIndexTUP",
    "UsdtBorrowIndexTUP",
    TOKEN_ADDRESSES["USDT"]
  );

  const tokenManagerTUP = await ethers.getContract("TokenManagerTUP");
  const tokenManager = await ethers.getContractAt(
    "TokenManager",
    tokenManagerTUP.address
  );

  const usdtPoolTUP = await ethers.getContract("UsdtPoolTUP");

  let newLendingPools = [pool("USDT", usdtPoolTUP.address)];

  await tokenManager.addPoolAssets(newLendingPools);
  console.log(`Added new USDT pool ${usdtPoolTUP.address}`);
};

async function deployPool(deploy, deployer, admin, contract, poolFactory, tup) {
  await deploy(poolFactory, {
    contract: `contracts/deployment/arbitrum/${poolFactory}.sol:${poolFactory}`,
    from: deployer,
    gasLimit: 8000000,
    args: [],
  });

  const factory = await ethers.getContract(poolFactory);

  const tx = await factory.deployPool();
  const receipt = await tx.wait();
  let poolAddress = receipt.events[0].args[1];

  console.log(
    `${contract} pool deployed at address: ${poolAddress} by a factory`
  );

  createMigrationFile(
    networkName,
    contract,
    poolAddress,
    receipt.transactionHash
  );

  let result = await deploy(tup, {
    contract: `contracts/proxies/tup/arbitrum/${tup}.sol:${tup}`,
    from: deployer,
    gasLimit: 8000000,
    args: [poolAddress, admin, []],
  });

  console.log(`${tup} deployed at address: ${result.address}`);
}

module.exports.tags = ["arbitrum-3"];
