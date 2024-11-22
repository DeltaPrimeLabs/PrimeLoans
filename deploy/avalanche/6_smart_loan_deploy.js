import {embedCommitHash} from "../../tools/scripts/embed-commit-hash";

const {ethers} = require("hardhat");
import {deployDiamond} from "../../tools/diamond/deploy-diamond";
import {deployAllFacets, recompileConstantsFile} from "../../test/_helpers";
import web3Abi from "web3-eth-abi";

module.exports = async ({
                            getNamedAccounts,
                            deployments
                        }) => {
    const {deploy} = deployments;
    const {deployer, admin} = await getNamedAccounts();

    embedCommitHash('SmartLoanDiamondBeacon');
    embedCommitHash('DeploymentConstants', 'contracts/lib/avalanche');
    embedCommitHash('DiamondStorageLib', 'contracts/lib');

    embedCommitHash('SmartLoansFactory');
    embedCommitHash('SmartLoansFactoryTUP', './contracts/proxies/tup');

    let smartLoansFactory = await deploy('SmartLoansFactory', {
        from: deployer,
        gasLimit: 8000000,
        args: []
    });

    const initializeInterface =   {
        "inputs": [
            {
                "internalType": "contract SmartLoan",
                "name": "_smartLoanImplementation",
                "type": "address"
            }
        ],
        "name": "initialize",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    };

    const diamondAddress = await deployDiamond({
        deployer: deployer,
        deploy: deploy
    });

    const calldata = web3Abi.encodeFunctionCall(
        initializeInterface,
        [diamondAddress]
    )

    let resultTup = await deploy('SmartLoansFactoryTUP', {
        from: deployer,
        gasLimit: 8000000,
        args: [smartLoansFactory.address, admin, calldata],
    });

    console.log(`SmartLoansFactory implementation deployed at address: ${resultTup.address}`);

    const pangolinIntermediary = await ethers.getContract("PangolinIntermediaryTUP");
    const traderJoeIntermediary = await ethers.getContract("TraderJoeIntermediaryTUP");
    const tokenManager = await ethers.getContract("TokenManagerTUP");
    const addressProvider = await ethers.getContract("AddressProviderTUP");

    await recompileConstantsFile(
        'avalanche',
        "DeploymentConstants",
        [
            {
                facetPath: './contracts/facets/avalanche/PangolinDEXFacet.sol',
                contractAddress: pangolinIntermediary.address,
            },
            {
                facetPath: './contracts/facets/avalanche/TraderJoeDEXFacet.sol',
                contractAddress: traderJoeIntermediary.address,
            }
        ],
        tokenManager.address,
        addressProvider.address,
        diamondAddress,
        resultTup.address,
        'lib'
    );

    //TODO: verify code
    await deployAllFacets(diamondAddress, false,'AVAX', {
        deployer: deployer,
        deploy: deploy
    })


    //TODO: verify contracts
    console.log(`Deployed SmartLoanDiamondBeacon at address: ${diamondAddress}`);

};

module.exports.tags = ['avalanche'];
