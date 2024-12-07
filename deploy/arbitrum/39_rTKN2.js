import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();
    const MULTISIG_OWNER = "0xDfA6706FC583b635CD6daF0E3915901A2fBaBAaD"
    const MULTISIG_ADMIN = "0xa9Ca8462aB2949ADa86297904e09Ab4Eb12cdCf0"

    embedCommitHash("rToken2", "./contracts");

    let RTKNDP2 = await deploy("RTKNDP2", {
        from: deployer,
        args: [],
    });


    console.log(
        `RTKNDP2 implementation deployed at address: ${RTKNDP2.address}`
    );

    await verifyContract(hre,
        {
            address: RTKNDP2.address,
            contract: `contracts/rToken2.sol:RTKNDP2`,
            constructorArguments: []
        });
    console.log(`Verified RTKNDP2`);

    let resultTUP = await deploy(`RTKNTUP2`, {
        contract: `contracts/proxies/tup/arbitrum/rTKNTUP2.sol:RTKNTUP2`,
        from: deployer,
        args: [RTKNDP2.address, MULTISIG_ADMIN, []],
    });

    console.log(`rTKNTUP2 deployed at address: ${resultTUP.address}`);

    await verifyContract(hre,
        {
            address: resultTUP.address,
            contract: `contracts/proxies/tup/arbitrum/rTKNTUP2.sol:RTKNTUP2`,
            constructorArguments: [RTKNDP2.address, MULTISIG_ADMIN, []]
        });
    console.log(`Verified rTKNTUP2.sol`)
};

module.exports.tags = ["arbitrum-rTKN2"];
