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
    const smartLoansFactoryTUP = "0x3Ea9D480295A73fd2aF95b4D96c2afF88b21B03D";

    embedCommitHash("vPrime", "./contracts/token");
    let vPrime = await deploy("vPrime", {
        from: deployer,
        gasLimit: 15000000,
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
        [smartLoansFactoryTUP]
    );

    let deployedvPrimeTUP = await deploy("vPrimeUP", {
        from: deployer,
        gasLimit: 15000000,
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

module.exports.tags = ["avalanche-vprime"];
