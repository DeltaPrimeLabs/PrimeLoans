import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();


    embedCommitHash("SolvencyFacetProdAvalanche", "./contracts/facets/avalanche");

    let SolvencyFacetProdAvalanche = await deploy("SolvencyFacetProdAvalanche", {
        from: deployer,
        gasLimit: 15000000,
        args: [],
    });


    console.log(
        `SolvencyFacetProdAvalanche implementation deployed at address: ${SolvencyFacetProdAvalanche.address}`
    );

    await verifyContract(hre,
        {
            address: SolvencyFacetProdAvalanche.address,
            contract: `contracts/facets/avalanche/SolvencyFacetProdAvalanche.sol:SolvencyFacetProdAvalanche`,
            constructorArguments: []
        });
    console.log(`Verified SolvencyFacetProdAvalanche`);

};

module.exports.tags = ["avalanche-solvency-facet"];
