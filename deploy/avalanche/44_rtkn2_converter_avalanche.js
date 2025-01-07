import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import rTknConverterArtifact from "../../artifacts/contracts/token/RtknToPrimeConverter.sol/RtknToPrimeConverter.json";
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";
import web3Abi from "web3-eth-abi";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    // embedCommitHash("RtknToPrimeConverter", "./contracts/token");

    // DEPLOY RtknToPrimeConverter

    const AVALANCHE_OWNER_MULTISIG = "0x44AfCcF712E8A097a6727B48b57c75d7A85a9B0c";
    const AVALANCHE_ADMIN_MULTISIG = "0x6855A3cA53cB01646A9a3e6d1BC30696499C0b4a";

    let RtknToPrimeConverter = await deploy("RtknToPrimeConverter", {
        from: deployer,
        args: [],
    });


    console.log(
        `RtknToPrimeConverter deployed at address: ${RtknToPrimeConverter.address}`
    );

    await verifyContract(hre,
        {
            address: "0x025faeba8a2A25293F43F079E2Caa099D018F05D",
            contract: `contracts/token/RtknToPrimeConverter.sol:RtknToPrimeConverter`
        });
    console.log(`Verified RtknToPrimeConverter`);


    // DEPLOY rTknConverterTUP

    const rTKN2AvalancheAddress = "0x0E31136cD6742B4656eD46E28306080620eD70a7";
    const rTKN2AvalancheMaxCap = "1"; // We will update this value before going into the Phase 2

    console.log('1')
    const calldata = web3Abi.encodeFunctionCall(
        rTknConverterArtifact.abi.find((method) => method.name === "initialize"),
        [rTKN2AvalancheAddress, ethers.utils.parseEther(rTKN2AvalancheMaxCap), AVALANCHE_OWNER_MULTISIG]
    );
    console.log('2')

    let rTknConverterTUP = await deploy("rTknConverterTUP", {
        from: deployer,
        contract: "contracts/proxies/tup/avalanche/rTknConverterTUP.sol:rTknConverterTUP",
        args: [RtknToPrimeConverter.address, AVALANCHE_ADMIN_MULTISIG, calldata],
    });

    console.log(
        `Deployed rTknConverterTUP at ddress: ${rTknConverterTUP.address}`
    );

    await new Promise(resolve => setTimeout(resolve, 15000));

    await verifyContract(hre,
        {
            address: rTknConverterTUP.address,
            contract: `contracts/proxies/tup/avalanche/rTknConverterTUP.sol:rTknConverterTUP`,
            constructorArguments: [RtknToPrimeConverter.address, AVALANCHE_ADMIN_MULTISIG, calldata]
        });

};

module.exports.tags = ["avalanche-rtkn2-converter"];
