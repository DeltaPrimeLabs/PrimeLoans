import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("SmartLoanViewFacet", "./contracts/facets");

    let SmartLoanViewFacet = await deploy("SmartLoanViewFacet", {
        from: deployer,
        gasLimit: 15000000,
        args: [],
    });


    console.log(
        `SmartLoanViewFacet implementation deployed at address: ${SmartLoanViewFacet.address}`
    );

    await verifyContract(hre,
        {
            address: "0x66b00aef4786C3DA60C8C99375a4Bd8AC97C3A1D",
            contract: `contracts/facets/SmartLoanViewFacet.sol:SmartLoanViewFacet`,
            constructorArguments: []
        });
    console.log(`Verified SmartLoanViewFacet`);
};

module.exports.tags = ["avalanche-view-facet"];
