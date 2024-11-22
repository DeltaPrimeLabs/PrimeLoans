import verifyContract from "../../tools/scripts/verify-contract";
import {ethers} from "hardhat";
import {embedCommitHash} from "../../tools/scripts/embed-commit-hash";
import {renameSync} from "fs";
const hre = require("hardhat");
const networkName = hre.network.name

module.exports = async ({
    getNamedAccounts,
    deployments
}) => {
    const {deploy} = deployments;
    const {deployer, admin} = await getNamedAccounts();

    embedCommitHash('WethBorrowIndex', './contracts/deployment/arbitrum');
    embedCommitHash('WethDepositIndex', './contracts/deployment/arbitrum');
    embedCommitHash('UsdcBorrowIndex', './contracts/deployment/arbitrum');
    embedCommitHash('UsdcDepositIndex', './contracts/deployment/arbitrum');

    await deployLinearIndex("WethBorrowIndex", "WethPoolTUP", deploy, deployer, admin);
    await deployLinearIndex("WethDepositIndex", "WethPoolTUP", deploy, deployer, admin);
    await deployLinearIndex("UsdcBorrowIndex", "UsdcPoolTUP", deploy, deployer, admin);
    await deployLinearIndex("UsdcDepositIndex", "UsdcPoolTUP", deploy, deployer, admin);

};

async function deployLinearIndex(name, poolTup, deploy, deployer, admin) {
    const poolTUP = await ethers.getContract(poolTup);

    let resultIndex = await deploy(name, {
        contract: `contracts/deployment/arbitrum/${name}.sol:${name}`,
        from: deployer,
        gasLimit: 50000000,
        args: [],
    });

    console.log(`Deployed linear index at address: ${resultIndex.address}`);

    await verifyContract(hre,
        {
            address: resultIndex.address,
            contract: `contracts/deployment/arbitrum/${name}.sol:${name}`,
            constructorArguments: []
        });
    console.log(`Verified ${name}`)

    let result = await deploy(`${name}TUP`, {
        contract: `contracts/proxies/tup/arbitrum/${name}TUP.sol:${name}TUP`,
        from: deployer,
        gasLimit: 50000000,
        args: [resultIndex.address, admin, []],
    });

    console.log(`${name}TUP deployed at address: ${result.address}`);

    await verifyContract(hre,
        {
            address: result.address,
            contract: `contracts/proxies/tup/arbitrum/${name}TUP.sol:${name}TUP`,
            constructorArguments: [resultIndex.address, admin, []]
        });
    console.log(`Verified ${name}TUP.sol`)

    renameSync(`./deployments/${networkName}/${name}TUP.json`, `./deployments/${networkName}/${name}TUP.json`);

    const index = await ethers.getContractFactory(`./contracts/deployment/arbitrum/${name}.sol:${name}`);

    let initializeTx = await index.attach(result.address).initialize(
        poolTUP.address,
        { gasLimit: 50000000 }
    );

    await initializeTx.wait();
}

module.exports.tags = ['arbitrum-x7'];
module.exports.deployLinearIndex = deployLinearIndex;
