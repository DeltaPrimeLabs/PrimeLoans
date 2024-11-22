import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import SPrimeArtifact from "../../artifacts/contracts/token/sPrime.sol/SPrime.json";
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";
import { parseEther } from "viem";
import web3Abi from "web3-eth-abi";

// const spotUniform = {
//     deltaIds: Array.from({ length: 51 }, (_, i) => i - 25),
//     distributionX: [
//       0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
//       0.0196, 0.039216, 0.039216, 0.039216, 0.039216, 0.039216, 0.039216,
//       0.039216, 0.039216, 0.039216, 0.039216, 0.039216, 0.039216, 0.039216,
//       0.039216, 0.039216, 0.039216, 0.039216, 0.039216, 0.039216, 0.039216,
//       0.039216, 0.039216, 0.039216, 0.039216, 0.039216
//     ].map((el) => parseEther(`${el}`)),
//     distributionY: [
//       0.039216, 0.039216, 0.039216, 0.039216, 0.039216, 0.039216, 0.039216,
//       0.039216, 0.039216, 0.039216, 0.039216, 0.039216, 0.039216, 0.039216,
//       0.039216, 0.039216, 0.039216, 0.039216, 0.039216, 0.039216, 0.039216,
//       0.039216, 0.039216, 0.039216, 0.039216, 0.0196, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
//       0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
//     ].map((el) => parseEther(`${el}`))
// };

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    // const TJ_V2_ROUTER_ADDRESS = '0x18556DA13313f3532c54711497A8FedAC273220E';
    // const PRIME_ADDRESS = "0x33C8036E99082B0C395374832FECF70c42C7F298";
    // const WAVAX_ADDRESS = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7";

    // embedCommitHash("PositionManager", "./contracts/token/NonfungibleNFT");
    // let positionManager = await deploy("PositionManager", {
    //     from: deployer,
    //     gasLimit: 15000000,
    //     args: [],
    // });
    //
    //
    // console.log(
    //     `PositionManager deployed at address: ${positionManager.address}`
    // );
    // await verifyContract(hre,
    //     {
    //         address: positionManager.address,
    //         contract: `contracts/token/NonfungibleNFT/PositionManager.sol:PositionManager`,
    //         constructorArguments: []
    //     });
    // console.log(`Verified PositionManager`);


    embedCommitHash("sPrime", "./contracts/token");
    let sPrime = await deploy("SPrime", {
        from: deployer,
        gasLimit: 15000000,
        args: [],
    });

    
    console.log(
        `SPrime deployed at address: ${sPrime.address}`
    );

    await verifyContract(hre,
        {
            address: sPrime.address,
            contract: `contracts/token/sPrime.sol:SPrime`,
            constructorArguments: []
        });
    console.log(`Verified sPrime`);

    // const depositForm = [];
    // for(let i=0; i<spotUniform.distributionX.length; i++) {
    //     depositForm.push([
    //         spotUniform.deltaIds[i],
    //         spotUniform.distributionX[i],
    //         spotUniform.distributionY[i]
    //     ])
    // }
    //
    // const calldata = web3Abi.encodeFunctionCall(
    //     SPrimeArtifact.abi.find((method) => method.name === "initialize"),
    //     [PRIME_ADDRESS, WAVAX_ADDRESS, "PRIME-AVAX", depositForm, positionManager.address, TJ_V2_ROUTER_ADDRESS]
    //     // PRIME,  WAVAX, Name, depositForm, positionManasger, TJ V2 Address
    // );
    //
    // let deployedSPrimeTUP = await deploy("SPrimeUP", {
    //     from: deployer,
    //     gasLimit: 15000000,
    //     args: [sPrime.address, admin, calldata],
    //   });
    //
    //   const sPrimeTUP = await ethers.getContractAt(
    //     "SPrime",
    //     deployedSPrimeTUP.address
    //   );
    //
    //   console.log(
    //     `Deployed SPrimeUP at address: ${sPrimeTUP.address}`
    //   );

};

module.exports.tags = ["avalanche-sprime"];
