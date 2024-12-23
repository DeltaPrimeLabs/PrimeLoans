import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    let withdrawalIntentFacet = await deploy("WithdrawalIntentFacet", {
        from: deployer,
        args: [],
    });


    console.log(
        `WithdrawalIntentFacet implementation deployed at address: ${withdrawalIntentFacet.address}`
    );

    // sleep 10 seconds
    await new Promise(resolve => setTimeout(resolve, 10000));

    await verifyContract(hre,
        {
            address: withdrawalIntentFacet.address,
            contract: `contracts/facets/WithdrawalIntentFacet.sol:WithdrawalIntentFacet`,
            constructorArguments: []
        });
    console.log(`Verified WithdrawalIntentFacet`);
};

module.exports.tags = ["avalanche-withdrawal-intents-pas"];
