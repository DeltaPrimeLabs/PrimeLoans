import hre, { ethers } from "hardhat";

const { embedCommitHash } = require("../../tools/scripts/embed-commit-hash");
const aavePoolAddressesProviderAdress =
    "0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb";
import AVAX_TOKEN_ADDRESSES from "../../common/addresses/avax/token_addresses.json";
import verifyContract from "../../tools/scripts/verify-contract";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    embedCommitHash("LiquidationFlashloanAvalanche");

    let diamondBeacon = await ethers.getContract("SmartLoanDiamondBeacon");
    console.log(`diamondBeacon: ${diamondBeacon.address}`)

    let result = await deploy("LiquidationFlashloanAvalanche", {
        from: deployer,
        gasLimit: 15000000,
        args: [
            aavePoolAddressesProviderAdress,
            AVAX_TOKEN_ADDRESSES.ETH,
            diamondBeacon.address,
        ],
    });

    console.log(`Deployed LiquidationFlashloanAvalanche at address: ${result.address}`);

    await verifyContract(hre,
        {
            address: result.address,
            contract: `contracts/LiquidationFlashloanAvalanche.sol:LiquidationFlashloanAvalanche`,
            constructorArguments: [
                aavePoolAddressesProviderAdress,
                AVAX_TOKEN_ADDRESSES.ETH,
                diamondBeacon.address,
            ]
        });
    console.log(`Verified LiquidationFlashloanAvalanche`);

    // Needs to be handled via multisig
    // let liquidationFacet = await ethers.getContractAt(
    //     "SmartLoanLiquidationFacet",
    //     diamondBeacon.address,
    //     deployer
    // );
    // await liquidationFacet.whitelistLiquidators([
    //     result.address,
    // ]);
    // console.log(`Whitelisted flashloan liquidator: ${result.address}`);
    //
    // await liquidationFacet.delistLiquidators([
    //     "0xEf59ef79f82e6a04363163c5211A22d057948F99",
    // ]);
    // console.log(`Delisted old flashloan liquidator: 0xEf59ef79f82e6a04363163c5211A22d057948F99`);

};

module.exports.tags = ["avalanche-flashloan-replace"];
