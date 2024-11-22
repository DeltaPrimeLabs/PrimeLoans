import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import vPrimeArtifact from "../../artifacts/contracts/token/vPrime.sol/vPrime.json";
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";
import { parseEther } from "viem";
import web3Abi from "web3-eth-abi";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();
    const smartLoansFactoryTUP = await ethers.getContract("SmartLoansFactoryTUP");

    embedCommitHash("vPrime", "./contracts/token");
    let vPrime = await deploy("vPrime", {
        from: deployer,
        gasLimit: 100000000,
        args: [],
    });

    
    console.log(
        `vPrime deployed at address: ${vPrime.address}`
    );

    await verifyContract(hre,
        {
            address: vPrime.address,
            contract: `contracts/token/vPrime.sol:vPrime`,
            constructorArguments: []
        });
    console.log(`Verified vPrime`);

    const calldata = web3Abi.encodeFunctionCall(
        vPrimeArtifact.abi.find((method) => method.name === "initialize"),
        [smartLoansFactoryTUP.address]
    );

    let deployedvPrimeTUP = await deploy("vPrimeUP", {
        from: deployer,
        gasLimit: 50000000,
        args: [vPrime.address, admin, calldata],
      });
    
      const vPrimeTUP = await ethers.getContractAt(
        "vPrime",
        deployedvPrimeTUP.address
      );
    
      console.log(
        `Deployed vPrimeUP at address: ${vPrimeTUP.address}`
      );

};

module.exports.tags = ["arbitrum-vprime"];
