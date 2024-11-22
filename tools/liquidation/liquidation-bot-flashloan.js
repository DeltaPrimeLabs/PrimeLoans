import TOKEN_MANAGER from '../../artifacts/contracts/TokenManager.sol/TokenManager.json';
import LIQUIDATION_FLASHLOAN from '../../artifacts/contracts/LiquidationFlashloan.sol/LiquidationFlashloan.json';
import addresses from '../../common/addresses/avax/token_addresses.json';
import TOKEN_ADDRESSES from '../../common/addresses/avax/token_addresses.json';
import {
    fromBytes32,
    getLiquidationAmounts,
    getLiquidationAmountsBasedOnLtv, getRedstonePrices,
    getTokensPricesMap,
    toWei,
    yakRouterAbi,
} from "../../test/_helpers";
import {ethers} from 'hardhat'
import {
    awaitConfirmation,
    getERC20Contract,
    getLiquidatorSigner,
    getProvider,
    getSignedDataPackagesResponse, unstakeGlp,
    unstakeStakedPositions,
    unstakeYieldYak,
    unwindPangolinLPPositions,
    unwindTraderJoeLPPositions,
    wrapContractProd,
    wrapLoan
} from "./utlis";
import {BigNumber} from "ethers";

const args = require('yargs').argv;
const network = args.network ? args.network : 'localhost';
const {fromWei, formatUnits} = require("../../test/_helpers");
const {parseUnits} = require("ethers/lib/utils");

const protocol = require("redstone-protocol");

let liquidator_wallet = getLiquidatorSigner(network);
let provider = getProvider(network);

const yakRouterAddress = '0xC4729E56b831d74bBc18797e0e17A295fA77488c';

const yakRouter = new ethers.Contract(
    yakRouterAddress,
    yakRouterAbi,
    provider
);

async function query(tknFrom, tknTo, amountIn) {
    const maxHops = 2
    const gasPrice = await provider.getGasPrice()
    return await yakRouter.findBestPathWithGas(
        amountIn,
        tknFrom,
        tknTo,
        maxHops,
        gasPrice.mul(15).div(10),
        { gasLimit: 1e9 }
    )
}

function getTokenManager(tokenManagerAddress) {
    return new ethers.Contract(tokenManagerAddress, TOKEN_MANAGER.abi, liquidator_wallet);
}

