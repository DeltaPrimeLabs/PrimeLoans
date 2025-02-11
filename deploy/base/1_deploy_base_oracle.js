import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";
import web3Abi from "web3-eth-abi";
import BaseOracleArtifact
    from "../../artifacts/contracts/oracle/BaseOracle.sol/BaseOracle.json";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    const BASE_OWNER_MULTISIG_ADDRESS = "0xd6Ef2C4DeEcCD77E154b99bC2F039E5f82DCc7c9";
    const BASE_ADMIN_MULTISIG_ADDRESS = "0xCD053EeA1B82867c491dECe0A8833941849771D0";

    let deployedOracleContract = await deploy("BaseOracle", {
        from: deployer,
        args: [],
    });


    console.log(
        `BaseOracle implementation deployed at address: ${deployedOracleContract.address}`
    );

    // sleep 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));

    await verifyContract(hre,
        {
            address: deployedOracleContract.address,
            contract: `contracts/oracle/BaseOracle.sol:BaseOracle`,
            constructorArguments: []
        });
    console.log(`Verified BaseOracle`);

    const calldata = web3Abi.encodeFunctionCall(
        BaseOracleArtifact.abi.find(method => method.name === 'initialize'),
        [BASE_OWNER_MULTISIG_ADDRESS]
    )

    const args = [deployedOracleContract.address, BASE_ADMIN_MULTISIG_ADDRESS, calldata]

    let deployedOracleTUPContract = await deploy("BaseOracleTUP", {
        from: deployer,
        args: args,
    });

    console.log(
        `BaseOracleTUP implementation deployed at address: ${deployedOracleTUPContract.address}`
    );

    // sleep 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));

    await verifyContract(hre,
        {
            address: deployedOracleTUPContract.address,
            contract: `contracts/oracle/BaseOracleTUP.sol:BaseOracleTUP`,
            constructorArguments: args
        });
};

module.exports.tags = ["base-oracle"];
