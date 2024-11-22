import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("YieldYakWombatFacet", "./contracts/facets/avalanche");

    let YieldYakWombatFacet = await deploy("YieldYakWombatFacet", {
        from: deployer,
        gasLimit: 8000000,
        args: [],
    });


    console.log(
        `YieldYakWombatFacet implementation deployed at address: ${YieldYakWombatFacet.address}`
    );

    // Wait 10 seconds for the transaction to be mined
    await new Promise((r) => setTimeout(r, 10000));

    await verifyContract(hre,
        {
            address: YieldYakWombatFacet.address,
            contract: `contracts/facets/avalanche/YieldYakWombatFacet.sol:YieldYakWombatFacet`,
            constructorArguments: []
        });
    console.log(`Verified YieldYakWombatFacet`);
};

module.exports.tags = ["avalanche-yy-wombat-facet"];
