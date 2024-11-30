const { embedCommitHash } = require("../../tools/scripts/embed-commit-hash");
const {ethers} = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
const hre = require("hardhat");
const OwnableArtifact = require("../../artifacts/@openzeppelin/contracts/access/Ownable.sol/Ownable.json");
const PoolArtifact = require("../../artifacts/contracts/Pool.sol/Pool.json");

const MULTISIG_OWNER = "0xDfA6706FC583b635CD6daF0E3915901A2fBaBAaD";
const MULTISIG_ADMIN = "0xa9Ca8462aB2949ADa86297904e09Ab4Eb12cdCf0";
const SMART_LOANS_FACTORY = "0xFf5e3dDaefF411a1dC6CcE00014e4Bca39265c20";
let deploymentHisotryConfig = []
let acceptOwnershipNeeded = []

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const deploymentConfig = [
        // {
        //     ratesCalculatorName: "WethVariableUtilisationRatesCalculatorFixedRate",
        //     poolTupName: "WethPoolTUP",
        //     poolContractName: "WethPool",
        //     depositIndexName: "WethDepositIndex",
        //     borrowIndexName: "WethBorrowIndex",
        //     tokenAddress: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"
        // },
        // {
        //     ratesCalculatorName: "ArbVariableUtilisationRatesCalculatorFixedRate",
        //     poolTupName: "ArbPoolTUP",
        //     poolContractName: "ArbPool",
        //     depositIndexName: "ArbDepositIndex",
        //     borrowIndexName: "ArbBorrowIndex",
        //     tokenAddress: "0x912CE59144191C1204E64559FE8253a0e49E6548"
        // },
        {
            ratesCalculatorName: "BtcVariableUtilisationRatesCalculatorFixedRate",
            poolTupName: "BtcPoolTUP",
            poolContractName: "BtcPool",
            depositIndexName: "BtcDepositIndex",
            borrowIndexName: "BtcBorrowIndex",
            tokenAddress: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f"
        },
        // {
        //     ratesCalculatorName: "DaiVariableUtilisationRatesCalculatorFixedRate",
        //     poolTupName: "DaiPoolTUP",
        //     poolContractName: "DaiPool",
        //     depositIndexName: "DaiDepositIndex",
        //     borrowIndexName: "DaiBorrowIndex",
        //     tokenAddress: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1"
        // },
        // {
        //     ratesCalculatorName: "UsdcVariableUtilisationRatesCalculatorFixedRate",
        //     poolTupName: "UsdcPoolTUP",
        //     poolContractName: "UsdcPool",
        //     depositIndexName: "UsdcDepositIndex",
        //     borrowIndexName: "UsdcBorrowIndex",
        //     tokenAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
        // }
    ]

    for(const poolConfig of deploymentConfig){
        await performFullPoolDeploymentAndInitialization(
            deploy,
            deployer,
            poolConfig.ratesCalculatorName,
            poolConfig.poolTupName,
            poolConfig.poolContractName,
            poolConfig.depositIndexName,
            poolConfig.borrowIndexName,
            poolConfig.tokenAddress
        );
    }

    console.log("Deployment history config:");
    for(const poolDeploymentConfig of deploymentHisotryConfig){
        console.log(poolDeploymentConfig);
    }
    console.log("Accept ownership needed:");
    for(const acceptOwnership of acceptOwnershipNeeded){
        console.log(acceptOwnership);
    }

};

