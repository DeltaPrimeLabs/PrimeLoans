import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("HealthMeterFacetProd", "./contracts/facets");

    let HealthMeterFacetProd = await deploy("HealthMeterFacetProd", {
        from: deployer,
        gasLimit: 15000000,
        args: [],
    });


    console.log(
        `HealthMeterFacetProd implementation deployed at address: ${HealthMeterFacetProd.address}`
    );

    await verifyContract(hre,
        {
            address: HealthMeterFacetProd.address,
            contract: `contracts/facets/HealthMeterFacetProd.sol:HealthMeterFacetProd`,
            constructorArguments: []
        });
    console.log(`Verified HealthMeterFacetProd`);
};

module.exports.tags = ["avalanche-health-meter"];
