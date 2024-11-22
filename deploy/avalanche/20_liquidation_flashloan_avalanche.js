import hre, {ethers} from "hardhat";
import verifyContract from "../../tools/scripts/verify-contract";
const {embedCommitHash} = require("../../tools/scripts/embed-commit-hash");
const aavePoolAddressesProviderAdress = '0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb';
import AVAX_TOKEN_ADDRESSES from '../../common/addresses/avax/token_addresses.json';

module.exports = async ({
                            getNamedAccounts,
                            deployments
                        }) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();


    embedCommitHash('LiquidationFlashloanAvalanche');

    let result = await deploy('LiquidationFlashloanAvalanche', {
        from: deployer,
        gasLimit: 8000000,
        args: [
            aavePoolAddressesProviderAdress,
            AVAX_TOKEN_ADDRESSES.AVAX,
            "0x2916B3bf7C35bd21e63D01C93C62FB0d4994e56D"
        ]
    });

    console.log(`Deployed LiquidationFlashloanAvalanche at address: ${result.address}`);

    await verifyContract(hre,
        {
            address: result.address,
            contract: `contracts/LiquidationFlashloanAvalanche.sol:LiquidationFlashloanAvalanche`,
            constructorArguments: [
                aavePoolAddressesProviderAdress,
                AVAX_TOKEN_ADDRESSES.AVAX,
                "0x2916B3bf7C35bd21e63D01C93C62FB0d4994e56D",
            ]
        });
    console.log(`Verified LiquidationFlashloanAvalanche`);
};

module.exports.tags = ['liquidation-flashloan-avalanche'];
