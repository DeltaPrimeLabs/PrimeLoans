import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";


module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("SolvencyFacetProdArbitrum", "./contracts/facets/arbitrum");

    let SolvencyFacetProdArbitrum = await deploy("SolvencyFacetProdArbitrum", {
        from: deployer,
        gasLimit: 50000000,
        args: [],
    });


    console.log(
        `SolvencyFacetProdArbitrum implementation deployed at address: ${SolvencyFacetProdArbitrum.address}`
    );

    await verifyContract(hre,
        {
            address: SolvencyFacetProdArbitrum.address,
            contract: `contracts/facets/arbitrum/SolvencyFacetProdArbitrum.sol:SolvencyFacetProdArbitrum`,
            constructorArguments: []
        });
    console.log(`Verified SolvencyFacetProdArbitrum`);

};

module.exports.tags = ["arbitrum-solvency-facet"];
