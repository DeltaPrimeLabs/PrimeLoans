import {ethers, waffle} from 'hardhat';
import chai from 'chai';
import {BigNumber, Contract} from 'ethers';
import {solidity} from "ethereum-waffle";
import { constructSimpleSDK, ContractMethod, SimpleFetchSDK, SwapSide } from '@paraswap/sdk';
import axios from 'axios';

import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import AddressProviderArtifact from '../../../artifacts/contracts/AddressProvider.sol/AddressProvider.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
    AddressProvider,
    MockTokenManager,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
} from '../../../typechain';
import {
    deployPools,
    addMissingTokenContracts,
    Asset,
    convertAssetsListToSupportedAssets,
    convertTokenPricesMapToMockPrices,
    deployAllFacets,
    erc20ABI,
    formatUnits,
    fromBytes32,
    fromWei,
    getFixedGasSigners,
    getRedstonePrices,
    syncTime,
    toBytes32,
    toWei,
    wavaxAbi,
    getTokensPricesMap,
    PoolAsset,
    PoolInitializationObject,
    recompileConstantsFile,
    parseParaSwapRouteData
} from "../../_helpers";
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import {parseUnits} from "ethers/lib/utils";
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';
import TOKEN_ADDRESSES from '../../../common/addresses/avax/token_addresses.json';

chai.use(solidity);

const {deployContract, provider} = waffle;
const {expect} = chai;

