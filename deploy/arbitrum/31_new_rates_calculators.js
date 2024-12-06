import hre from "hardhat";
const { embedCommitHash } = require("../../tools/scripts/embed-commit-hash");
import verifyContract from "../../tools/scripts/verify-contract";
const {ethers} = require("hardhat");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const tokens = ['Usdc', 'Dai', 'Weth', 'Btc', 'Arb'];

    // Embed commit hash for all contracts
    for (const token of tokens) {
        embedCommitHash(
            `${token}VariableUtilisationRatesCalculatorFixedRate`,
            "./contracts/deployment/arbitrum"
        );
    }

    // Deploy and verify all contracts
    for (const token of tokens) {
        const contractName = `${token}VariableUtilisationRatesCalculatorFixedRate`;
        const contractPath = `contracts/deployment/arbitrum/${contractName}.sol:${contractName}`;

        const result = await deploy(contractName, {
            contract: contractPath,
            from: deployer,
            args: [],
        });

        console.log(
            `Deployed ${contractName} at address: ${result.address}`
        );

        await new Promise(r => setTimeout(r, 15000));

        await verifyContract(hre, {
            address: result.address,
            contract: contractPath,
            constructorArguments: []
        });

        console.log(`Verified ${contractName}`);
    }
};

module.exports.tags = ["arbitrum-redeploy-rates-calculator"];