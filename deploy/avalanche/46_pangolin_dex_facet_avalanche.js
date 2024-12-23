import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    let pangolinDEXFacet = await deploy("PangolinDEXFacet", {
        from: deployer,
        args: [],
    });


    console.log(
        `PangolinDEXFacet implementation deployed at address: ${pangolinDEXFacet.address}`
    );

    // sleep 10 seconds
    await new Promise(resolve => setTimeout(resolve, 10000));

    await verifyContract(hre,
        {
            address: pangolinDEXFacet.address,
            contract: `contracts/facets/avalanche/PangolinDEXFacet.sol:PangolinDEXFacet`,
            constructorArguments: []
        });
    console.log(`Verified PangolinDEXFacet`);
};

module.exports.tags = ["avalanche-pangolin-dex-facet-2"];
