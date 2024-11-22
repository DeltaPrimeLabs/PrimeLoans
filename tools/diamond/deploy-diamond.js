/* eslint prefer-const: "off" */
const {ethers} = require("hardhat");


const { getSelectors, FacetCutAction } = require('./selectors.js')

async function replaceFacet(facetName, diamondAddress, onlySpecificFunctions = [], hardhatConfig = undefined) {
    const cut = []

    const facet = await deployContract(facetName, [], hardhatConfig);
    console.log(`${facetName} deployed: ${facet.address}`);

    if(onlySpecificFunctions.length > 0) {
        cut.push({
            facetAddress: facet.address,
            action: FacetCutAction.Replace,
            functionSelectors: getSelectors(facet).get(onlySpecificFunctions)
        })
    } else {
        cut.push({
            facetAddress: facet.address,
            action: FacetCutAction.Replace,
            functionSelectors: getSelectors(facet)
        })
    }

    const diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress)
    let tx
    let receipt

    tx = await diamondCut.diamondCut(cut, ethers.constants.AddressZero, [], {gasLimit: 8000000})
    console.log('Diamond cut tx: ', tx.hash)
    receipt = await tx.wait()
    if (!receipt.status) {
        throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    console.log('Completed diamond cut')
}

async function deployFacet(facetName, diamondAddress, newlyIntroducedFunctions = [], hardhatConfig = undefined) {
    const cut = []
    let facet
    facet = await deployContract(facetName, [], undefined, hardhatConfig);

    console.log(`${facetName} deployed: ${facet.address}`);

    if(newlyIntroducedFunctions.length > 0) {
        cut.push({
            facetAddress: facet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(facet).get(newlyIntroducedFunctions)
        })
    } else {
        cut.push({
            facetAddress: facet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(facet)
        })
    }

    const diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress)
    let tx
    let receipt

    tx = await diamondCut.diamondCut(cut, ethers.constants.AddressZero, [], {gasLimit: 8000000})
    console.log('Diamond cut tx: ', tx.hash)
    receipt = await tx.wait()
    if (!receipt.status) {
        throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    console.log('Completed diamond cut')
}

async function deployDiamond(hardhatConfig = undefined) {
    const accounts = await ethers.getSigners()
    const contractOwner = hardhatConfig === undefined ? accounts[0] : hardhatConfig.deployer;

    // deploy DiamondCutFacet
    const diamondCutFacet = await deployContract('DiamondCutFacet', [], {}, hardhatConfig);

    console.log('DiamondCutFacet deployed:', diamondCutFacet.address)

    // deploy Diamond
    const diamond = await deployContract('SmartLoanDiamondBeacon', [contractOwner.address === undefined ? contractOwner : contractOwner.address, diamondCutFacet.address], {}, hardhatConfig);

    console.log('Diamond deployed:', diamond.address)

    // deploy DiamondInit
    // DiamondInit provides a function that is called when the diamond is upgraded to initialize state variables
    // Read about how the diamondCut function works here: https://eips.ethereum.org/EIPS/eip-2535#addingreplacingremoving-functions
    const diamondInit = await deployContract('DiamondInit', [], {}, hardhatConfig);
    console.log('DiamondInit deployed:', diamondInit.address)

    const cut = []
    cut.push({
        facetAddress: diamondInit.address,
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(diamondInit, hardhatConfig)
    })

    // deploy facets
    console.log('Deploying facets')
    // TODO: Deploy normal SolvencyFacet and Mock - RP only in tests
    const FacetNames = [
        'DiamondLoupeFacet',
    ]
    for (const FacetName of FacetNames) {
        const facet = await deployContract(FacetName, [], {}, hardhatConfig);
        console.log(`${FacetName} deployed: ${facet.address}`)
        cut.push({
            facetAddress: facet.address,
            action: FacetCutAction.Add,
            functionSelectors: getSelectors(facet, hardhatConfig)
        })
    }

    // upgrade diamond with facets
    const diamondCut = await ethers.getContractAt('IDiamondCut', diamond.address, hardhatConfig === undefined ? undefined : hardhatConfig.deployer)
    let tx
    let receipt
    // call to init function
    let functionCall = diamondInit.interface.encodeFunctionData('init')

    tx = await diamondCut.diamondCut(cut, diamondInit.address, functionCall, {gasLimit: 20000000})
    console.log('Diamond cut tx: ', tx.hash)
    receipt = await tx.wait()
    if (!receipt.status) {
        throw Error(`Diamond upgrade failed: ${tx.hash}`)
    }
    console.log('Completed diamond cut')

    tx = await diamondCut.unpause();
    receipt = await tx.wait();
    if (!receipt.status) {
        throw Error(`Diamond unpausing failed: ${tx.hash}`)
    }
    console.log(`Completed diamond unpause (tx: ${tx.hash})`)
    return diamond.address
}

async function deployContract(name, args = [], libraries = undefined, hardhatConfig = undefined) {
    if (!hardhatConfig) {
        console.log('deploying with ethers')
        const factory = await ethers.getContractFactory(name, { libraries: libraries });
        const contract = await factory.deploy(...args)
        await contract.deployed();
        return contract;
    } else {
        console.log('deploying with hardhatConfig')

        await hardhatConfig.deploy(name, {
            from: hardhatConfig.deployer,
            gasLimit: 50000000,
            args: args,
            libraries: libraries
        });

        return await ethers.getContract(name);
    }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
if (require.main === module) {
    deployDiamond()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error)
            process.exit(1)
        })
}

exports.deployDiamond = deployDiamond
exports.deployFacet = deployFacet
exports.replaceFacet = replaceFacet