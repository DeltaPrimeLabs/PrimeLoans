import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";
import { pool, toWei } from "../../test/_helpers";
import web3Abi from "web3-eth-abi";
import TokenManagerArtifact from "../../artifacts/contracts/TokenManager.sol/TokenManager.json";
import { supportedAssetsArb } from "../../common/addresses/arbitrum/arbitrum_supported_assets";
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

const { ethers } = require("hardhat");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer, admin } = await getNamedAccounts();

  embedCommitHash("TokenManager");

  const wethPoolTUP = await ethers.getContract("WethPoolTUP");
  const usdcPoolTUP = await ethers.getContract("UsdcPoolTUP");

  let lendingPools = [
    pool("ETH", wethPoolTUP.address),
    pool("USDC", usdcPoolTUP.address),
  ];

  await deploy("TokenManager", {
    from: deployer,
    gasLimit: 50000000,
    args: [],
  });



  let tokenManager = await ethers.getContract("TokenManager");

  console.log(`Deployed tokenManager at address: ${tokenManager.address}`);

  await verifyContract(hre, {
    address: tokenManager.address,
    contract: "contracts/TokenManager.sol:TokenManager"
  })

  console.log('Verified.')

  const calldata = web3Abi.encodeFunctionCall(
    TokenManagerArtifact.abi.find((method) => method.name === "initialize"),
    [supportedAssetsArb, lendingPools]
  );

  let deployedTokenManagerTUP = await deploy("TokenManagerTUP", {
    from: deployer,
    gasLimit: 50000000,
    args: [tokenManager.address, admin, calldata],
  });

  const tokenManagerTUP = await ethers.getContractAt(
    "TokenManager",
    deployedTokenManagerTUP.address
  );

  console.log(
    `Deployed TokenManagerTUP at address: ${tokenManagerTUP.address}`
  );
};

module.exports.tags = ["arbitrum-x3"];
