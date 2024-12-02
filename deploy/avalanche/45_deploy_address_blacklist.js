import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    let AddressRecalculationStatus = await deploy("AddressRecalculationStatus", {
        from: deployer,
        args: [],
    });


    console.log(
        `AddressRecalculationStatus deployed at address: ${AddressRecalculationStatus.address}`
    );

    // sleep 20 seconds
    await new Promise(r => setTimeout(r, 20000));

    await verifyContract(hre,
        {
            address: AddressRecalculationStatus.address,
            contract: `contracts/AddressRecalculationStatus.sol:AddressRecalculationStatus`,
            constructorArguments: []
        });e
    console.log(`Verified AddressRecalculationStatus`);



};

module.exports.tags = ["avalanche-address-recaclulation-status"];
