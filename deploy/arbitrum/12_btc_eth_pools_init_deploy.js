import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import hre from "hardhat";
const networkName = hre.network.name;
import createMigrationFile from "../../tools/scripts/create-migration-file";
import { deployLinearIndex } from "./7_linear_indices";
import TOKEN_ADDRESSES from "../../common/addresses/arbitrum/token_addresses.json";
import { initPool } from "./8_pools_init";
import { pool } from "../../test/_helpers";
import verifyContract from "../../tools/scripts/verify-contract";

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer, admin } = await getNamedAccounts();

  embedCommitHash("Pool", "./contracts");

  embedCommitHash("BtcPool", "./contracts/deployment/arbitrum");
  embedCommitHash("BtcPoolFactory", "./contracts/deployment/arbitrum");
  embedCommitHash("BtcPoolTUP", "./contracts/proxies/tup/arbitrum");

  await deployPool(
    deploy,
    deployer,
    admin,
    "BtcPool",
    "BtcPoolFactory",
    "BtcPoolTUP"
  );

  embedCommitHash("BtcBorrowIndex", "./contracts/deployment/arbitrum");
  embedCommitHash("BtcDepositIndex", "./contracts/deployment/arbitrum");

  await deployLinearIndex(
    "BtcBorrowIndex",
    "BtcPoolTUP",
    deploy,
    deployer,
    admin
  );
  await deployLinearIndex(
    "BtcDepositIndex",
    "BtcPoolTUP",
    deploy,
    deployer,
    admin
  );

  embedCommitHash(
    "BtcVariableUtilisationRatesCalculator",
    "./contracts/deployment/arbitrum"
  );

  let result = await deploy("BtcVariableUtilisationRatesCalculator", {
    contract:
      "contracts/deployment/arbitrum/BtcVariableUtilisationRatesCalculator.sol:BtcVariableUtilisationRatesCalculator",
    from: deployer,
    gasLimit: 8000000,
    args: [],
  });

  console.log(
    `Deployed BtcVariableUtilisationRatesCalculator at address: ${result.address}`
  );

  await initPool(
    deploy,
    deployer,
    "BtcVariableUtilisationRatesCalculator",
    "BtcPoolTUP",
    "BtcDepositIndexTUP",
    "BtcBorrowIndexTUP",
    TOKEN_ADDRESSES["BTC"]
  );

  const tokenManagerTUP = await ethers.getContract("TokenManagerTUP");
  const tokenManager = await ethers.getContractAt(
    "TokenManager",
    tokenManagerTUP.address
  );

  const btcPoolTUP = await ethers.getContract("BtcPoolTUP");

  let newLendingPools = [
    pool("BTC", btcPoolTUP.address),
  ];

  await tokenManager.addPoolAssets(newLendingPools);
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

module.exports.tags = ["arbitrum-btc"];
