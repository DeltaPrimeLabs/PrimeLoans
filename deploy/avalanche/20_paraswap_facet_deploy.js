import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();
    //
    // embedCommitHash("ParaSwapFacet", "./contracts/facets/avalanche");
    //
    // let ParaSwapFacet = await deploy("ParaSwapFacet", {
    //     from: deployer,
    //     gasLimit: 15000000,
    //     args: [],
    // });
    //
    //
    // console.log(
    //     `ParaSwapFacet implementation deployed at address: ${ParaSwapFacet.address}`
    // );

    await verifyContract(hre,
        {
            address: '0x492579f489FB436ec61023b6315AA7dec4a23428',
            contract: `contracts/facets/avalanche/ParaSwapFacet.sol:ParaSwapFacet`,
            constructorArguments: []
        });
    console.log(`Verified ParaSwapFacet`);
};

module.exports.tags = ["avalanche-paraswap"];
