import {ethers} from "hardhat";

import CACHE_LAYER_URLS from '../../common/redstone-cache-layer-urls.json';
import {supportedAssetsAvax} from "../../common/addresses/avax/avalanche_supported_assets";
import {erc20ABI, formatUnits, fromBytes32, fromWei, StakedPosition, toBytes32, toWei} from "../../test/_helpers";
import TOKEN_ADDRESSES from "../../common/addresses/avax/token_addresses.json";
import IYieldYak from "../../artifacts/contracts/interfaces/facets/avalanche/IYieldYak.sol/IYieldYak.json";

const path = require("path");
const fs = require('fs');

const {getUrlForNetwork} = require("../scripts/helpers");
const {WrapperBuilder} = require("@redstone-finance/evm-connector");
const sdk = require("redstone-sdk");
const supportedTokensList = supportedAssetsAvax.map(asset => fromBytes32(asset.asset))

export async function awaitConfirmation(tx, provider, actionName, timeout) {
    const transaction = await provider.waitForTransaction(tx.hash, 1, timeout);
    if (transaction.status === 0) {
        console.log(transaction);
        throw `Failed to ${actionName}`;
    } else {
        console.log(`Transaction with ${transaction.transactionHash} success`);
        return transaction;
    }
}

export async function unstakeYieldYak(loan, liquidator_wallet, provider){
    console.log('Check staked YieldYak')
    try{
        let contract = new ethers.Contract(TOKEN_ADDRESSES.YY_AAVE_AVAX, IYieldYak.abi, liquidator_wallet);
        let balance = await contract.balanceOf(loan.address);
        let decimals = await contract.decimals();
        if(formatUnits(balance, decimals) > 0){
            console.log('Unstaking YY_AAVE_AVAX');
            await awaitConfirmation(await loan.unstakeAVAXYak(balance, {gasLimit: 8_000_000, gasPrice: 100_000_000_000}), provider, 'Unstake YY_AAVE', 60_000);
        }

        contract = new ethers.Contract(TOKEN_ADDRESSES.YY_PTP_sAVAX, IYieldYak.abi, liquidator_wallet);
        balance = await contract.balanceOf(loan.address);
        decimals = await contract.decimals();
        if(formatUnits(balance, decimals) > 0){
            console.log('Unstaking YY_PTP_sAVAX');
            await awaitConfirmation(await loan.unstakeSAVAXYak(balance, {gasLimit: 8_000_000, gasPrice: 100_000_000_000}), provider, 'Unstake YY_PTP_sAVAX', 60_000);
        }

        contract = new ethers.Contract(TOKEN_ADDRESSES.YY_PNG_AVAX_USDC_LP, IYieldYak.abi, liquidator_wallet);
        balance = await contract.balanceOf(loan.address);
        decimals = await contract.decimals();
        if(formatUnits(balance, decimals) > 0){
            console.log('Unstaking YY_PNG_AVAX_USDC_LP');
            await awaitConfirmation(await loan.unstakePNGAVAXUSDCYak(balance, {gasLimit: 8_000_000, gasPrice: 100_000_000_000}), provider, 'Unstake PNG_AVAX_USDC_LP', 60_000);
        }

        contract = new ethers.Contract(TOKEN_ADDRESSES.YY_PNG_AVAX_ETH_LP, IYieldYak.abi, liquidator_wallet);
        balance = await contract.balanceOf(loan.address);
        decimals = await contract.decimals();
        if(formatUnits(balance, decimals) > 0){
            console.log('Unstaking YY_PNG_AVAX_ETH_LP');
            await awaitConfirmation(await loan.unstakePNGAVAXETHYak(balance, {gasLimit: 8_000_000, gasPrice: 100_000_000_000}), provider, 'Unstake YY_PNG_AVAX_ETH_LP', 60_000);
        }

        contract = new ethers.Contract(TOKEN_ADDRESSES.YY_TJ_AVAX_USDC_LP, IYieldYak.abi, liquidator_wallet);
        balance = await contract.balanceOf(loan.address);
        decimals = await contract.decimals();
        if(formatUnits(balance, decimals) > 0){
            console.log('Unstaking YY_TJ_AVAX_USDC_LP');
            await awaitConfirmation(await loan.unstakeTJAVAXUSDCYak(balance, {gasLimit: 8_000_000, gasPrice: 100_000_000_000}), provider, 'Unstake YY_TJ_AVAX_UDC_LP', 60_000);
        }

        contract = new ethers.Contract(TOKEN_ADDRESSES.YY_TJ_AVAX_ETH_LP, IYieldYak.abi, liquidator_wallet);
        balance = await contract.balanceOf(loan.address);
        decimals = await contract.decimals();
        if(formatUnits(balance, decimals) > 0){
            console.log('Unstaking YY_TJ_AVAX_ETH_LP');
            await awaitConfirmation(await loan.unstakeTJAVAXETHYak(balance, {gasLimit: 8_000_000, gasPrice: 100_000_000_000}), provider, 'Unstake YY_TJ_AVAX_ETH_LP', 60_000);
        }

        contract = new ethers.Contract(TOKEN_ADDRESSES.YY_TJ_AVAX_sAVAX_LP, IYieldYak.abi, liquidator_wallet);
        balance = await contract.balanceOf(loan.address);
        decimals = await contract.decimals();
        if(formatUnits(balance, decimals) > 0){
            console.log('Unstaking YY_TJ_AVAX_sAVAX_LP');
            await awaitConfirmation(await loan.unstakeTJAVAXSAVAXYak(balance, {gasLimit: 8_000_000, gasPrice: 100_000_000_000}), provider, 'Unstake YY_TJ_AVAX_sAVAX_LP', 60_000);
        }

        contract = new ethers.Contract(TOKEN_ADDRESSES.YY_GLP, IYieldYak.abi, liquidator_wallet);
        balance = await contract.balanceOf(loan.address);
        decimals = await contract.decimals();
        if(formatUnits(balance, decimals) > 0){
            console.log('Unstaking YY_GLP');
            await awaitConfirmation(await loan.unstakeGLPYak(balance, {gasLimit: 8_000_000, gasPrice: 100_000_000_000}), provider, 'Unstake YY_GLP', 60_000);
        }
    } catch (e) {
        console.log(`YieldYak-Error: ${e}`);
    }
}


