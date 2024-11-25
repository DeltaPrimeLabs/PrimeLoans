import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("AssetsOperationsArbitrumFacet", "./contracts/facets/arbitrum");

    let AssetsOperationsArbitrumFacet = await deploy("AssetsOperationsArbitrumFacet", {
        from: deployer,
        args: [],
    });


    console.log(
        `AssetsOperationsArbitrumFacet implementation deployed at address: ${AssetsOperationsArbitrumFacet.address}`
    );

    await verifyContract(hre,
        {
            address: AssetsOperationsArbitrumFacet.address,
            contract: `contracts/facets/arbitrum/AssetsOperationsArbitrumFacet.sol:AssetsOperationsArbitrumFacet`,
            constructorArguments: []
        });
    console.log(`Verified AssetsOperationsArbitrumFacet`);
};

module.exports.tags = ["arbitrum-operations-facet"];
