import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("BalancerV2Facet", "./contracts/facets/avalanche");

    let BalancerV2Facet = await deploy("BalancerV2Facet", {
        from: deployer,
        args: [],
    });


    console.log(
        `BalancerV2Facet implementation deployed at address: ${BalancerV2Facet.address}`
    );

    await verifyContract(hre,
        {
            address: BalancerV2Facet.address,
            contract: `contracts/facets/avalanche/BalancerV2Facet.sol:BalancerV2Facet`,
            constructorArguments: []
        });
    console.log(`Verified BalancerV2Facet`);
};

module.exports.tags = ["avalanche-balancer-v2"];
