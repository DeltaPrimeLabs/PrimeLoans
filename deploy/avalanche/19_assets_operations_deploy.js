import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("AssetsOperationsAvalancheFacet", "./contracts/facets/avalanche");

    let AssetsOperationsAvalancheFacet = await deploy("AssetsOperationsAvalancheFacet", {
        from: deployer,
        gasLimit: 15000000,
        args: [],
    });


    console.log(
        `AssetsOperationsAvalancheFacet implementation deployed at address: ${AssetsOperationsAvalancheFacet.address}`
    );

    await verifyContract(hre,
        {
            address: AssetsOperationsAvalancheFacet.address,
            contract: `contracts/facets/avalanche/AssetsOperationsAvalancheFacet.sol:AssetsOperationsAvalancheFacet`,
            constructorArguments: []
        });
    console.log(`Verified AssetsOperationsAvalancheFacet`);
};

module.exports.tags = ["avalanche-operations-facet"];
