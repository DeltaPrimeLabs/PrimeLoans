import hre, { ethers } from "hardhat";

const { embedCommitHash } = require("../../tools/scripts/embed-commit-hash");
const aavePoolAddressesProviderAdress =
    "0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb";
import ARB_TOKEN_ADDRESSES from "../../common/addresses/arbitrum/token_addresses.json";
import verifyContract from "../../tools/scripts/verify-contract";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    embedCommitHash("LiquidationFlashloanArbitrum");

    // let diamondBeacon = await ethers.getContract("SmartLoanDiamondBeacon");

    let result = await deploy("LiquidationFlashloanArbitrum", {
        from: deployer,
        gasLimit: 80000000,
        args: [
            aavePoolAddressesProviderAdress,
            ARB_TOKEN_ADDRESSES.ETH,
            "0x62Cf82FB0484aF382714cD09296260edc1DC0c6c",
        ],
    });

    console.log(`Deployed LiquidationFlashloanArbitrum at address: ${result.address}`);

    await verifyContract(hre,
        {
            address: result.address,
            contract: `contracts/LiquidationFlashloanArbitrum.sol:LiquidationFlashloanArbitrum`,
            constructorArguments: [
                aavePoolAddressesProviderAdress,
                ARB_TOKEN_ADDRESSES.ETH,
                "0x62Cf82FB0484aF382714cD09296260edc1DC0c6c",
            ]
        });
    console.log(`Verified LiquidationFlashloanArbitrum`);

    // let liquidationFacet = await ethers.getContractAt(
    //     "SmartLoanLiquidationFacet",
    //     "0x62Cf82FB0484aF382714cD09296260edc1DC0c6c",
    //     deployer
    // );
    // await liquidationFacet.whitelistLiquidators([
    //     result.address,
    // ]);
    // console.log(`Whitelisted flashloan liquidator: ${result.address}`);
    //
    // await liquidationFacet.delistLiquidators([
    //     "0x0D45A30F878895aF7510F7a23E82EcA253f6e375",
    // ]);
    // console.log(`Delisted old flashloan liquidator: 0x0D45A30F878895aF7510F7a23E82EcA253f6e375`);

};

module.exports.tags = ["arbitrum-flashloan-replace"];
