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

    embedCommitHash("VectorFinanceFacetOld", "./contracts/facets/avalanche");

    let VectorFinanceFacetOld = await deploy("VectorFinanceFacetOld", {
        from: deployer,
        gasLimit: 15000000,
        args: [],
    });


    console.log(
        `VectorFinanceFacetOld implementation deployed at address: ${VectorFinanceFacetOld.address}`
    );

    await verifyContract(hre,
        {
            address: VectorFinanceFacetOld.address,
            contract: `contracts/facets/avalanche/VectorFinanceFacetOld.sol:VectorFinanceFacetOld`,
            constructorArguments: []
        });
    console.log(`Verified VectorFinanceFacetOld`);

};

module.exports.tags = ["avax-vf-old"];
