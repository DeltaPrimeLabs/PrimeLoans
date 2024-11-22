const hre = require("hardhat");
module.exports = async ({
                            getNamedAccounts,
                            deployments
                        }) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();

    let result = await deploy('YieldYakRouter', {
        from: deployer,
        gasLimit: 8000000
    });

    console.log(`Deployed YieldYakRouter implementation at address: ${result.address}`);
};

module.exports.tags = ['yak-staking'];
