import {embedCommitHash} from "../../tools/scripts/embed-commit-hash";

const {ethers} = require("hardhat");
import hre from 'hardhat'
const networkName = hre.network.name
import createMigrationFile from "../../tools/scripts/create-migration-file"
import verifyContract from "../../tools/scripts/verify-contract";

module.exports = async ({
  getNamedAccounts,
  deployments
  }) => {
  const {deploy} = deployments;
  const {deployer, admin} = await getNamedAccounts();

  embedCommitHash('Pool', './contracts');
  embedCommitHash('WrappedNativeTokenPool', './contracts');

  embedCommitHash('WavaxPool', './contracts/deployment/avalanche');
  embedCommitHash('WavaxPoolFactory', './contracts/deployment/avalanche');
  embedCommitHash('WavaxPoolTUP', './contracts/proxies/tup/avalanche');

  embedCommitHash('UsdcPool', './contracts/deployment/avalanche');
  embedCommitHash('UsdcPoolFactory', './contracts/deployment/avalanche');
  embedCommitHash('UsdcPoolTUP', './contracts/proxies/tup/avalanche');

  await deployPool(deploy, deployer, admin, 'WavaxPool', 'WavaxPoolFactory', 'WavaxPoolTUP');
  await deployPool(deploy, deployer, admin, 'UsdcPool', 'UsdcPoolFactory', 'UsdcPoolTUP');
};

async function deployPool(deploy, deployer, admin, contract, poolFactory, tup) {
  await deploy(poolFactory, {
    from: deployer,
    gasLimit: 8000000,
    args: []
  });

  const factory = await ethers.getContract(poolFactory);


  const tx = await factory.deployPool();
  const receipt = await tx.wait();
  let poolAddress = receipt.events[0].args[1];

  console.log(`${contract} pool deployed at address: ${poolAddress} by a factory`);

  createMigrationFile(networkName, contract, poolAddress, receipt.transactionHash);

  let result = await deploy(tup, {
    from: deployer,
    gasLimit: 8000000,
    args: [poolAddress, admin, []],
  });

  console.log(`${tup} deployed at address: ${result.address}`);
}

module.exports.tags = ['avalanche'];
