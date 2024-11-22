import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";
import fs from "fs";
const util = require('util');
const readFileAsync = util.promisify(fs.readFile);


async function readJsonFile(filename) {
    try {
        // Read the JSON file asynchronously
        const data = await readFileAsync(filename, 'utf8');
        return JSON.parse(data);
    } catch (error) {}
}

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("PrimeVesting", "./contracts");

    let participants = await readJsonFile('deploy/avalanche/data/primeVesting2.json');

    const participantsAddresses = participants.map(participant => participant.walletAddress);
    const vestingInfos = participants.map(participant => {
        return {
            cliffPeriod: participant.cliffInSeconds,
            vestingPeriod: participant.vestingInSeconds,
            grantClaimRightTo: participant.grantClaimRightTo === null ? ethers.constants.AddressZero : participant.grantClaimRightTo,
            totalAmount: ethers.utils.parseEther(participant.primeAmount.toFixed(18).toString())
        };
    });

    const PRIME_TOKEN_ADDRESS_AVALANCHE = "0x33C8036E99082B0C395374832FECF70c42C7F298";
    const START_TIME = 1719946800; // 2024-07-02 21:00:00 CET
    const _args = [
        PRIME_TOKEN_ADDRESS_AVALANCHE,
        START_TIME
    ]

    let PrimeVesting = await deploy("PrimeVesting", {
        from: deployer,
        gasLimit: 15000000,
        args: _args,
    });


    console.log(
        `PrimeVesting implementation deployed at address: ${PrimeVesting.address}`
    );

    // sleep 10 seconds
    await new Promise(r => setTimeout(r, 10000));

    await verifyContract(hre,
        {
            address: PrimeVesting.address,
            contract: `contracts/PrimeVesting.sol:PrimeVesting`,
            constructorArguments: _args
        });
    console.log(`Verified PrimeVesting`);


    let primeVestingContract = new ethers.Contract(PrimeVesting.address, (await hre.artifacts.readArtifact("PrimeVesting")).abi, hre.ethers.provider.getSigner(deployer));

    const batchSize = 200;
    const useBatch = true;

    if(useBatch) {
        for (let i = 0; i < vestingInfos.length; i += batchSize) {
            const batch = vestingInfos.slice(i, i + batchSize);
            const isLastBatch = i + batchSize >= vestingInfos.length;
            console.log(`Initializing vesting contract with participants from ${i} to ${i + batch.length - 1}`);
            await primeVestingContract.initializeVesting(participantsAddresses.slice(i, i + batchSize), batch, isLastBatch);
            // sleep 10 seconds
            await new Promise(r => setTimeout(r, 10000));
        }
        console.log(`Vesting contract initialized`);
    } else {
        console.log(`Initializing vesting contract with all participants`);
        await primeVestingContract.initializeVesting(participantsAddresses, vestingInfos, true);
        console.log(`Vesting contract initialized`);
    }

};

module.exports.tags = ["avalanche-prime-vesting"];
