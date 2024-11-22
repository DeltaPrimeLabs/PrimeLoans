import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import vPrimeControllerArtifact from "../../artifacts/contracts/token/vPrimeControllerArbitrum.sol/vPrimeControllerArbitrum.json";
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";
import web3Abi from "web3-eth-abi";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("vPrimeControllerArbitrum", "./contracts/token");
    let vPrimeControllerArbitrum = await deploy("vPrimeControllerArbitrum", {
        from: deployer,
        gasLimit: 1000000000,
        args: [],
    });

    
    console.log(
        `vPrimeControllerArbitrum deployed at address: ${vPrimeControllerArbitrum.address}`
    );

    await verifyContract(hre,
        {
            address: vPrimeControllerArbitrum.address,
            contract: `contracts/token/vPrimeControllerArbitrum.sol:vPrimeControllerArbitrum`,
            constructorArguments: []
        });
    console.log(`Verified vPrimeControllerArbitrum`);

    const calldata = web3Abi.encodeFunctionCall(
        vPrimeControllerArtifact.abi.find((method) => method.name === "initialize"),
        [["0x83BE7c8768df4600E643d1a05734198709E505da"], "0x0a0D954d4b0F0b47a5990C0abd179A90fF74E255", "0x45E31148C3061c6Dc565Cf0E3379a75C5b4478B8"]
    );

    let deployedvPrimeControllerTUP = await deploy("vPrimeControllerUP", {
        from: deployer,
        gasLimit: 50000000,
        args: [vPrimeControllerArbitrum.address, "0x15066d6c882e63b33e12179DE4FceCdfCa93De1d", calldata],
      });
    
      const vPrimeControllerTUP = await ethers.getContractAt(
        "vPrimeControllerArbitrum",
        deployedvPrimeControllerTUP.address
      );
    
      console.log(
        `Deployed vPrimeControllerUP at address: ${vPrimeControllerTUP.address}`
      );

};

module.exports.tags = ["arbitrum-vprime-controller"];
