import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();
    const MULTISIG_OWNER = "0xDfA6706FC583b635CD6daF0E3915901A2fBaBAaD"
    const MULTISIG_ADMIN = "0xa9Ca8462aB2949ADa86297904e09Ab4Eb12cdCf0"

    embedCommitHash("rToken", "./contracts");

    let RTKNDP = await deploy("RTKNDP", {
        from: deployer,
        gasLimit: 100000000,
        args: [],
    });


    console.log(
        `RTKNDP implementation deployed at address: ${RTKNDP.address}`
    );

    await verifyContract(hre,
        {
            address: "0xF27f8B5F37671a32a45581F17f83cEE439dD2Af2",
            contract: `contracts/rToken.sol:RTKNDP`,
            constructorArguments: []
        });
    console.log(`Verified RTKNDP`);

    let resultTUP = await deploy(`RTKNTUP`, {
        contract: `contracts/proxies/tup/arbitrum/rTKNTUP.sol:RTKNTUP`,
        from: deployer,
        gasLimit: 50000000,
        args: [RTKNDP.address, MULTISIG_ADMIN, []],
    });

    console.log(`rTKNTUP deployed at address: ${resultTUP.address}`);

    await verifyContract(hre,
        {
            address: resultTUP.address,
            contract: `contracts/proxies/tup/arbitrum/rTKNTUP.sol:RTKNTUP`,
            constructorArguments: [RTKNDP.address, MULTISIG_ADMIN, []]
        });
    console.log(`Verified rTKNTUP.sol`)
};

module.exports.tags = ["arbitrum-rTKN"];
