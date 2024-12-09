import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    // let mckTkn6 = await deploy("MockToken6Decimals", {
    //     from: deployer,
    //     args: [],
    // });
    //
    //
    // console.log(
    //     `MockToken6Decimals implementation deployed at address: ${mckTkn6.address}`
    // );
    //
    // // sleep 10 seconds
    // await new Promise(resolve => setTimeout(resolve, 10000));
    //
    // await verifyContract(hre,
    //     {
    //         address: mckTkn6.address,
    //         contract: `contracts/mock/MockToken6Decimals.sol:MockToken6Decimals`,
    //         constructorArguments: []
    //     });
    // console.log(`Verified MockToken6Decimals`);

    let mckTkn18 = await deploy("MockToken", {
        from: deployer,
        args: [],
    });


    console.log(
        `MockToken implementation deployed at address: ${mckTkn18.address}`
    );

    // sleep 10 seconds
    await new Promise(resolve => setTimeout(resolve, 10000));

    await verifyContract(hre,
        {
            address: mckTkn18.address,
            contract: `contracts/mock/MockToken.sol:MockToken`,
            constructorArguments: []
        });
    console.log(`Verified MockToken`);
};

module.exports.tags = ["avalanche-mock-tokens"];