export async function liquidateLoan(loanAddress, flashLoanAddress, tokenManagerAddress, ltvBasedCalculation = false) {
    let loan = await wrapLoan(loanAddress, liquidator_wallet);
    const healthBeforeLiquidation = fromWei(await loan.getHealthRatio());

    if (healthBeforeLiquidation < 0.98) {
        let tokenManager = getTokenManager(tokenManagerAddress);
        let poolTokens = await tokenManager.getAllPoolAssets();
        let poolTokenAddresses = await Promise.all(poolTokens.map(el => tokenManager.getAssetAddress(el, true)));


        //TODO: optimize to unstake only as much as needed
        await unstakeYieldYak(loan, liquidator_wallet, provider);

        await unstakeGlp(loan, liquidator_wallet, provider);

        await unstakeStakedPositions(loan, provider);

        await unwindPangolinLPPositions(loan, liquidator_wallet, provider);

        await unwindTraderJoeLPPositions(loan, liquidator_wallet, provider);


        let pricesArg = {}
        let tokensPrices = await getTokensPricesMap(Object.keys(TOKEN_ADDRESSES), "avalanche", getRedstonePrices, []);
        for (const asset of await tokenManager.getAllPoolAssets()) {
            pricesArg[fromBytes32(asset)] = tokensPrices.get(fromBytes32(asset));
        }

        // const bonus = Math.abs(fromWei(await loan.getTotalValue()) - fromWei(await loan.getDebt())) < 0.1 ? 0 : maxBonus;
        //TODO: calculate in the future - it's needed for the flashloan fees
        const bonus = 0.01;

        const weiDebts = (await loan.getDebts());

        const debts = [];
        for (let debt of weiDebts) {
            let symbol = fromBytes32(debt.name);
            debts.push(
                {
                    name: symbol,
                    debt: formatUnits(debt.debt, await getERC20Contract(TOKEN_ADDRESSES[symbol], liquidator_wallet).decimals())
                });
        }

        const balances = [];

        const weiBalances = (await loan.getAllAssetsBalances());
        for (let balance of weiBalances) {
            let symbol = fromBytes32(balance.name);

            balances.push(
                {
                    name: symbol,
                    //@ts-ignore
                    debtCoverage: fromWei(await tokenManager.debtCoverage(TOKEN_ADDRESSES[symbol])),
                    balance: formatUnits(balance.balance, await getERC20Contract(TOKEN_ADDRESSES[symbol], liquidator_wallet).decimals())
                });
        }

        let loanIsBankrupt = (fromWei(await loan.getTotalValue()) - formatUnits(await loan.vectorUSDC1Balance(), BigNumber.from("6"))) < fromWei(await loan.getDebt());

        if(!loanIsBankrupt){
            let prices = (await loan.getAllAssetsPrices()).map(el => {
                return {
                    dataFeedId: fromBytes32(el.name),
                    value: formatUnits(el.price, 8)
                }
            });
            const pricesMap = {};
            for (const price of prices) {
                pricesMap[price.dataFeedId] = price.value;
            }

            let {repayAmounts, deliveredAmounts} = ltvBasedCalculation ?
                getLiquidationAmountsBasedOnLtv(
                    'LIQUIDATE',
                    debts,
                    balances,
                    prices,
                    4.1,
                    bonus,
                    loanIsBankrupt
                )
                :
                getLiquidationAmounts(
                    'LIQUIDATE',
                    debts,
                    balances,
                    prices,
                    1.04,
                    bonus,
                    loanIsBankrupt
                );

            let amountsToRepayInWei = [];

            for (const repayment of repayAmounts) {
                let tokenContract = await getERC20Contract(addresses[repayment.name], liquidator_wallet);
                let decimals = await tokenContract.decimals();
                amountsToRepayInWei.push(parseUnits((Number(repayment.amount).toFixed(decimals) ?? 0).toString(), decimals));
            }

            const bonusInWei = (bonus * 1000).toFixed(0);

            const remainAssets = [];
            let totalInUSD = 0;
            for (let i = 0; i < balances.length; i++) {
                const totalBalance = balances[i].balance + (deliveredAmounts.find((da) => da.name == balances[i].name)?.amount || 0);
                totalInUSD += totalBalance * prices[i].value;
                const remainBalance = totalBalance - (repayAmounts[i]?.amount || 0);
                if (remainBalance > 0) {
                    remainAssets.push({
                        name: balances[i].name,
                        balance: remainBalance,
                    });
                }
            }
            let suppliedInUSD = 0;
            for (const deliveredAmount of deliveredAmounts) {
                suppliedInUSD += deliveredAmount.amount * pricesMap[deliveredAmount.name];
            }
            const remainInUSD = totalInUSD - suppliedInUSD;
            const partToReturn = suppliedInUSD * (1 + bonus) / remainInUSD;

            const surplusAssets = remainAssets.map(asset => ({
                name: asset.name,
                balance: asset.balance * partToReturn,
            }));

            const offers = [];
            let i = 0;
            for (const deliveredAmount of deliveredAmounts) {
                let expectedReturnInUSD = deliveredAmount.amount * pricesMap[deliveredAmount.name];
                while (expectedReturnInUSD > 0) {
                    const surplusAmountNeeded = Math.min(expectedReturnInUSD / pricesMap[surplusAssets[i].name], surplusAssets[i].balance);
                    let tokenContract = await getERC20Contract(addresses[surplusAssets[i].name], liquidator_wallet);
                    let decimals = await tokenContract.decimals();
                    let amount = parseUnits((surplusAmountNeeded.toFixed(decimals) ?? 0).toString(), decimals);

                    const queryRes = await query(
                        TOKEN_ADDRESSES[surplusAssets[i].name],
                        TOKEN_ADDRESSES[deliveredAmount.name],
                        amount
                    );
                    offers.push({
                        amounts: queryRes.amounts,
                        path: queryRes.path,
                        adapters: queryRes.adapters,
                    });

                    surplusAssets[i].balance -= surplusAmountNeeded;
                    expectedReturnInUSD -= surplusAmountNeeded * pricesMap[surplusAssets[i].name];
                    if (surplusAssets[i].balance == 0) {
                        i++;
                    }
                }
            }

            let flashLoan = wrapContractProd(new ethers.Contract(flashLoanAddress, LIQUIDATION_FLASHLOAN.abi, liquidator_wallet));

            const parseDataPackagesResponse = (
                dataPackagesResponse
            ) => {
                const signedDataPackages = [];
                for (const dpForDataFeed of Object.values(dataPackagesResponse)) {
                    signedDataPackages.push(...dpForDataFeed);
                }
                return signedDataPackages;
            };

            const signedDataPackagesResponse = await getSignedDataPackagesResponse();

            const signedDataPackages = parseDataPackagesResponse(signedDataPackagesResponse);
            const unsignedMetadata = "manual-payload";
            const redstonePayload = protocol.RedstonePayload.prepare(
                signedDataPackages, unsignedMetadata);

            try {
                let liqStartTime = new Date();
                const gasPrice = await provider.getGasPrice()
                let flashLoanTx = await awaitConfirmation(await flashLoan.executeFlashloan(
                    {
                        assets: poolTokenAddresses,
                        amounts: amountsToRepayInWei,
                        interestRateModes: new Array(poolTokenAddresses.length).fill(0),
                        params: '0x' + redstonePayload,
                        bonus: bonusInWei,
                        liquidator: liquidator_wallet.address,
                        loanAddress: loanAddress,
                        tokenManager: tokenManager.address,
                        offers,
                    }, {
                        gasLimit: 8_000_000,
                        gasPrice: gasPrice.mul(15).div(10)
                    }
                    ),
                    provider,
                    'flash loan liquidation',
                    60_000);

                console.log(`[${liqStartTime.toLocaleTimeString()}] Waiting for flashLoanTx: ${flashLoanTx.hash}`);
                console.log(`Sellout processed in ${(new Date() - liqStartTime) / 1000} seconds.`);
            } catch (error) {
                console.log(error)
            }
        }


    } else {
        console.log('Loan on the edge of solvency, aborting liquidation.');
    }
}
