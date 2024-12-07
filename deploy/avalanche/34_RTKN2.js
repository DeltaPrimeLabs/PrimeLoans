import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();
    const MULTISIG_OWNER = "0x44AfCcF712E8A097a6727B48b57c75d7A85a9B0c"
    const MULTISIG_ADMIN = "0x6855A3cA53cB01646A9a3e6d1BC30696499C0b4a"

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
        contract: `contracts/proxies/tup/avalanche/rTKNTUP2.sol:RTKNTUP2`,
        from: deployer,
        args: [RTKNDP2.address, MULTISIG_ADMIN, []],
    });

    console.log(`rTKNTUP2 deployed at address: ${resultTUP.address}`);

    await verifyContract(hre,
        {
            address: resultTUP.address,
            contract: `contracts/proxies/tup/avalanche/rTKNTUP2.sol:RTKNTUP2`,
            constructorArguments: [RTKNDP2.address, MULTISIG_ADMIN, []]
        });
    console.log(`Verified rTKNTUP2.sol`)
};

module.exports.tags = ["avalanche-rTKN2"];
