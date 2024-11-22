import {embedCommitHash} from "../../tools/scripts/embed-commit-hash";

const {ethers} = require("hardhat");
import hre from 'hardhat'
const networkName = hre.network.name
import createMigrationFile from "../../tools/scripts/create-migration-file"
import {deployLinearIndex} from "./7_linear_indices";
import TOKEN_ADDRESSES from "../../common/addresses/avax/token_addresses.json";
import {initPool} from "./8_pools_init";
import {pool} from "../../test/_helpers";

module.exports = async ({
  getNamedAccounts,
  deployments
  }) => {
  const {deploy} = deployments;
  const {deployer, admin} = await getNamedAccounts();

  embedCommitHash('Pool', './contracts');

  embedCommitHash('EthPool', './contracts/deployment/avalanche');
  embedCommitHash('EthPoolFactory', './contracts/deployment/avalanche');
  embedCommitHash('EthPoolTUP', './contracts/proxies/tup/avalanche');

  embedCommitHash('BtcPool', './contracts/deployment/avalanche');
  embedCommitHash('BtcPoolFactory', './contracts/deployment/avalanche');
  embedCommitHash('BtcPoolTUP', './contracts/proxies/tup/avalanche');

  await deployPool(deploy, deployer, admin, 'EthPool', 'EthPoolFactory', 'EthPoolTUP');
  await deployPool(deploy, deployer, admin, 'BtcPool', 'BtcPoolFactory', 'BtcPoolTUP');

  embedCommitHash('EthBorrowIndex', './contracts/deployment/avalanche');
  embedCommitHash('EthDepositIndex', './contracts/deployment/avalanche');
  embedCommitHash('BtcBorrowIndex', './contracts/deployment/avalanche');
  embedCommitHash('BtcDepositIndex', './contracts/deployment/avalanche');

  await deployLinearIndex("EthBorrowIndex", "EthPoolTUP", deploy, deployer, admin);
  await deployLinearIndex("EthDepositIndex", "EthPoolTUP", deploy, deployer, admin);
  await deployLinearIndex("BtcBorrowIndex", "BtcPoolTUP", deploy, deployer, admin);
  await deployLinearIndex("BtcDepositIndex", "BtcPoolTUP", deploy, deployer, admin);

  embedCommitHash('EthVariableUtilisationRatesCalculator', './contracts/deployment/avalanche');

  let result = await deploy('EthVariableUtilisationRatesCalculator', {
    from: deployer,
    gasLimit: 8000000,
    args: []
  });

  console.log(`Deployed EthVariableUtilisationRatesCalculator at address: ${result.address}`);

  embedCommitHash('BtcVariableUtilisationRatesCalculator', './contracts/deployment/avalanche');

  result = await deploy('BtcVariableUtilisationRatesCalculator', {
    from: deployer,
    gasLimit: 8000000,
    args: []
  });

  console.log(`Deployed BtcVariableUtilisationRatesCalculator at address: ${result.address}`);

  await initPool(deploy, deployer, "EthVariableUtilisationRatesCalculator", "EthPoolTUP", "EthDepositIndexTUP", "EthBorrowIndexTUP", TOKEN_ADDRESSES['ETH']);
  await initPool(deploy, deployer, "BtcVariableUtilisationRatesCalculator", "BtcPoolTUP", "BtcDepositIndexTUP", "BtcBorrowIndexTUP", TOKEN_ADDRESSES['BTC']);

  const tokenManagerTUP = await ethers.getContract("TokenManagerTUP");
  const tokenManager = await ethers.getContractAt("TokenManager", tokenManagerTUP.address);


  const btcPoolTUP = await ethers.getContract("BtcPoolTUP");
  const ethPoolTUP = await ethers.getContract("EthPoolTUP");

  let newLendingPools = [
    pool("BTC", btcPoolTUP.address),
    pool("ETH", ethPoolTUP.address)
  ];

  await tokenManager.addPoolAssets(newLendingPools);
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

module.exports.tags = ['btc-eth-pool'];
