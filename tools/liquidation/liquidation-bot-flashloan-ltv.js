import TOKEN_MANAGER from '../../artifacts/contracts/TokenManager.sol/TokenManager.json';
import LIQUIDATION_FLASHLOAN from '../../artifacts/contracts/LiquidationFlashloan.sol/LiquidationFlashloan.json';
import addresses from '../../common/addresses/avax/token_addresses.json';
import TOKEN_ADDRESSES from '../../common/addresses/avax/token_addresses.json';
import {
    fromBytes32,
    getLiquidationAmounts,
    getLiquidationAmountsBasedOnLtv, getRedstonePrices,
    getTokensPricesMap
} from "../../test/_helpers";
import {ethers} from 'hardhat'
import {
    awaitConfirmation,
    getERC20Contract,
    getLiquidatorSigner2,
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

let liquidator_wallet = getLiquidatorSigner2(network);
let provider = getProvider(network);


function getTokenManager(tokenManagerAddress) {
    return new ethers.Contract(tokenManagerAddress, TOKEN_MANAGER.abi, liquidator_wallet);
}

export async function liquidateLoan(loanAddress, flashLoanAddress, tokenManagerAddress, ltvBasedCalculation = true) {
    let loan = await wrapLoan(loanAddress, liquidator_wallet);
    let tokenManager = getTokenManager(tokenManagerAddress);
    let poolTokens = await tokenManager.getAllPoolAssets();
    let poolTokenAddresses = await Promise.all(poolTokens.map(el => tokenManager.getAssetAddress(el, true)));

    const healthBeforeLiquidation = fromWei(await loan.getHealthRatio());

    if (healthBeforeLiquidation < 0.98) {


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

        for (const allowance of deliveredAmounts) {
            let tokenContract = await getERC20Contract(addresses[allowance.name], liquidator_wallet);
            let decimals = await tokenContract.decimals();
            let delivered = parseUnits((Number(1.001 * allowance.amount).toFixed(decimals) ?? 0).toString(), decimals);
            await tokenContract.connect(liquidator_wallet).approve(loan.address, delivered, {gasLimit: 8000000, gasPrice: 100_000_000_000});
        }

        const bonusInWei = (bonus * 1000).toFixed(0);

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
            let flashLoanTx = await awaitConfirmation(await flashLoan.executeFlashloan(
                {
                    assets: poolTokenAddresses,
                    amounts: amountsToRepayInWei,
                    interestRateModes: new Array(poolTokenAddresses.length).fill(0),
                    params: '0x' + redstonePayload,
                    bonus: bonusInWei,
                    liquidator: liquidator_wallet.address,
                    loanAddress: loanAddress,
                    tokenManager: tokenManager.address
                }, {
                    gasLimit: 8_000_000,
                    gasPrice: 100_000_000_000
                }
                ),
                provider,
                'flash loan liquidation',
                60_000);

            console.log(`[${liqStartTime.toLocaleTimeString()}] Waiting for flashLoanTx: ${flashLoanTx.hash}`);

            let receipt = await provider.waitForTransaction(flashLoanTx.hash);
            console.log(`Sellout processed with ${receipt.status == 1 ? "success" : "failure"} in ${(new Date() - liqStartTime) / 1000} seconds.`);
        } catch (error) {
            console.log(error)
        }
    }


    } else {
        console.log('Loan on the edge of solvency, aborting liquidation.')
    }

}