async function performFullPoolDeploymentAndInitialization(deploy, deployer, ratesCalculatorName, poolTupName, poolContractName, depositIndexName, borrowIndexName, tokenAddress){
    let poolDeploymentConfig = {}

    let ratesCalculator = await deployContractWithOwnershipTransfer(
        deploy,
        deployer,
        ratesCalculatorName,
        "./contracts/deployment/arbitrum",
        [],
        MULTISIG_OWNER
    );
    poolDeploymentConfig.ratesCalculator = ratesCalculator.address;

    let poolImplementation = await deployContractWithOwnershipTransfer(
        deploy,
        deployer,
        poolContractName,
        "./contracts/deployment/arbitrum",
        [],
        undefined
    );

    poolDeploymentConfig.poolImplementation = poolImplementation.address;

    let poolTUP = await deployPoolTUPWithImplementationAndMultisigAdmin(deploy, deployer, poolTupName, poolImplementation.address);

    poolDeploymentConfig.poolTUP = poolTUP.address;

    let [depositIndexTUPAddress, depositIndexImpl] = await deployLinearIndex(depositIndexName, poolTUP.address, deploy, deployer, MULTISIG_ADMIN);
    poolDeploymentConfig.depositIndexTUPAddress = depositIndexTUPAddress;
    poolDeploymentConfig.depositIndexImpl = depositIndexImpl;

    let [borrowIndexTUPAddress, borrowIndexImpl] = await deployLinearIndex(borrowIndexName, poolTUP.address, deploy, deployer, MULTISIG_ADMIN);
    poolDeploymentConfig.borrowIndexTUPAddress = borrowIndexTUPAddress;
    poolDeploymentConfig.borrowIndexImpl = borrowIndexImpl;

    await initializePoolTUPAndProposeOwnershipTransferToMultisig(
        deploy,
        deployer,
        poolTUP,
        poolTupName,
        poolImplementation.address,
        poolContractName,
        ratesCalculator.address,
        SMART_LOANS_FACTORY,
        depositIndexTUPAddress,
        borrowIndexTUPAddress,
        tokenAddress,
        ethers.constants.AddressZero,
        0
    );

    poolDeploymentConfig.borrowersRegistry = SMART_LOANS_FACTORY;
    poolDeploymentConfig.tokenAddress = tokenAddress;
    poolDeploymentConfig.poolRewarder = ethers.constants.AddressZero;
    poolDeploymentConfig.totalSupplyCap = 0;

    deploymentHisotryConfig.push(poolDeploymentConfig);

}

async function deployLinearIndex(name, poolTupAddress, deploy, deployer, admin) {
    let resultIndex = await deploy(name, {
        contract: `contracts/deployment/arbitrum/${name}.sol:${name}`,
        from: deployer,
        gasLimit: 50000000,
        args: [],
    });

    console.log(`Deployed linear index at address: ${resultIndex.address}`);

    //sleep 1 second
    await new Promise(r => setTimeout(r, 1000));
    await verifyContract(hre,
        {
            address: resultIndex.address,
            contract: `contracts/deployment/arbitrum/${name}.sol:${name}`,
            constructorArguments: []
        });
    console.log(`Verified ${name}`)

    let resultTUP = await deploy(`${name}TUP`, {
        contract: `contracts/proxies/tup/arbitrum/${name}TUP.sol:${name}TUP`,
        from: deployer,
        gasLimit: 50000000,
        args: [resultIndex.address, admin, []],
    });

    console.log(`${name}TUP deployed at address: ${resultTUP.address}`);

    //sleep 1 second
    await new Promise(r => setTimeout(r, 1000));
    await verifyContract(hre,
        {
            address: resultTUP.address,
            contract: `contracts/proxies/tup/arbitrum/${name}TUP.sol:${name}TUP`,
            constructorArguments: [resultIndex.address, admin, []]
        });
    console.log(`Verified ${name}TUP.sol`)

    const index = await ethers.getContractFactory(`./contracts/deployment/arbitrum/${name}.sol:${name}`);

    let initializeTx = await index.attach(resultTUP.address).initialize(
        poolTupAddress,
        { gasLimit: 50000000 }
    );

    console.log(`Initializing ${name} with poolTupAddress: ${poolTupAddress} as the owner`);

    let txResult = await initializeTx.wait();
    if(txResult.status === 0) {
        throw new Error('FAILURE');
    } else {
        console.log('SUCCESS');
    }

    return [resultTUP.address, resultIndex.address];
}

async function deployPoolTUPWithImplementationAndMultisigAdmin(deploy, deployer, TUPName, poolImplementationAddress){
    console.log(`Embedding commit hash for ${TUPName}`);
    embedCommitHash(
        TUPName,
        "./contracts/proxies/tup/arbitrum"
    );

    console.log(`Deploying ${TUPName}`);
    let resultTUPContract = await deploy(TUPName, {
        contract: `contracts/proxies/tup/arbitrum/${TUPName}.sol:${TUPName}`,
        from: deployer,
        args: [poolImplementationAddress, MULTISIG_ADMIN, []],
    });
    console.log(
        `Deployed ${TUPName} at address: ${resultTUPContract.address} with TUP admin: ${MULTISIG_ADMIN}`
    );

    //sleep 1 second
    await new Promise(r => setTimeout(r, 1000));
    await verifyContract(hre,
        {
            address: resultTUPContract.address,
            contract: `contracts/proxies/tup/arbitrum/${TUPName}.sol:${TUPName}`,
            constructorArguments: [poolImplementationAddress, MULTISIG_ADMIN, []]
        });
    console.log(`Verified ${TUPName}`)


    return resultTUPContract;
}

