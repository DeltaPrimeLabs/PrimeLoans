import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import SPrimeArtifact from "../../artifacts/contracts/token/sPrime.sol/SPrime.json";
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";
import { parseEther } from "viem";
import web3Abi from "web3-eth-abi";

// const spotUniform = {
//     deltaIds: [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5],
//     distributionX: [
//       0, 0, 0, 0, 0, 0.090909, 0.181818, 0.181818, 0.181818, 0.181818, 0.181818
//     ].map((el) => parseEther(`${el}`)),
//     distributionY: [
//       0.181818, 0.181818, 0.181818, 0.181818, 0.181818, 0.090909, 0, 0, 0, 0, 0
//     ].map((el) => parseEther(`${el}`))
// };

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    // embedCommitHash("PositionManager", "./contracts/token/NonfungibleNFT");
    // let positionManager = await deploy("PositionManager", {
    //     from: deployer,
    //     gasLimit: 100000000,
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


    embedCommitHash("sPrimeUniswap", "./contracts/token");
    let sPrime = await deploy("sPrimeUniswap", {
        from: deployer,
        gasLimit: 100000000,
        args: [],
    });

    
    console.log(
        `sPrimeUniswap deployed at address: ${sPrime.address}`
    );

    // sleep 5 seconds
    await new Promise((resolve) => setTimeout(resolve, 5000));

    await verifyContract(hre,
        {
            address: sPrime.address,
            contract: `contracts/token/sPrimeUniswap.sol:sPrimeUniswap`,
            constructorArguments: []
        });
    console.log(`Verified sPrimeUniswap`);

    const sPrimeUniswapUPAddress = "0x04d36A9aAD2072C69E4B0Cb2A403D8a893064945";

    embedCommitHash("sPrimeUniswapImpl", "./contracts/token");
    const constructorArgs = [sPrimeUniswapUPAddress]
    let sPrimeImpl = await deploy("sPrimeUniswapImpl", {
        from: deployer,
        gasLimit: 100000000,
        args: constructorArgs,
    });


    console.log(
        `sPrimeUniswapImpl deployed at address: ${sPrimeImpl.address}`
    );

    // sleep 5 seconds
    await new Promise((resolve) => setTimeout(resolve, 5000));

    await verifyContract(hre,
        {
            address: sPrimeImpl.address,
            contract: `contracts/token/sPrimeUniswapImpl.sol:sPrimeUniswapImpl`,
            constructorArguments: constructorArgs
        });
    console.log(`Verified sPrimeUniswapImpl`);

    // const calldata = web3Abi.encodeFunctionCall(
    //     SPrimeArtifact.abi.find((method) => method.name === "initialize"),
    //     ["0x944d29Db15E704DC1D358083598E27F466cb27FE", "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", "PRIME-USDC", spotUniform.distributionX, spotUniform.distributionY, spotUniform.deltaIds, positionManager.address]
    // );
    //
    // let deployedSPrimeTUP = await deploy("SPrimeUP", {
    //     from: deployer,
    //     gasLimit: 50000000,
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

module.exports.tags = ["arbitrum-sprime"];
