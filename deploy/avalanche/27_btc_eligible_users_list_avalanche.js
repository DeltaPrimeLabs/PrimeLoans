import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

const { ethers } = require("hardhat");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    const initialEligibleUsers = ["0x5446ee1686AA82A0A5f9c300173244Fa5eE087a7", "0x8f430e5d18CCa67288c74c72bb3326F62cc1f7B7", "0x12B26DD6A01D0de420BA2EF485e4152C9b16D603"];

    let btcEligibleUsersList = await deploy("BtcEligibleUsersList", {
        from: deployer,
        gasLimit: 15000000,
        args: [initialEligibleUsers],
    });

    console.log(`Deployed BtcEligibleUsersList at address: ${btcEligibleUsersList.address}`);

    await verifyContract(hre, {
        address: btcEligibleUsersList.address,
        contract: "contracts/BtcEligibleUsersList.sol:BtcEligibleUsersList",
        constructorArguments: [initialEligibleUsers]
    })

    console.log('Verified BtcEligibleUsersList.')
};

module.exports.tags = ["avalanche-btc-eligible-users-list"];