async function initializePoolTUPAndProposeOwnershipTransferToMultisig(
    deploy,
    deployer,
    TUPContract,
    TUPName,
    poolImplementationAddress,
    poolImplementationName,
    ratesCalculatorAddress,
    borrowersRegistryAddress,
    depositIndexAddress,
    borrowIndexAddress,
    tokenAddress,
    poolRewarderAddress,
    totalSupplyCap
){
    console.log(`Initializing ${TUPName}`);
    let TUPAsPool = await ethers.getContractAt(PoolArtifact.abi, TUPContract.address);
    let tx = await TUPAsPool.initialize(
        ratesCalculatorAddress,
        borrowersRegistryAddress,
        depositIndexAddress,
        borrowIndexAddress,
        tokenAddress,
        poolRewarderAddress,
        totalSupplyCap
    );
    let txResult = await tx.wait();
    if(txResult.status === 0) {
        throw new Error(`Failed to initialize ${TUPName} with:
          ratesCalculatorAddress: ${ratesCalculatorAddress},
          borrowersRegistryAddress: ${borrowersRegistryAddress},
          depositIndexAddress: ${depositIndexAddress},
          borrowIndexAddress: ${borrowIndexAddress},
          tokenAddress: ${tokenAddress},
          poolRewarderAddress: ${poolRewarderAddress},
          totalSupplyCap: ${totalSupplyCap} - txResult: ${Object.entries(txResult)}`);
    } else {
        console.log(`
          Initialized ${TUPName} with:
          ratesCalculatorAddress: ${ratesCalculatorAddress},
          borrowersRegistryAddress: ${borrowersRegistryAddress},
          depositIndexAddress: ${depositIndexAddress},
          borrowIndexAddress: ${borrowIndexAddress},
          tokenAddress: ${tokenAddress},
          poolRewarderAddress: ${poolRewarderAddress},
          totalSupplyCap: ${totalSupplyCap}
        `);
    }

    console.log(`Going to propose ownership transfer to ${MULTISIG_OWNER}`)
    tx = await TUPAsPool.transferOwnership(MULTISIG_OWNER);
    txResult = await tx.wait();
    if(txResult.status === 0) {
        throw new Error(`Failed to propose ownership transfer of ${TUPName} to ${MULTISIG_OWNER}`);
    } else {
        console.log(`Ownership of ${TUPName} transfer to ${MULTISIG_OWNER} was PROPOSED. Now ${MULTISIG_OWNER} needs to ACCEPT IT by calling .acceptOwnership() on ${TUPAsPool.address}`);
        acceptOwnershipNeeded.push(`MULTISIG ${MULTISIG_OWNER} needs to accept ownership of ${TUPName} at ${TUPAsPool.address}!`);
    }

}

async function deployContractWithOwnershipTransfer(deploy, deployer, contractName, contractPath, args, transferOwnershipTo = undefined){
    console.log(`Embedding commit hash for ${contractName}`);
    embedCommitHash(
        contractName,
        contractPath
    );

    console.log(`Deploying ${contractName}`);
    let result = await deploy(contractName, {
        contract: `${contractPath}/${contractName}.sol:${contractName}`,
        from: deployer,
        args: args,
    });
    console.log(
        `Deployed ${contractName} at address: ${result.address}`
    );

    //sleep 1 second
    await new Promise(r => setTimeout(r, 1000));
    await verifyContract(hre,
        {
            address: result.address,
            contract: `contracts/deployment/arbitrum/${contractName}.sol:${contractName}`,
            constructorArguments: args
        });
    console.log(`Verified ${contractName}`)

    if(transferOwnershipTo !== undefined){
        let ownableContract = await ethers.getContractAt(OwnableArtifact.abi, result.address);
        console.log(`Transferring ownership of ${contractName} to ${transferOwnershipTo}`);
        let tx = await ownableContract.transferOwnership(transferOwnershipTo);
        let txResult = await tx.wait();
        if(txResult.status === 0) {
            throw new Error(`Failed to transfer ownership of ${contractName} to ${transferOwnershipTo}`);
        } else {
            console.log(`Ownership of ${contractName} transferred to ${transferOwnershipTo}`);
        }
    }

    return result;
}

module.exports.tags = ["arbitrum-full-pools-redeployment"];
