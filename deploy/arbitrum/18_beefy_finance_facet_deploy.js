import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("BeefyFinanceArbitrumFacet", "./contracts/facets/arbitrum");

    let BeefyFinanceArbitrumFacet = await deploy("BeefyFinanceArbitrumFacet", {
        from: deployer,
        gasLimit: 50000000,
        args: [],
    });

    console.log(
        `BeefyFinanceArbitrumFacet implementation deployed at address: ${BeefyFinanceArbitrumFacet.address}`
    );

    await verifyContract(hre,
        {
            address: BeefyFinanceArbitrumFacet.address,
            contract: `contracts/facets/arbitrum/BeefyFinanceArbitrumFacet.sol:BeefyFinanceArbitrumFacet`,
            constructorArguments: []
        });
    console.log(`Verified BeefyFinanceArbitrumFacet`);
};

module.exports.tags = ["arbitrum-beefy"];
