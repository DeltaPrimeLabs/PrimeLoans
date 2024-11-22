import verifyContract from "../../tools/scripts/verify-contract";
import {embedCommitHash} from "../../tools/scripts/embed-commit-hash";
const hre = require("hardhat");
module.exports = async ({
    getNamedAccounts,
    deployments
}) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();

    // IMPORTANT: Update contract's name and path accordingly before using the 0_deploy_contract.js script
    // embedCommitHash('TestGmxV2', './contracts/deployment/avalanche');
    const contractName = 'TestGmxV2';

    console.log(await getNamedAccounts())
    console.log(deployer.address)
    let result = await deploy(contractName, {
        from: deployer,
        // gasLimit: 8000000
    });

    console.log('result.address: ', result.address)

    await verifyContract(hre, {
        contract: 'contracts/mock/TestGmxV2.sol:TestGmxV2',
        address: result.address
    });

    console.log(`Deployed ${contractName} implementation at address: ${result.address}`);
};

module.exports.tags = ['deploy-contract'];
