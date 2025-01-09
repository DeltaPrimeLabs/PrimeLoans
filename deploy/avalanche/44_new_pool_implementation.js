import hre, { ethers } from "hardhat";

const { embedCommitHash } = require("../../tools/scripts/embed-commit-hash");
import verifyContract from "../../tools/scripts/verify-contract";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    embedCommitHash('Pool', './contracts');


    let pools = {}

    let poolContract = await deploy("Pool", {
        contract: "contracts/Pool.sol:Pool",
        from: deployer,
        args: [],
    });

    pools["ETH"] = poolContract.address;
    console.log(`Deployed Pool at address: ${poolContract.address}`);

    // sleep 10 seconds
    await new Promise(r => setTimeout(r, 10000));

    await verifyContract(hre,
        {
            address: "0xBbfE1DE572B1EA81d208dF6C490327242e3accC3",
            contract: "contracts/Pool.sol:Pool",
            constructorArguments: []
        });
    console.log(`Verified Pool`)



    console.log(Object.entries(pools))

};

module.exports.tags = ["avalanche-pools-update"];
