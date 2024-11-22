import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import vPrimeControllerArtifact from "../../artifacts/contracts/token/vPrimeControllerAvalanche.sol/vPrimeControllerAvalanche.json";
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";
import web3Abi from "web3-eth-abi";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("vPrimeControllerAvalanche", "./contracts/token");
    let vPrimeControllerAvalanche = await deploy("vPrimeControllerAvalanche", {
        from: deployer,
        gasLimit: 15000000,
        args: [],
    });

    
    console.log(
        `vPrimeControllerAvalanche deployed at address: ${vPrimeControllerAvalanche.address}`
    );

    await verifyContract(hre,
        {
            address: vPrimeControllerAvalanche.address,
            contract: `contracts/token/vPrimeControllerAvalanche.sol:vPrimeControllerAvalanche`,
            constructorArguments: []
        });
    console.log(`Verified vPrimeControllerAvalanche`);

    const calldata = web3Abi.encodeFunctionCall(
        vPrimeControllerArtifact.abi.find((method) => method.name === "initialize"),
        [["0xd38C5cEca20Fb43503E108ed8d4CaCA5B57E730E"], "0xF3978209B7cfF2b90100C6F87CEC77dE928Ed58e", "0x228a19fC13932C67D538fEba858359E369e5a197", false]
        // [sPrimeContracts], tokenManager, vPrime, useOracleFeed
    );

    let deployedvPrimeControllerTUP = await deploy("vPrimeControllerUP", {
        from: deployer,
        gasLimit: 15000000,
        args: [vPrimeControllerAvalanche.address, admin, calldata],
      });
    
      const vPrimeControllerTUP = await ethers.getContractAt(
        "vPrimeControllerAvalanche",
        deployedvPrimeControllerTUP.address
      );
    
      console.log(
        `Deployed vPrimeControllerUP at address: ${vPrimeControllerTUP.address}`
      );

};

module.exports.tags = ["avalanche-vprime-controller"];
