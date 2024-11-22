import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";
import web3Abi from "web3-eth-abi";
import AddressProviderArtifact from "../../artifacts/contracts/AddressProvider.sol/AddressProvider.json";

const { ethers } = require("hardhat");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer, admin } = await getNamedAccounts();

  embedCommitHash("AddressProvider");

  await deploy("AddressProvider", {
    from: deployer,
    gasLimit: 50000000,
    args: [],
  });

  let addressProvider = await ethers.getContract("AddressProvider");

  console.log(`Deployed addressProvider at address: ${addressProvider.address}`);

  const calldata = web3Abi.encodeFunctionCall(
    AddressProviderArtifact.abi.find((method) => method.name === "initialize"),
    []
  );

  let deployedAddressProviderTUP = await deploy("AddressProviderTUP", {
    from: deployer,
    gasLimit: 50000000,
    args: [addressProvider.address, admin, calldata],
  });

  const addressProviderTUP = await ethers.getContractAt(
    "AddressProvider",
    deployedAddressProviderTUP.address
  );

  console.log(
    `Deployed AddressProviderTUP at address: ${addressProviderTUP.address}`
  );
};

module.exports.tags = ["arbitrum-x4"];
