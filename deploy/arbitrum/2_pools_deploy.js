import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import hre from "hardhat";
const networkName = hre.network.name;
import createMigrationFile from "../../tools/scripts/create-migration-file";

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer, admin } = await getNamedAccounts();

  embedCommitHash("Pool", "./contracts");
  embedCommitHash("WrappedNativeTokenPool", "./contracts");

  embedCommitHash("WethPool", "./contracts/deployment/arbitrum");
  embedCommitHash("WethPoolFactory", "./contracts/deployment/arbitrum");
  embedCommitHash("WethPoolTUP", "./contracts/proxies/tup/arbitrum");

  embedCommitHash("UsdcPool", "./contracts/deployment/arbitrum");
  embedCommitHash("UsdcPoolFactory", "./contracts/deployment/arbitrum");
  embedCommitHash("UsdcPoolTUP", "./contracts/proxies/tup/arbitrum");

  await deployPool(
    deploy,
    deployer,
    admin,
    "WethPool",
    "WethPoolFactory",
    "WethPoolTUP"
  );
  await deployPool(
    deploy,
    deployer,
    admin,
    "UsdcPool",
    "UsdcPoolFactory",
    "UsdcPoolTUP"
  );
};

async function deployPool(deploy, deployer, admin, contract, poolFactory, tup) {
  await deploy(poolFactory, {
    contract: `contracts/deployment/arbitrum/${poolFactory}.sol:${poolFactory}`,
    from: deployer,
    gasLimit: 50000000,
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
    gasLimit: 80000000,
    args: [poolAddress, admin, []],
  });

  console.log(`${tup} deployed at address: ${result.address}`);
}

module.exports.tags = ["arbitrum-x2"];
