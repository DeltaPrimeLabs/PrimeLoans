import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    const FacetCutAction = {
        Add: 0,
        Replace: 1,
        Remove: 2
    }

    embedCommitHash("VectorFinanceFacet", "./contracts/facets/avalanche");

    let VectorFinanceFacet = await deploy("VectorFinanceFacet", {
        from: deployer,
        gasLimit: 15000000,
        args: [],
    });


    console.log(
        `VectorFinanceFacet implementation deployed at address: ${VectorFinanceFacet.address}`
    );

    await verifyContract(hre,
        {
            address: VectorFinanceFacet.address,
            contract: `contracts/facets/avalanche/VectorFinanceFacet.sol:VectorFinanceFacet`,
            constructorArguments: []
        });
    console.log(`Verified VectorFinanceFacet`);

};

module.exports.tags = ["avax-vf"];
