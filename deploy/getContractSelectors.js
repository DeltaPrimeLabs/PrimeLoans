const {getContractSelectors} = require("../tools/scripts/signatures");
const {ethers} = require("hardhat");


module.exports = async ({
                            getNamedAccounts,
                            deployments
                        }) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();
    getContractSelectors('Pool', deployer);
};

module.exports.tags = ['getSelector']