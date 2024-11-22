const { embedCommitHash } = require("../../tools/scripts/embed-commit-hash");
const {ethers} = require("hardhat");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  embedCommitHash(
    "WethVariableUtilisationRatesCalculator",
    "./contracts/deployment/arbitrum"
  );

  let result = await deploy("WethVariableUtilisationRatesCalculator", {
    from: deployer,
    gasLimit: 8000000,
    args: [],
  });

  console.log(
    `Deployed WethVariableUtilisationRatesCalculator at address: ${result.address}`
  );

  embedCommitHash(
    "UsdcVariableUtilisationRatesCalculator",
    "./contracts/deployment/arbitrum"
  );

  result = await deploy("UsdcVariableUtilisationRatesCalculator", {
    contract: "contracts/deployment/arbitrum/UsdcVariableUtilisationRatesCalculator.sol:UsdcVariableUtilisationRatesCalculator",
    from: deployer,
    gasLimit: 8000000,
    args: [],
  });

  console.log(
    `Deployed UsdcVariableUtilisationRatesCalculator at address: ${result.address}`
  );
};

module.exports.tags = ["arbitrum-x1"];
