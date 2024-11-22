import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import { deployDiamond } from "../../tools/diamond/deploy-diamond";
import { deployAllFacets, recompileConstantsFile } from "../../test/_helpers";
import web3Abi from "web3-eth-abi";

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer, admin } = await getNamedAccounts();

  embedCommitHash("SmartLoanDiamondBeacon");
  embedCommitHash("DeploymentConstants", "contracts/lib/arbitrum");
  embedCommitHash("DiamondStorageLib", "contracts/lib");

  embedCommitHash("SmartLoansFactory");
  embedCommitHash("SmartLoansFactoryTUP", "./contracts/proxies/tup");

  let smartLoansFactory = await deploy("SmartLoansFactory", {
    from: deployer,
    gasLimit: 50000000,
    args: [],
  });

  const initializeInterface = {
    inputs: [
      {
        internalType: "contract SmartLoan",
        name: "_smartLoanImplementation",
        type: "address",
      },
    ],
    name: "initialize",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  };

  const diamondAddress = await deployDiamond({
    deployer: deployer,
    deploy: deploy,
  });

  const calldata = web3Abi.encodeFunctionCall(initializeInterface, [
    diamondAddress,
  ]);

  let resultTup = await deploy("SmartLoansFactoryTUP", {
    from: deployer,
    gasLimit: 50000000,
    args: [smartLoansFactory.address, admin, calldata],
  });

  console.log(
    `SmartLoansFactory implementation deployed at address: ${resultTup.address}`
  );

  const tokenManager = await ethers.getContract("TokenManagerTUP");
  const addressProvider = await ethers.getContract("AddressProviderTUP");

  await recompileConstantsFile(
    "arbitrum",
    "DeploymentConstants",
    [],
    tokenManager.address,
    addressProvider.address,
    diamondAddress,
    resultTup.address,
    "lib",
    5000,
    "1.042e18",
    100,
    "ARBI"
  );


  //TODO: verify code
  await deployAllFacets(diamondAddress, false, "ARBITRUM", {
    deployer: deployer,
    deploy: deploy,
  });


  //TODO: verify contracts
  console.log(`Deployed SmartLoanDiamondBeacon at address: ${diamondAddress}`);
};

module.exports.tags = ["arbitrum-x66"];
