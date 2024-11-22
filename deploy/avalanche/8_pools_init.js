import {ZERO_ADDRESS} from "@openzeppelin/test-helpers/src/constants";

const {ethers} = require("hardhat");

import TOKEN_ADDRESSES from '../../common/addresses/avax/token_addresses.json';

module.exports = async ({
    getNamedAccounts,
    deployments
}) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();

    await initPool(deploy, deployer, "WavaxVariableUtilisationRatesCalculator", "WavaxPoolTUP", "WavaxDepositIndexTUP", "WavaxBorrowIndexTUP", TOKEN_ADDRESSES['AVAX']);
    await initPool(deploy, deployer, "UsdcVariableUtilisationRatesCalculator", "UsdcPoolTUP", "UsdcDepositIndexTUP", "UsdcBorrowIndexTUP",TOKEN_ADDRESSES['USDC']);
};

async function initPool(deploy, deployer, ratesCalculator, poolTup, depositIndex, borrowIndex, tokenAddress) {
    const poolTUP = await ethers.getContract(poolTup);
    const pool = await ethers.getContractFactory("Pool");
    const variableUtilisationRatesCalculator = await ethers.getContract(ratesCalculator);
    const smartLoansFactoryTUP = await ethers.getContract("SmartLoansFactoryTUP");
    const depositIndexTUP = await ethers.getContract(depositIndex);
    const borrowIndexTUP = await ethers.getContract(borrowIndex);

    let initializeTx = await pool.attach(poolTUP.address).initialize(
        variableUtilisationRatesCalculator.address,
        smartLoansFactoryTUP.address,
        depositIndexTUP.address,
        borrowIndexTUP.address,
        tokenAddress,
        ZERO_ADDRESS,
        0,
        { gasLimit: 8000000 }
    );

    await initializeTx.wait();

    console.log(`Initialized lending pool with: [ratesCalculator: ${variableUtilisationRatesCalculator.address}, ` +
        `borrowersRegistry: ${smartLoansFactoryTUP.address}, depositIndex: ${depositIndexTUP.address}, borrowIndex: ${borrowIndexTUP.address}].
    tokenAddress: ${tokenAddress}`);
}

module.exports.tags = ['avalanche'];
module.exports.initPool = initPool;
