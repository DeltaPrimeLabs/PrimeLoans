import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";
import {ether} from "@openzeppelin/test-helpers";

function getContractSelectorToFunctionSignatureMapping(contract){
    const signatures = Object.keys(contract.interface.functions);
    const result = {}
    for(const signature of signatures){
        result[contract.interface.getSighash(signature)] = signature;
    }
    return result;
}

async function getFacetAddressToSelectorsMapping(methodsSelectors, diamondAddress, wallet){
    const diamondLoupe = await ethers.getContractAt("IDiamondLoupe", diamondAddress, wallet);
    const facetAddressToSelectors = {}
    for(const methodSelector of methodsSelectors){
        let facetAddress = await diamondLoupe.facetAddress(methodSelector);
        if(facetAddressToSelectors[facetAddress] === undefined){
            facetAddressToSelectors[facetAddress] = [methodSelector];
        } else {
            facetAddressToSelectors[facetAddress].push(methodSelector);
        }
    }
    return facetAddressToSelectors;
}

function getContractSelectors(contract){
    return Object.keys(contract.interface.functions).map(signature => contract.interface.getSighash(signature));
}

function TableRow(facetAddress, methodSelector, methodSignature) {
    this.facetAddress = facetAddress;
    this.methodSelector = methodSelector;
    this.methodSignature = methodSignature;
}

function logDiamondCutAnalysis(methodsSelectors, facetAddressToSelectors, selectorToFunctionSignature){
    const deployedMethodsCount = Object.keys(facetAddressToSelectors).reduce((acc, val) => {
        if(val !== ethers.constants.AddressZero){
            acc += facetAddressToSelectors[val].length;
        }
        return acc;
    }, 0);
    const notDeployedMethodsCount = methodsSelectors.length - deployedMethodsCount;
    const notDeployedMethodsExist = notDeployedMethodsCount > 0;
    const deployedFacetsCount = notDeployedMethodsExist ?
        Object.keys(facetAddressToSelectors).length - 1 :
        Object.keys(facetAddressToSelectors).length;

    console.log(`Contract contains ${methodsSelectors.length} unique methods.`);

    console.log(`[${deployedMethodsCount}/${methodsSelectors.length}] methods are already deployed across ${deployedFacetsCount} facets.`)
    console.log(`[${notDeployedMethodsCount}/${methodsSelectors.length}] methods are new and not deployed yet.`)

    let table = []

    for(const facetAddress of Object.keys(facetAddressToSelectors)){
        if(facetAddress !== ethers.constants.AddressZero){
            let selectors = facetAddressToSelectors[facetAddress];
            for(const selector of selectors){
                table.push(
                    new TableRow(facetAddress, selector, selectorToFunctionSignature[selector])
                );
            }
        }
    }
    // Add not deployed methods to the very end
    if(Object.keys(facetAddressToSelectors).includes(ethers.constants.AddressZero)){
        let selectors = facetAddressToSelectors[ethers.constants.AddressZero];
        for(const selector of selectors){
            table.push(
                new TableRow(ethers.constants.AddressZero, selector, selectorToFunctionSignature[selector])
            );
        }
    }
    console.table(table, ["facetAddress", "methodSelector", "methodSignature"], );
}
async function checkMethodsSelectorsAgainstDiamondLoupe(contract, diamondAddress, wallet, replaceOnly = true){
    let methodsSelectors = getContractSelectors(contract);
    const facetAddressToSelectors = await getFacetAddressToSelectorsMapping(methodsSelectors, diamondAddress, wallet);
    const selectorToFunctionSignature = getContractSelectorToFunctionSignatureMapping(contract);
    logDiamondCutAnalysis(methodsSelectors, facetAddressToSelectors, selectorToFunctionSignature);
    if(replaceOnly){
        if(Object.keys(facetAddressToSelectors).includes(ethers.constants.AddressZero)) {
            methodsSelectors = methodsSelectors.filter(el => !facetAddressToSelectors[ethers.constants.AddressZero].includes(el));
        }
        console.log(`Returning ${methodsSelectors.length} selectors to be REPLACED`);
        return methodsSelectors;
    } else {
        throw Error("Not implemented!")
    }
}

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    const FacetCutAction = {
        Add: 0,
        Replace: 1,
        Remove: 2
    }

    embedCommitHash("AssetsOperationsArbitrumFacet", "./contracts/facets/arbitrum");

    let AssetsOperationsArbitrumFacet = await deploy("AssetsOperationsArbitrumFacet", {
        from: deployer,
        gasLimit: 50000000,
        args: [],
    });


    console.log(
        `AssetsOperationsArbitrumFacet implementation deployed at address: ${AssetsOperationsArbitrumFacet.address}`
    );

    await verifyContract(hre,
        {
            address: AssetsOperationsArbitrumFacet.address,
            contract: `contracts/facets/arbitrum/AssetsOperationsArbitrumFacet.sol:AssetsOperationsArbitrumFacet`,
            constructorArguments: []
        });
    console.log(`Verified AssetsOperationsArbitrumFacet`);

    const diamondContract = await ethers.getContract("SmartLoanDiamondBeacon");
    console.log(`Diamond address: ${diamondContract.address}`);
    const diamondCut = await ethers.getContractAt("IDiamondCut", diamondContract.address, deployer);
    let contract = await ethers.getContract("AssetsOperationsArbitrumFacet");
    let methodsSelectors = await checkMethodsSelectorsAgainstDiamondLoupe(contract, diamondContract.address, deployer);

    const facetCut = [
        [
            AssetsOperationsArbitrumFacet.address,
            FacetCutAction.Replace,
            methodsSelectors
        ]
    ]

    console.log(`Performing diamondCut with: ${facetCut}`)
    await diamondCut.pause();
    console.log('Paused')
    await diamondCut.diamondCut(
        facetCut,
        ethers.constants.AddressZero,
        []
    )
    await diamondCut.unpause();
    console.log('Unpaused')
    console.log(`DiamondCut finished`)
    console.log('DiamondLoupe after diamondCut:')
    await checkMethodsSelectorsAgainstDiamondLoupe(contract, diamondContract.address, deployer);
};

module.exports.tags = ["arbitrum-assets-operations-solvent"];
