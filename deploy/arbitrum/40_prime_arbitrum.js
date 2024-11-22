import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();
    const LZ_ENDPOINT = "0x3c2269811836af69497E5F486A85D7316753cf62";

    embedCommitHash("Prime_L2", "./contracts/token");
    let Prime = await deploy("Prime_L2", {
        from: deployer,
        gasLimit: 100000000,
        args: ["DeltaPrime", "PRIME", 6, LZ_ENDPOINT],
    });

    
    console.log(
        `Prime_L2 deployed at address: ${Prime.address}`
    );

    await verifyContract(hre,
        {
            address: Prime.address,
            contract: `contracts/token/Prime_L2.sol:Prime_L2`,
            constructorArguments: ["DeltaPrime", "PRIME", 6, LZ_ENDPOINT]
        });
    console.log(`Verified Prime_L2`);
};

module.exports.tags = ["arbitrum-prime"];
