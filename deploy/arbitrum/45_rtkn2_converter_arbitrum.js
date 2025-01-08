import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import rTknConverterArtifact from "../../artifacts/contracts/token/RtknToPrimeConverter.sol/RtknToPrimeConverter.json";
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";
import web3Abi from "web3-eth-abi";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("RtknToPrimeConverter", "./contracts/token");

    // DEPLOY RtknToPrimeConverter

    const ARBITRUM_OWNER_MULTISIG = "0xDfA6706FC583b635CD6daF0E3915901A2fBaBAaD";
    const ARBITRUM_ADMIN_MULTISIG = "0xa9Ca8462aB2949ADa86297904e09Ab4Eb12cdCf0";

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

    const rTKN2ArbitrumAddress = "0x47f655e3B4D0b686D26FBAD9C6378f66D6388af7";
    const rTKN2ArbitrumMaxCap = "1"; // We will update this value before going into the Phase 2

    const calldata = web3Abi.encodeFunctionCall(
        rTknConverterArtifact.abi.find((method) => method.name === "initialize"),
        [rTKN2ArbitrumAddress, ethers.utils.parseEther(rTKN2ArbitrumMaxCap), ARBITRUM_OWNER_MULTISIG]
    );

    let rTknConverterTUP = await deploy("rTknConverterTUP", {
        from: deployer,
        contract: "contracts/proxies/tup/arbitrum/rTknConverterTUP.sol:rTknConverterTUP",
        args: [RtknToPrimeConverter.address, ARBITRUM_ADMIN_MULTISIG, calldata],
    });

    console.log(
        `Deployed rTknConverterTUP at ddress: ${rTknConverterTUP.address}`
    );

    await verifyContract(hre,
        {
            address: rTknConverterTUP.address,
            contract: `contracts/proxies/tup/arbitrum/rTknConverterTUP.sol:rTknConverterTUP`,
            constructorArguments: [RtknToPrimeConverter.address, ARBITRUM_ADMIN_MULTISIG, calldata]
        });

};

module.exports.tags = ["arbitrum-rtkn2-converter"];
