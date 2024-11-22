import {ethers} from "hardhat";

const {embedCommitHash} = require("../../tools/scripts/embed-commit-hash");
const aavePoolAddressesProviderAdress = '0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb';
import AVAX_TOKEN_ADDRESSES from '../../common/addresses/avax/token_addresses.json';

module.exports = async ({
                            getNamedAccounts,
                            deployments
                        }) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();


    embedCommitHash('LiquidationFlashloan');

    let diamondBeacon = await ethers.getContract("SmartLoanDiamondBeacon");

    let result = await deploy('LiquidationFlashloan', {
        from: deployer,
        gasLimit: 8000000,
        args: [
            aavePoolAddressesProviderAdress,
            AVAX_TOKEN_ADDRESSES.AVAX,
            diamondBeacon.address
        ]
    });

    console.log(`Deployed LiquidationFlashloan at address: ${result.address}`);

    let liquidationFacet = await ethers.getContractAt("SmartLoanLiquidationFacet", diamondBeacon.address, deployer);
    await liquidationFacet.whitelistLiquidators([result.address, "0xe8D4E496ef28A0A6E0F2ce7805ff12482D8FdCE6"]);
    console.log(`Whitelisted flashloan liquidator: ${result.address} & 0xe8D4E496ef28A0A6E0F2ce7805ff12482D8FdCE6`);
};

module.exports.tags = ['avalanche-liquidation-flashloan'];
