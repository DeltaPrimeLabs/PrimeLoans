const {execSync} = require("child_process");
const {ethers} = require("hardhat");
import updateSmartLoanProperties from "../tools/scripts/update-smart-loan-properties"

module.exports = async ({
    getNamedAccounts,
    deployments
}) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();

    const poolTUP = await ethers.getContract("PoolTUP");
    const exchangeTUP = await ethers.getContract("PangolinExchangeTUP");

    updateSmartLoanProperties(poolTUP.address, exchangeTUP.address);

    const output = execSync('npx hardhat compile', { encoding: 'utf-8' });
    console.log(output);

    let result = await deploy('SmartLoan', {
        from: deployer,
        gasLimit: 8000000,
        args: [],
    });

    console.log(`Deployed SmartLoan default implementation at address: ${result.address}`);

};

module.exports.tags = ['init'];
