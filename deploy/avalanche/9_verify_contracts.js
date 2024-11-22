import {ethers, getNamedAccounts} from "hardhat";
import verifyContract from "../../tools/scripts/verify-contract";
import web3Abi from "web3-eth-abi";
import PangolinIntermediaryArtifact
    from "../../artifacts/contracts/integrations/avalanche/PangolinIntermediary.sol/PangolinIntermediary.json";
import addresses from "../../common/addresses/avax/token_addresses.json";
import {pool, toBytes32} from "../../test/_helpers";
import TraderJoeIntermediaryArtifact
    from "../../artifacts/contracts/integrations/avalanche/TraderJoeIntermediary.sol/TraderJoeIntermediary.json";
import TokenManagerArtifact from "../../artifacts/contracts/TokenManager.sol/TokenManager.json";
import {supportedAssetsAvax} from "../../common/addresses/avax/avalanche_supported_assets";

const hre = require("hardhat");

function asset(symbol) {
    return { asset: toBytes32(symbol), assetAddress: addresses[symbol] }
}

module.exports = async ({
}) => {
    const {deployer, admin} = await getNamedAccounts();

    let calculator = await ethers.getContract("WavaxVariableUtilisationRatesCalculator");

    await verifyContract(hre, {
      address: calculator.address
    });

    calculator = await ethers.getContract("UsdcVariableUtilisationRatesCalculator");

    await verifyContract(hre, {
        address: calculator.address
    });

    let wavaxPoolJSON = require('../../deployments/avalanche/by-factory/WavaxPool.json');

    await verifyContract(hre, {
      address: wavaxPoolJSON.address,
      contract: `contracts/deployment/avalanche/WavaxPool.sol:WavaxPool`
    });

    let usdcPoolJSON = require('../../deployments/avalanche/by-factory/UsdcPool.json');

    await verifyContract(hre, {
        address: usdcPoolJSON.address,
        contract: `contracts/deployment/avalanche/UsdcPool.sol:UsdcPool`
    });


    await verifyContract(hre, {
      address: (await ethers.getContract("WavaxPoolTUP")).address,
      contract: `contracts/proxies/tup/avalanche/WavaxPoolTUP.sol:WavaxPoolTUP`,
      constructorArguments: [
        wavaxPoolJSON.address,
        admin,
        []
      ]
    });

    await verifyContract(hre, {
        address: (await ethers.getContract("UsdcPoolTUP")).address,
        contract: `contracts/proxies/tup/avalanche/UsdcPoolTUP.sol:UsdcPoolTUP`,
        constructorArguments: [
            usdcPoolJSON.address,
            admin,
            []
        ]
    });


    await verifyContract(hre, {
        address: (await ethers.getContract("PangolinIntermediary")).address,
        contract: `contracts/integrations/avalanche/PangolinIntermediary.sol:PangolinIntermediary`,
    })

    const pangolinRouter = "0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106";

    const pangolinSupportedAssets = [
        asset('AVAX'),
        asset('USDC'),
        asset('ETH'),
        asset('sAVAX'),
        asset('USDT'),
        asset('PNG'),
        asset('PTP'),
        asset('QI'),
        asset('PNG_AVAX_USDC_LP'),
        asset('PNG_AVAX_USDT_LP'),
        asset('PNG_AVAX_ETH_LP')
    ]

    const tokenManagerTUP = await ethers.getContract("TokenManagerTUP");

    let calldata = web3Abi.encodeFunctionCall(
        PangolinIntermediaryArtifact.abi.find(method => method.name === 'initialize'),
        [pangolinRouter, tokenManagerTUP.address, pangolinSupportedAssets.map(asset => asset.assetAddress)]
    )

    await verifyContract(hre, {
        address: (await ethers.getContract("PangolinIntermediaryTUP")).address,
        contract: "contracts/proxies/tup/avalanche/PangolinIntermediaryTUP.sol:PangolinIntermediaryTUP",
        constructorArguments: [
            (await ethers.getContract("PangolinIntermediary")).address,
            admin,
            calldata
        ]
    });

    await verifyContract(hre, {
        address: (await ethers.getContract("PangolinIntermediary")).address,
        contract: `contracts/integrations/avalanche/PangolinIntermediary.sol:PangolinIntermediary`,
    })

    const traderJoeRouter = "0x60aE616a2155Ee3d9A68541Ba4544862310933d4";

    const traderJoeSupportedAssets = [
        asset('AVAX'),
        asset('USDC'),
        asset('BTC'),
        asset('ETH'),
        asset('USDT'),
        asset('sAVAX'),
        asset('PTP'),
        asset('QI'),
        asset('TJ_AVAX_USDC_LP'),
        asset('TJ_AVAX_USDT_LP'),
        asset('TJ_AVAX_ETH_LP'),
        asset('TJ_AVAX_BTC_LP'),
        asset('TJ_AVAX_sAVAX_LP'),
    ]

    calldata = web3Abi.encodeFunctionCall(
        TraderJoeIntermediaryArtifact.abi.find(method => method.name === 'initialize'),
        [traderJoeRouter, tokenManagerTUP.address, traderJoeSupportedAssets.map(asset => asset.assetAddress)]
    )

    await verifyContract(hre, {
        address: (await ethers.getContract("TraderJoeIntermediaryTUP")).address,
        contract: "contracts/proxies/tup/avalanche/TraderJoeIntermediaryTUP.sol:TraderJoeIntermediaryTUP",
        constructorArguments: [
            (await ethers.getContract("TraderJoeIntermediary")).address,
            admin,
            calldata
        ]
    });

    await verifyContract(hre, {
        address: (await ethers.getContract("TraderJoeIntermediary")).address,
        contract: `contracts/integrations/avalanche/TraderJoeIntermediary.sol:TraderJoeIntermediary`,
    })

    await verifyContract(hre, {
        address: (await ethers.getContract("SmartLoansFactory")).address,
        contract: `contracts/SmartLoansFactory.sol:SmartLoansFactory`,
    })

    console.log(`-> ${(await ethers.getContract("SmartLoansFactory")).address}`)
    console.log(`-> ${admin}`)

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

    const diamondAddress = (await ethers.getContract("SmartLoanDiamondBeacon")).address

    calldata = web3Abi.encodeFunctionCall(
        initializeInterface,
        [diamondAddress]
    )

    await verifyContract(hre, {
        address: (await ethers.getContract("SmartLoansFactoryTUP")).address,
        contract: `contracts/proxies/tup/SmartLoansFactoryTUP.sol:SmartLoansFactoryTUP`,
        constructorArguments: [
            (await ethers.getContract("SmartLoansFactory")).address,
            admin,
            calldata
        ]
    })

    await verifyContract(hre, {
        address: (await ethers.getContract("VectorFinanceFacet")).address,
        contract: `contracts/facets/avalanche/VectorFinanceFacet.sol:VectorFinanceFacet`,
    })

    await verifyContract(hre, {
        address: (await ethers.getContract("YieldYakFacet")).address,
        contract: `contracts/facets/avalanche/YieldYakFacet.sol:YieldYakFacet`,
    })

    await verifyContract(hre, {
        address: (await ethers.getContract("SmartLoanDiamondBeacon")).address,
        contract: `contracts/SmartLoanDiamondBeacon.sol:SmartLoanDiamondBeacon`,
        constructorArguments: [
            deployer,
            (await ethers.getContract("DiamondCutFacet")).address
        ]
    })

    await verifyContract(hre, {
        address: (await ethers.getContract("SolvencyFacetProdAvalanche")).address,
        contract: `contracts/facets/avalanche/SolvencyFacetProdAvalanche.sol:SolvencyFacetProdAvalanche`,
    })

    await verifyContract(hre, {
        address: (await ethers.getContract("AssetsOperationsFacet")).address,
        contract: `contracts/facets/AssetsOperationsFacet.sol:AssetsOperationsFacet`,
    })

    await verifyContract(hre, {
        address: (await ethers.getContract("DiamondCutFacet")).address,
        contract: `contracts/facets/DiamondCutFacet.sol:DiamondCutFacet`,
    })

    await verifyContract(hre, {
        address: (await ethers.getContract("DiamondInit")).address,
        contract: `contracts/facets/DiamondInit.sol:DiamondInit`,
    })

    await verifyContract(hre, {
        address: (await ethers.getContract("DiamondLoupeFacet")).address,
        contract: `contracts/facets/DiamondLoupeFacet.sol:DiamondLoupeFacet`,
    })

    await verifyContract(hre, {
        address: (await ethers.getContract("OwnershipFacet")).address,
        contract: `contracts/facets/OwnershipFacet.sol:OwnershipFacet`,
    })

    await verifyContract(hre, {
        address: (await ethers.getContract("WavaxVariableUtilisationRatesCalculator")).address
    });

    await verifyContract(hre, {
        address: (await ethers.getContract("UsdcVariableUtilisationRatesCalculator")).address
    });

    await verifyContract(hre, {
        address: (await ethers.getContract("PangolinDEXFacet")).address,
        contract: `contracts/facets/avalanche/PangolinDEXFacet.sol:PangolinDEXFacet`,
    })

    await verifyContract(hre, {
        address: (await ethers.getContract("SmartLoanLiquidationFacet")).address,
        contract: `contracts/facets/SmartLoanLiquidationFacet.sol:SmartLoanLiquidationFacet`,
    })

    await verifyContract(hre, {
        address: (await ethers.getContract("SmartLoanViewFacet")).address,
        contract: `contracts/facets/SmartLoanViewFacet.sol:SmartLoanViewFacet`,
    })

    await verifyContract(hre, {
        address: (await ethers.getContract("SmartLoanWrappedNativeTokenFacet")).address,
        contract: `contracts/facets/SmartLoanWrappedNativeTokenFacet.sol:SmartLoanWrappedNativeTokenFacet`,
    })

    await verifyContract(hre, {
        address: (await ethers.getContract("TraderJoeDEXFacet")).address,
        contract: `contracts/facets/avalanche/TraderJoeDEXFacet.sol:TraderJoeDEXFacet`,
    })

    await verifyContract(hre, {
        address: (await ethers.getContract("TokenManager")).address,
        contract: `contracts/TokenManager.sol:TokenManager`,
    })

    const wavaxPoolTUP = await ethers.getContract("WavaxPoolTUP");
    const usdcPoolTUP = await ethers.getContract("UsdcPoolTUP");

    let lendingPools = [
        pool("AVAX", wavaxPoolTUP.address),
        pool("USDC", usdcPoolTUP.address)
    ];

    calldata = web3Abi.encodeFunctionCall(
        TokenManagerArtifact.abi.find(method => method.name === 'initialize'),
        [supportedAssetsAvax, lendingPools]
    )

    await verifyContract(hre, {
        address: (await ethers.getContract("TokenManagerTUP")).address,
        contract: `contracts/proxies/tup/TokenManagerTUP.sol:TokenManagerTUP`,
        constructorArguments: [
            (await ethers.getContract("TokenManager")).address,
            admin,
            calldata
        ]
    });

    await verifyContract(hre, {
        address: (await ethers.getContract("UsdcBorrowIndex")).address,
        contract: `contracts/deployment/avalanche/UsdcBorrowIndex.sol:UsdcBorrowIndex`,
    })

    await verifyContract(hre, {
        address: (await ethers.getContract("UsdcBorrowIndexTUP")).address,
        contract: `contracts/proxies/tup/avalanche/UsdcBorrowIndexTUP.sol:UsdcBorrowIndexTUP`,
        constructorArguments: [
            (await ethers.getContract("UsdcBorrowIndex")).address,
            admin,
            []
        ]
    });

    await verifyContract(hre, {
        address: (await ethers.getContract("UsdcDepositIndex")).address,
        contract: `contracts/deployment/avalanche/UsdcDepositIndex.sol:UsdcDepositIndex`,
    })

    await verifyContract(hre, {
        address: (await ethers.getContract("UsdcDepositIndexTUP")).address,
        contract: `contracts/proxies/tup/avalanche/UsdcDepositIndexTUP.sol:UsdcDepositIndexTUP`,
        constructorArguments: [
            (await ethers.getContract("UsdcDepositIndexTUP")).address,
            admin,
            []
        ]
    });

    await verifyContract(hre, {
        address: (await ethers.getContract("UsdcPoolFactory")).address,
        contract: `contracts/deployment/avalanche/UsdcPoolFactory.sol:UsdcPoolFactory`,
    })

    await verifyContract(hre, {
        address: (await ethers.getContract("WavaxPoolFactory")).address,
        contract: `contracts/deployment/avalanche/WavaxPoolFactory.sol:WavaxPoolFactory`,
    })

    await verifyContract(hre, {
        address: (await ethers.getContract("WavaxBorrowIndex")).address,
        contract: `contracts/deployment/avalanche/WavaxBorrowIndex.sol:WavaxBorrowIndex`,
    })

    await verifyContract(hre, {
        address: (await ethers.getContract("WavaxDepositIndex")).address,
        contract: `contracts/deployment/avalanche/WavaxDepositIndex.sol:WavaxDepositIndex`,
    })

    await verifyContract(hre, {
        address: (await ethers.getContract("WavaxBorrowIndexTUP")).address,
        contract: `contracts/proxies/tup/avalanche/WavaxBorrowIndexTUP.sol:WavaxBorrowIndexTUP`,
        constructorArguments: [
            (await ethers.getContract("WavaxBorrowIndexTUP")).address,
            admin,
            []
        ]
    });

    await verifyContract(hre, {
        address: (await ethers.getContract("WavaxDepositIndexTUP")).address,
        contract: `contracts/proxies/tup/avalanche/WavaxDepositIndexTUP.sol:WavaxDepositIndexTUP`,
        constructorArguments: [
            (await ethers.getContract("WavaxDepositIndexTUP")).address,
            admin,
            []
        ]
    });

};


module.exports.tags = ['verify-contracts'];
