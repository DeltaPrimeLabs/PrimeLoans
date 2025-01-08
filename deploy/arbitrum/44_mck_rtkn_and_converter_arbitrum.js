import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import rTknConverterArtifact from "../../artifacts/contracts/token/RtknToPrimeConverter.sol/RtknToPrimeConverter.json";
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";
import web3Abi from "web3-eth-abi";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("ERC20Mock", "./contracts/token");
    embedCommitHash("RtknToPrimeConverter", "./contracts/token");

    // DEPLOY ERC20Mock
    //
    // let ERC20Mock = await deploy("ERC20Mock", {
    //     from: deployer,
    //     args: [
    //         "mock rTKN",
    //         "mckRTKN",
    //         "0x2393D94fF8E170E2ebe6110b78a21513f787f5d8",
    //         ethers.utils.parseEther("1000")
    //     ],
    // });
    //
    //
    // console.log(
    //     `ERC20Mock deployed at address: ${ERC20Mock.address}`
    // );
    //
    // await verifyContract(hre,
    //     {
    //         address: ERC20Mock.address,
    //         contract: `contracts/token/ERC20Mock.sol:ERC20Mock`,
    //         constructorArguments: [
    //             "mock rTKN",
    //             "mckRTKN",
    //             "0x2393D94fF8E170E2ebe6110b78a21513f787f5d8",
    //             ethers.utils.parseEther("1000")
    //         ]
    //     });
    // console.log(`Verified ERC20Mock`);

    // DEPLOY RtknToPrimeConverter

    let RtknToPrimeConverter = await deploy("RtknToPrimeConverter", {
        from: deployer,
        args: [],
    });


    console.log(
        `RtknToPrimeConverter deployed at address: ${RtknToPrimeConverter.address}`
    );

    await verifyContract(hre,
        {
            address: RtknToPrimeConverter.address,
            contract: `contracts/token/RtknToPrimeConverter.sol:RtknToPrimeConverter`
        });
    console.log(`Verified RtknToPrimeConverter`);


    // DEPLOY rTknConverterTUP

    const rTKNAddress = "0xF3EaA614dAb459FD4E9f4BC5460BD9b965ed6c76";

    const calldata = web3Abi.encodeFunctionCall(
        rTknConverterArtifact.abi.find((method) => method.name === "initialize"),
        [rTKNAddress, ethers.utils.parseEther("1723766")]
    );

    let rTknConverterTUP = await deploy("rTknConverterTUP", {
        from: deployer,
        gasLimit: 50000000,
        args: [RtknToPrimeConverter.address, "0xa9Ca8462aB2949ADa86297904e09Ab4Eb12cdCf0", calldata],
      });

      console.log(
        `Deployed rTknConverterTUP at ddress: ${rTknConverterTUP.address}`
      );

    await verifyContract(hre,
        {
            address: rTknConverterTUP.address,
            contract: `contracts/proxies/tup/arbitrum/rTknConverterTUP.sol:rTknConverterTUP`,
            constructorArguments: [RtknToPrimeConverter.address, "0xa9Ca8462aB2949ADa86297904e09Ab4Eb12cdCf0", calldata]
        });

};

module.exports.tags = ["arbitrum-rtkn-converter"];
