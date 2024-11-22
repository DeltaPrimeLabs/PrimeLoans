import {pangolinAssets} from "../../common/addresses/avax/pangolin_supported_assets";
import PangolinIntermediaryArtifact
    from "../../artifacts/contracts/integrations/avalanche/PangolinIntermediary.sol/PangolinIntermediary.json";

const web3Abi  = require('web3-eth-abi');
const {ethers} = require("hardhat");
const {embedCommitHash} = require("../../tools/scripts/embed-commit-hash");

const pangolinRouter = "0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106";

module.exports = async ({
    getNamedAccounts,
    deployments
}) => {
    const {deploy} = deployments;
    const {deployer, admin} = await getNamedAccounts();

    embedCommitHash('PangolinIntermediary', './contracts/integrations/avalanche');
    embedCommitHash('PangolinIntermediaryTUP', './contracts/proxies/tup/avalanche');

    let resultImpl = await deploy('PangolinIntermediary', {
        from: deployer,
        gasLimit: 8000000,
        args: [],
    });

    console.log(`PangolinIntermediary implementation deployed at address: ${resultImpl.address} by a factory`);

    const exchange = await ethers.getContract("PangolinIntermediary");

    const tokenManagerTUP = await ethers.getContract("TokenManagerTUP");

    const calldata = web3Abi.encodeFunctionCall(
        PangolinIntermediaryArtifact.abi.find(method => method.name === 'initialize'),
        [pangolinRouter, tokenManagerTUP.address, pangolinAssets.map(asset => asset.assetAddress)]
    )

    let resultTup = await deploy('PangolinIntermediaryTUP', {
        from: deployer,
        gasLimit: 8000000,
        args: [exchange.address, admin, calldata],
    });

    console.log(`PangolinIntermediaryTUP deployed at address: ${resultTup.address} by a factory`);

};

module.exports.tags = ['avalanche'];
