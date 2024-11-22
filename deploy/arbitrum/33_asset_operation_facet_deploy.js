import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("AssetsOperationsArbitrumFacet", "./contracts/facets/arbitrum");

    let AssetsOperationsArbitrumFacet = await deploy("AssetsOperationsArbitrumFacet", {
        from: deployer,
        gasLimit: 80000000,
        args: [],
    });

    console.log(
        `AssetsOperationsArbitrumFacet implementation deployed at address: ${AssetsOperationsArbitrumFacet.address}`
    );

    // sleep 5 seconds
    await new Promise(r => setTimeout(r, 5000));

    await verifyContract(hre,
        {
            address: AssetsOperationsArbitrumFacet.address,
            contract: `contracts/facets/arbitrum/AssetsOperationsArbitrumFacet.sol:AssetsOperationsArbitrumFacet`,
            constructorArguments: []
        });
    console.log(`Verified AssetsOperationsArbitrumFacet`);
};

module.exports.tags = ["arbitrum-asset-operation"];
