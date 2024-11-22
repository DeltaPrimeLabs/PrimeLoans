import {traderJoeAssets} from "../../common/addresses/avax/traderjoe_supported_assets";
import TraderJoeIntermediaryArtifact
    from "../../artifacts/contracts/integrations/avalanche/TraderJoeIntermediary.sol/TraderJoeIntermediary.json";

const web3Abi  = require('web3-eth-abi');
const {ethers} = require("hardhat");
const {embedCommitHash} = require("../../tools/scripts/embed-commit-hash");

const traderJoeRouter = "0x60aE616a2155Ee3d9A68541Ba4544862310933d4";

module.exports = async ({
    getNamedAccounts,
    deployments
}) => {
    const {deploy} = deployments;
    const {deployer, admin} = await getNamedAccounts();

    embedCommitHash('TraderJoeIntermediary', './contracts/integrations/avalanche');
    embedCommitHash('TraderJoeIntermediaryTUP', './contracts/proxies/tup/avalanche');

    let resultImpl = await deploy('TraderJoeIntermediary', {
        from: deployer,
        gasLimit: 8000000,
        args: [],
    });

    console.log(`TraderJoeIntermediary implementation deployed at address: ${resultImpl.address} by a factory`);

    const exchange = await ethers.getContract("TraderJoeIntermediary");

    const tokenManagerTUP = await ethers.getContract("TokenManagerTUP");

    const calldata = web3Abi.encodeFunctionCall(
        TraderJoeIntermediaryArtifact.abi.find(method => method.name === 'initialize'),
        [traderJoeRouter, tokenManagerTUP.address, traderJoeAssets.map(asset => asset.assetAddress)]
    )

    let resultTup = await deploy('TraderJoeIntermediaryTUP', {
        from: deployer,
        gasLimit: 8000000,
        args: [exchange.address, admin, calldata],
    });

    console.log(`TraderJoeIntermediaryTUP deployed at address: ${resultTup.address} by a factory`);

};

module.exports.tags = ['avalanche'];
