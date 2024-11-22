import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("SmartLoanLiquidationFacet", "./contracts/facets");

    let SmartLoanLiquidationFacet = await deploy("SmartLoanLiquidationFacet", {
        from: deployer,
        gasLimit: 15000000,
        args: [],
    });


    console.log(
        `SmartLoanLiquidationFacet implementation deployed at address: ${SmartLoanLiquidationFacet.address}`
    );

    await verifyContract(hre,
        {
            address: SmartLoanLiquidationFacet.address,
            contract: `contracts/facets/SmartLoanLiquidationFacet.sol:SmartLoanLiquidationFacet`,
            constructorArguments: []
        });
    console.log(`Verified SmartLoanLiquidationFacet`);
};

module.exports.tags = ["avalanche-liquidation-facet"];
