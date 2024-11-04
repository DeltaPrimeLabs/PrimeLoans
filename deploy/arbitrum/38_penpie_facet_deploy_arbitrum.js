import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    // embedCommitHash("PenpieFacet", "./contracts/facets/arbitrum");
    //
    // let PenpieFacet = await deploy("PenpieFacet", {
    //     from: deployer,
    //     args: [],
    // });
    //
    //
    // console.log(
    //     `PenpieFacet implementation deployed at address: ${PenpieFacet.address}`
    // );

    await verifyContract(hre,
        {
            address: "0x130c975A189024CDFe4A4B38706a431463AD0aCf",
            contract: `contracts/facets/arbitrum/PenpieFacet.sol:PenpieFacet`,
            constructorArguments: []
        });
    console.log(`Verified PenpieFacet`);
};

module.exports.tags = ["arbitrum-penpie-facet"];