export async function unwindPangolinLPPositions(loan, liquidator_wallet, provider){
    console.log('Check LP Pangolin')
    try{
        // PNG_AVAX_USDC_LP
        let contract = await getERC20Contract(TOKEN_ADDRESSES.PNG_AVAX_USDC_LP, liquidator_wallet);
        let balance = await contract.balanceOf(loan.address);
        let decimals = await contract.decimals();
        if(formatUnits(balance, decimals) > 0){
            console.log('Unwinding PNG_AVAX_USDC_LP');
            await awaitConfirmation(await loan.removeLiquidityPangolin(toBytes32("AVAX"), toBytes32("USDC"), balance, 1, 1, {gasLimit: 8_000_000, gasPrice: 100_000_000_000}), provider, 'Unstake PNG_AVAX_USDC_LP', 60_000);
        }

        // PNG_AVAX_USDT_LP
        contract = await getERC20Contract(TOKEN_ADDRESSES.PNG_AVAX_USDT_LP, liquidator_wallet);
        balance = await contract.balanceOf(loan.address);
        decimals = await contract.decimals();
        if(formatUnits(balance, decimals) > 0) {
            console.log('Unwinding PNG_AVAX_USDT_LP');
            await awaitConfirmation(await loan.removeLiquidityPangolin(toBytes32("AVAX"), toBytes32("USDT"), balance, 1, 1, {gasLimit: 8_000_000, gasPrice: 100_000_000_000}), provider, 'Unstake PNG_AVAX_USDT_LP', 60_000);
        }

        // PNG_AVAX_ETH_LP
        contract = await getERC20Contract(TOKEN_ADDRESSES.PNG_AVAX_ETH_LP, liquidator_wallet);
        balance = await contract.balanceOf(loan.address);
        decimals = await contract.decimals();
        if(formatUnits(balance, decimals) > 0) {
            console.log('Unwinding PNG_AVAX_ETH_LP');
            await awaitConfirmation(await loan.removeLiquidityPangolin(toBytes32("AVAX"), toBytes32("ETH"), balance, 1, 1, {gasLimit: 8_000_000, gasPrice: 100_000_000_000}), provider, 'Unstake PNG_AVAX_ETH_LP', 60_000);
        }
    } catch (e) {
        console.log(`Pangolin-Error: ${e}`);
    }
}