describe('ParaSwap', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('Test buying and selling an asset', () => {
        let smartLoansFactory: SmartLoansFactory,
            loan: SmartLoanGigaChadInterface,
            nonOwnerWrappedLoan: any,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            tokensPrices: Map<string, number>,
            wrappedLoan: any,
            owner: SignerWithAddress,
            nonOwner: SignerWithAddress,
            depositor: SignerWithAddress,
            paraSwapMin: SimpleFetchSDK,
            MOCK_PRICES: any,
            diamondAddress: any;

        const getSwapData = async (srcToken: keyof typeof TOKEN_ADDRESSES, destToken: keyof typeof TOKEN_ADDRESSES, srcAmount: any, destAmount: any) => {
            const priceRoute = await paraSwapMin.swap.getRate({
                srcToken: TOKEN_ADDRESSES[srcToken],
                destToken: TOKEN_ADDRESSES[destToken],
                amount: srcAmount.toString(),
                userAddress: wrappedLoan.address,
                side: SwapSide.SELL,
            });
            const txParams = await paraSwapMin.swap.buildTx({
                srcToken: priceRoute.srcToken,
                destToken: priceRoute.destToken,
                srcAmount: priceRoute.srcAmount,
                slippage: 300,
                priceRoute,
                userAddress: wrappedLoan.address,
                partner: 'anon',
            }, {
                ignoreChecks: true,
            });
            const swapData = parseParaSwapRouteData(txParams);
            return swapData;
        };

        before('deploy factory and pool', async () => {
            [owner, nonOwner, depositor] = await getFixedGasSigners(10000000);

            let assetsList = ['AVAX', 'USDC', 'ETH'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]}
            ];

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor, 2000);

            tokensPrices = await getTokensPricesMap(assetsList, "avalanche", getRedstonePrices, []);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList);
            addMissingTokenContracts(tokenContracts, assetsList.filter(asset => !Array.from(tokenContracts.keys()).includes(asset)));

            let tokenManager = await deployContract(
                owner,
                MockTokenManagerArtifact,
                []
            ) as MockTokenManager;

            await tokenManager.connect(owner).initialize(supportedAssets, lendingPools);
            await tokenManager.connect(owner).setFactoryAddress(smartLoansFactory.address);

            await smartLoansFactory.initialize(diamondAddress, tokenManager.address);

            let addressProvider = await deployContract(
                owner,
                AddressProviderArtifact,
                []
            ) as AddressProvider;

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [],
                tokenManager.address,
                addressProvider.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib'
            );

            await deployAllFacets(diamondAddress)

            paraSwapMin = constructSimpleSDK({chainId: 43114, axios});
        });

        it("should deploy a smart loan", async () => {
            await smartLoansFactory.connect(owner).createLoan();
            const loan_proxy_address = await smartLoansFactory.getLoanForOwner(owner.address);
            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, owner);

            wrappedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan)
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });

            nonOwnerWrappedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan.connect(nonOwner))
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });
        });

        it("should fund a loan", async () => {
            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("100")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("100"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("100"));
        });

        it("should fail to swap as a non-owner", async () => {
            const swapData = await getSwapData('AVAX', 'USDC', toWei('10'), 1);
            await expect(nonOwnerWrappedLoan.paraSwapV2(swapData.selector, swapData.data, TOKEN_ADDRESSES['AVAX'], toWei('10'), TOKEN_ADDRESSES['USDC'], 1)).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it('should swap funds: AVAX -> USDC', async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            expect(await loanOwnsAsset("USDC")).to.be.false;

            let minOut = parseUnits((tokensPrices.get("AVAX")! * 9.8).toFixed(6), 6);
            const swapData = await getSwapData('AVAX', 'USDC', toWei('10'), minOut);
            await wrappedLoan.paraSwapV2(swapData.selector, swapData.data, TOKEN_ADDRESSES['AVAX'], toWei('10'), TOKEN_ADDRESSES['USDC'], minOut);

            expect(await loanOwnsAsset("USDC")).to.be.true;

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue, 1.0);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.eq(initialHR);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 1.0);
        });

        it('should swap funds: USDC -> ETH', async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            expect(await loanOwnsAsset("ETH")).to.be.false;
            let usdcBalance = await wrappedLoan.getBalance(toBytes32('USDC'));

            let minOut = formatUnits(usdcBalance, 6) * tokensPrices.get("USDC")! / tokensPrices.get("ETH")!;
            minOut = toWei((minOut * 0.98).toString());
            const swapData = await getSwapData('USDC', 'ETH', usdcBalance, minOut);

            await wrappedLoan.paraSwapV2(swapData.selector, swapData.data, TOKEN_ADDRESSES['USDC'], usdcBalance, TOKEN_ADDRESSES['ETH'], minOut);

            expect(await loanOwnsAsset("USDC")).to.be.false;
            expect(await loanOwnsAsset("ETH")).to.be.true;

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue, 1.0);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.eq(initialHR);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 1.0);
        });

        it('should swap half funds: ETH -> USDC', async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            expect(await loanOwnsAsset("USDC")).to.be.false;
            let ethBalance = await wrappedLoan.getBalance(toBytes32('ETH'));
            let swapAmount = ethBalance.div(2);

            let minOut: any = formatUnits(swapAmount, 18) * tokensPrices.get("ETH")!;
            minOut = parseUnits((minOut * 0.98).toFixed(6), 6);
            const swapData = await getSwapData('ETH', 'USDC', swapAmount, minOut);

            await wrappedLoan.paraSwapV2(swapData.selector, swapData.data, TOKEN_ADDRESSES['ETH'], swapAmount, TOKEN_ADDRESSES['USDC'], minOut);

            expect(await loanOwnsAsset("ETH")).to.be.true;
            expect(await loanOwnsAsset("USDC")).to.be.true;

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue, 1.0);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.eq(initialHR);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 1.0);
        });

        it('should swap half funds: ETH -> USDC', async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            expect(await loanOwnsAsset("USDC")).to.be.true;
            let ethBalance = await wrappedLoan.getBalance(toBytes32('ETH'));

            let minOut = formatUnits(ethBalance, 18) * tokensPrices.get("ETH")!;
            parseUnits((minOut * 0.98).toFixed(6), 6)
            const swapData = await getSwapData('ETH', 'USDC', ethBalance, minOut);

            await wrappedLoan.paraSwapV2(swapData.selector, swapData.data, TOKEN_ADDRESSES['ETH'], ethBalance, TOKEN_ADDRESSES['USDC'], minOut);

            expect(await loanOwnsAsset("ETH")).to.be.false;
            expect(await loanOwnsAsset("USDC")).to.be.true;

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue, 1.0);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.eq(initialHR);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 1.0);
        });

        async function loanOwnsAsset(asset: string) {
            let ownedAssets =  await wrappedLoan.getAllOwnedAssets();
            for(const ownedAsset of ownedAssets){
                if(fromBytes32(ownedAsset) == asset){
                    return true;
                }
            }
            return false;
        }
    });
});
