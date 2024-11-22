const {embedCommitHash} = require("../../tools/scripts/embed-commit-hash");

module.exports = async ({
  getNamedAccounts,
  deployments
}) => {
  const {deploy} = deployments;
  const {deployer} = await getNamedAccounts();

  embedCommitHash('WavaxVariableUtilisationRatesCalculator', './contracts/deployment/avalanche');

  let result = await deploy('WavaxVariableUtilisationRatesCalculator', {
    from: deployer,
    gasLimit: 8000000,
    args: []
  });

  console.log(`Deployed WavaxVariableUtilisationRatesCalculator at address: ${result.address}`);


  embedCommitHash('UsdcVariableUtilisationRatesCalculator', './contracts/deployment/avalanche');

  result = await deploy('UsdcVariableUtilisationRatesCalculator', {
    from: deployer,
    gasLimit: 8000000,
    args: []
  });

  console.log(`Deployed UsdcVariableUtilisationRatesCalculator at address: ${result.address}`);
};

module.exports.tags = ['updated-rates-1'];
