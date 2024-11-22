import {embedCommitHash} from "../../tools/scripts/embed-commit-hash";
import {pool, toWei} from "../../test/_helpers";
import web3Abi from "web3-eth-abi";
import TokenManagerArtifact from "../../artifacts/contracts/TokenManager.sol/TokenManager.json";
import {supportedAssetsAvax} from "../../common/addresses/avax/avalanche_supported_assets";

const {ethers} = require("hardhat");

module.exports = async ({
                            getNamedAccounts,
                            deployments
                        }) => {
    const {deploy} = deployments;
    const {deployer, admin} = await getNamedAccounts();

    embedCommitHash('TokenManager');

    const wavaxPoolTUP = await ethers.getContract("WavaxPoolTUP");
    const usdcPoolTUP = await ethers.getContract("UsdcPoolTUP");

    let lendingPools = [
        pool("AVAX", wavaxPoolTUP.address),
        pool("USDC", usdcPoolTUP.address)
    ];

    await deploy('TokenManager', {
        from: deployer,
        gasLimit: 8000000,
        args: [],
    });

    let tokenManager = await ethers.getContract("TokenManager");

    console.log(`Deployed tokenManager at address: ${tokenManager.address}`);

    const calldata = web3Abi.encodeFunctionCall(
        TokenManagerArtifact.abi.find(method => method.name === 'initialize'),
        [supportedAssetsAvax, lendingPools]
    )

    let deployedTokenManagerTUP = await deploy('TokenManagerTUP', {
        from: deployer,
        gasLimit: 8000000,
        args: [tokenManager.address, admin, calldata],
    });

    const tokenManagerTUP = await ethers.getContractAt("TokenManager", deployedTokenManagerTUP.address);

    console.log(`Deployed TokenManagerTUP at address: ${tokenManagerTUP.address}`);

};

module.exports.tags = ['avalanche'];
