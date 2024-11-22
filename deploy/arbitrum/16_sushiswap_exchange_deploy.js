import {sushiswapAssets} from "../../common/addresses/arbitrum/sushiswap_supported_assets";
import SushiSwapIntermediaryArtifact
    from "../../artifacts/contracts/integrations/arbitrum/SushiSwapIntermediary.sol/SushiSwapIntermediary.json";
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

const web3Abi  = require('web3-eth-abi');
const {ethers} = require("hardhat");
const {embedCommitHash} = require("../../tools/scripts/embed-commit-hash");

const sushiswapRouter = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506";

module.exports = async ({
                            getNamedAccounts,
                            deployments
                        }) => {
    const {deploy} = deployments;
    const {deployer, admin} = await getNamedAccounts();

    embedCommitHash('SushiSwapIntermediary', './contracts/integrations/arbitrum');
    embedCommitHash('SushiSwapIntermediaryTUP', './contracts/proxies/tup/arbitrum');

    const tokenManagerTUP = await ethers.getContract("TokenManagerTUP");

    let resultImpl = await deploy('SushiSwapIntermediary', {
        from: deployer,
        gasLimit: 30000000,
        args: [],
    });

    await verifyContract(hre,
        {
            address: resultImpl.address,
            contract: `contracts/integrations/arbitrum/SushiSwapIntermediary.sol:SushiSwapIntermediary`,
            constructorArguments: []
        });
    console.log(`Verified SushiSwapIntermediary`);

    console.log(`SushiSwapIntermediary implementation deployed at address: ${resultImpl.address}`);

    const exchange = await ethers.getContract("SushiSwapIntermediary");

    const calldata = web3Abi.encodeFunctionCall(
        SushiSwapIntermediaryArtifact.abi.find(method => method.name === 'initialize'),
        [sushiswapRouter, tokenManagerTUP.address, sushiswapAssets.map(asset => asset.assetAddress)]
    )

    let resultTup = await deploy('SushiSwapIntermediaryTUP', {
        from: deployer,
        gasLimit: 8000000,
        args: [exchange.address, admin, calldata],
    });

    await verifyContract(hre,
        {
            address: resultTup.address,
            contract: `contracts/proxies/tup/arbitrum/SushiSwapIntermediaryTUP.sol:SushiSwapIntermediaryTUP`,
            constructorArguments: [exchange.address, admin, calldata]
        });
    console.log(`Verified SushiSwapIntermediary`);

    console.log(`SushiSwapIntermediaryTUP deployed at address: ${resultTup.address}`);

};

module.exports.tags = ['arbitrum-sushi'];