export async function unstakeGlp(loan, liquidator_wallet, provider){
    console.log('Check GLP');
    try{
        // GLP
        let contract = await getERC20Contract(TOKEN_ADDRESSES.GLP, liquidator_wallet);
        let balance = await contract.balanceOf(loan.address);
        let decimals = await contract.decimals();
        if(formatUnits(balance, decimals) > 0) {
            console.log('Unwinding GLP');
            await awaitConfirmation(await loan.unstakeAndRedeemGlp(TOKEN_ADDRESSES["AVAX"], balance, 1, {gasLimit: 8_000_000, gasPrice: 100_000_000_000}), provider, 'Unstake GLP', 60_000);
        }
    } catch (e) {
        console.log(`GLP-Error: ${e}`);
    }
}


export async function unwindTraderJoeLPPositions(loan, liquidator_wallet, provider){
    console.log('Check LP TraderJoe');
    try{
        // TJ_AVAX_USDC_LP
        let contract = await getERC20Contract(TOKEN_ADDRESSES.TJ_AVAX_USDC_LP, liquidator_wallet);
        let balance = await contract.balanceOf(loan.address);
        let decimals = await contract.decimals();
        if(formatUnits(balance, decimals) > 0) {
            console.log('Unwinding TJ_AVAX_USDC_LP');
            await awaitConfirmation(await loan.removeLiquidityTraderJoe(toBytes32("AVAX"), toBytes32("USDC"), balance, 1, 1, {gasLimit: 8_000_000, gasPrice: 100_000_000_000}), provider, 'Unstake TJ_AVAX_UDSC_PL', 60_000);
        }

        // TJ_AVAX_USDT_LP
        contract = await getERC20Contract(TOKEN_ADDRESSES.TJ_AVAX_USDT_LP, liquidator_wallet);
        balance = await contract.balanceOf(loan.address);
        decimals = await contract.decimals();
        if(formatUnits(balance, decimals) > 0) {
            console.log('Unwinding TJ_AVAX_USDT_LP');
            await awaitConfirmation(await loan.removeLiquidityTraderJoe(toBytes32("AVAX"), toBytes32("USDT"), balance, 1, 1, {gasLimit: 8_000_000, gasPrice: 100_000_000_000}), provider, 'Unstake TJ_AVAX_USDT_LP', 60_000);
        }

        // TJ_AVAX_ETH_LP
        contract = await getERC20Contract(TOKEN_ADDRESSES.TJ_AVAX_ETH_LP, liquidator_wallet);
        balance = await contract.balanceOf(loan.address);
        decimals = await contract.decimals();
        if(formatUnits(balance, decimals) > 0) {
            console.log('Unwinding TJ_AVAX_ETH_LP');
            await awaitConfirmation(await loan.removeLiquidityTraderJoe(toBytes32("AVAX"), toBytes32("ETH"), balance, 1, 1, {gasLimit: 8_000_000, gasPrice: 100_000_000_000}), provider, 'Unstake TJ_AVAX_ETH_LP', 60_000);
        }

        // TJ_AVAX_BTC_LP
        contract = await getERC20Contract(TOKEN_ADDRESSES.TJ_AVAX_BTC_LP, liquidator_wallet);
        balance = await contract.balanceOf(loan.address);
        decimals = await contract.decimals();
        if(formatUnits(balance, decimals) > 0) {
            console.log('Unwinding TJ_AVAX_BTC_LP');
            await awaitConfirmation(await loan.removeLiquidityTraderJoe(toBytes32("AVAX"), toBytes32("BTC"), balance, 1, 1, {gasLimit: 8_000_000, gasPrice: 100_000_000_000}), provider, 'Unstake TJ_AVAX_BTC_LP', 60_000);
        }

        // TJ_AVAX_sAVAX_LP
        contract = await getERC20Contract(TOKEN_ADDRESSES.TJ_AVAX_sAVAX_LP, liquidator_wallet);
        balance = await contract.balanceOf(loan.address);
        decimals = await contract.decimals();
        if(formatUnits(balance, decimals) > 0) {
            console.log('Unwinding TJ_AVAX_sAVAX_LP');
            await awaitConfirmation(await loan.removeLiquidityTraderJoe(toBytes32("AVAX"), toBytes32("sAVAX"), balance, 1, 1, {gasLimit: 8_000_000, gasPrice: 100_000_000_000}), provider, 'Unstake TJ_AVAX_sAVAX_LP', 60_000);
        }
    } catch (e) {
        console.log(`TraderJoe-Error: ${e}`);
    }
}


export async function unstakeStakedPositions(loan, provider){
    console.log('Check staked postitions');
    try{
        for (let p of await loan.getStakedPositions()) {
            let stakedPosition = new StakedPosition(p[0], fromBytes32(p[1]), fromBytes32(p[2]), p[3], p[4]);

            let balanceMethod = loan.interface.getFunction(stakedPosition.balanceSelector);
            let unstakeMethod = loan.interface.getFunction(stakedPosition.unstakeSelector);

            if(fromBytes32(stakedPosition.symbol) !== "USDC") {
                await awaitConfirmation(await loan[unstakeMethod.name](await loan[balanceMethod.name](), toWei("0"), {
                    gasLimit: 8_000_000,
                    gasPrice: 100_000_000_000
                }), provider, 'UnstakeStakedPostisions', 60_000);
            }
        }
    } catch (e) {
        console.log(`StakedPositions-Error: ${e}`);
    }
}


export function getLiquidatorSigner(network) {
    // 0xe8D4E496ef28A0A6E0F2ce7805ff12482D8FdCE6
    const LIQUIDATOR_PRIVATE_KEY = fs.readFileSync(path.resolve(__dirname, "./.private-liquidator")).toString().trim();
    const RPC_URL = getUrlForNetwork(network);

    let provider = new ethers.providers.JsonRpcProvider(RPC_URL)
    return (new ethers.Wallet(LIQUIDATOR_PRIVATE_KEY)).connect(provider);
}

// TODO: Refactor once new liq bots architecture will be in place

export function getLiquidatorSigner2(network) {
    // 0xCD7D50FDD7481C3ffdeBc4F4d35B8C508986F5aa
    const LIQUIDATOR_PRIVATE_KEY = fs.readFileSync(path.resolve(__dirname, "./.private-liquidator2")).toString().trim();
    const RPC_URL = getUrlForNetwork(network);

    let provider = new ethers.providers.JsonRpcProvider(RPC_URL)
    return (new ethers.Wallet(LIQUIDATOR_PRIVATE_KEY)).connect(provider);
}

export function getProvider(network) {
    const RPC_URL = getUrlForNetwork(network);

    return new ethers.providers.JsonRpcProvider(RPC_URL)
}

export async function wrapLoan(loanAddress, wallet) {
    let loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loanAddress, wallet);

    loan = WrapperBuilder.wrap(loan).usingDataService(
        {
            dataServiceId: "redstone-avalanche-prod",
            uniqueSignersCount: 3,
            dataFeeds: supportedTokensList,
            // @ts-ignore
            disablePayloadsDryRun: true
        },
        CACHE_LAYER_URLS.urls
    );

    return loan
}

export function wrapContractProd(contract) {
    return WrapperBuilder.wrap(contract).usingDataService(
        {
            dataServiceId: "redstone-avalanche-prod",
            uniqueSignersCount: 3,
            dataFeeds: supportedTokensList,
            // @ts-ignore
            disablePayloadsDryRun: true
        },
        CACHE_LAYER_URLS.urls
    );
}

export async function getSignedDataPackagesResponse() {
    return await sdk.requestDataPackages({
            dataServiceId: "redstone-avalanche-prod",
            uniqueSignersCount: 3,
            dataFeeds: supportedTokensList,
        },
        CACHE_LAYER_URLS.urls
    );
}

export function getERC20Contract(address, wallet) {
    return new ethers.Contract(address, erc20ABI, wallet);
}