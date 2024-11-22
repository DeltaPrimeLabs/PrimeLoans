import {ethers, network, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import { constructSimpleSDK, ContractMethod, SimpleFetchSDK, SwapSide } from '@paraswap/sdk';
import axios from 'axios';

import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import AddressProviderArtifact from '../../../artifacts/contracts/AddressProvider.sol/AddressProvider.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
    addMissingTokenContracts,
    Asset,
    calculateStakingTokensAmountBasedOnAvaxValue,
    convertAssetsListToSupportedAssets,
    convertTokenPricesMapToMockPrices,
    deployAllFacets,
    deployAndInitExchangeContract,
    deployPools, erc20ABI, fromBytes32,
    fromWei,
    getFixedGasSigners,
    getRedstonePrices,
    getTokensPricesMap,
    PoolAsset,
    PoolInitializationObject,
    recompileConstantsFile,
    toBytes32,
    toWei,
    parseParaSwapRouteData,
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import {parseUnits} from "ethers/lib/utils";
import {
    AddressProvider,
    MockTokenManager,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
} from "../../../typechain";
import {BigNumber, Contract} from "ethers";
import {deployDiamond, replaceFacet} from '../../../tools/diamond/deploy-diamond';
import TOKEN_ADDRESSES from "../../../common/addresses/avax/token_addresses.json";
import web3Abi from "web3-eth-abi";

chai.use(solidity);

const {deployContract, provider} = waffle;
const ggAvaxTokenAddress = "0x231d84C37b2C4B5a2E2Fe325BB77DAa65bF71D92";
const yyAvaxTokenAddress = "0x720158c329E6558287c4539b0Ed21742B0B73436";
const sAvaxTokenAddress = "0xf9aE6D2D56f02304f72dcC61694eAD0dC8DB51f7";

describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('A loan with staking operations', () => {
        let smartLoansFactory: SmartLoansFactory,
            ggAvaxTokenContract: Contract,
            yyAvaxTokenContract: Contract,
            sAvaxTokenContract: Contract,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            nonOwnerWrappedLoan: any,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            liquidator: SignerWithAddress,
            vault: SignerWithAddress,
            diamondAddress: any,
            MOCK_PRICES: any,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            paraSwapMin: SimpleFetchSDK,
            tokensPrices: Map<string, number>;

        const getSwapData = async (srcToken: keyof typeof TOKEN_ADDRESSES, srcDecimals: number, destToken: keyof typeof TOKEN_ADDRESSES, destDecimals: number, srcAmount: any) => {
            const priceRoute = await paraSwapMin.swap.getRate({
                srcToken: TOKEN_ADDRESSES[srcToken],
                srcDecimals,
                destToken: TOKEN_ADDRESSES[destToken],
                destDecimals,
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

        before("deploy factory and pool", async () => {
            [owner, depositor, liquidator] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'ggAVAX', 'yyAVAX', 'sAVAX', 'USDC', 'BAL_ggAVAX_AVAX', 'BAL_yyAVAX_AVAX', 'BAL_sAVAX_AVAX'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]},
            ];

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor);
            tokensPrices = await getTokensPricesMap(
                assetsList,
                "avalanche",
                getRedstonePrices,
            );
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList);
            addMissingTokenContracts(tokenContracts, assetsList);

            ggAvaxTokenContract = new ethers.Contract(ggAvaxTokenAddress, erc20ABI, provider);
            yyAvaxTokenContract = new ethers.Contract(yyAvaxTokenAddress, erc20ABI, provider);
            sAvaxTokenContract = new ethers.Contract(sAvaxTokenAddress, erc20ABI, provider);

            let tokenManager = await deployContract(
                owner,
                MockTokenManagerArtifact,
                []
            ) as MockTokenManager;

            await tokenManager.connect(owner).initialize(supportedAssets, lendingPools);
            await tokenManager.connect(owner).setFactoryAddress(smartLoansFactory.address);

            await tokenManager.setDebtCoverageStaked(toBytes32("BAL_GG_AVAX_MAIN"), toWei("0.8333333333333333"));
            await tokenManager.setDebtCoverageStaked(toBytes32("BAL_YY_AVAX_MAIN"), toWei("0.8333333333333333"));
            await tokenManager.setDebtCoverageStaked(toBytes32("BAL_S_AVAX_MAIN"), toWei("0.8333333333333333"));

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
                .wrap(loan.connect(liquidator))
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });
        });

        it("should fund a loan and swap to ggAVAX, yyAVAX, sAVAX", async () => {
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.equal(1.157920892373162e+59);

            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("200")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("200"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("200"));
            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("300"));

            let swapData = await getSwapData('AVAX', 18, 'yyAVAX', 18, toWei('50'));
            console.log('swap 1')
            await wrappedLoan.paraSwapV2(swapData.selector, swapData.data, TOKEN_ADDRESSES['AVAX'], toWei('50'), TOKEN_ADDRESSES['yyAVAX'], 1);

            console.log('swap 2')
            swapData = await getSwapData('AVAX', 18, 'ggAVAX', 18, toWei('50'));
            await wrappedLoan.paraSwapV2(swapData.selector, swapData.data, TOKEN_ADDRESSES['AVAX'], toWei('50'), TOKEN_ADDRESSES['ggAVAX'], 1);

            // console.log('swap 3')
            // swapData = await getSwapData('AVAX', 18, 'sAVAX', 18, toWei('50'));
            // await wrappedLoan.paraSwapV2(swapData.selector, swapData.data, TOKEN_ADDRESSES['AVAX'], toWei('50'), TOKEN_ADDRESSES['sAVAX'], 1);
        });

        it("should fail to stake as a non-owner", async () => {
            //https://docs.balancer.fi/reference/joins-and-exits/pool-joins.html#userdata
            await expect(nonOwnerWrappedLoan.joinPoolAndStakeBalancerV2(
                [
                    "0xc13546b97b9b1b15372368dc06529d7191081f5b00000000000000000000001d",
                    [
                        "0xA25EaF2906FA1a3a13EdAc9B9657108Af7B703e3",
                        "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
                    ],
                    [
                        toWei("10"), //try with no
                        0
                    ],
                    //TODO: check slippage
                    toWei('0.0001')
                ]
            )).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.stakeBalancerV2(
                "0xc13546b97b9b1b15372368dc06529d7191081f5b00000000000000000000001d",
                toWei("10"),
            )).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to unstake as a non-owner", async () => {
            //https://docs.balancer.fi/reference/joins-and-exits/pool-joins.html#userdata
            await expect(nonOwnerWrappedLoan.unstakeAndExitPoolBalancerV2(
                [
                    "0xc13546b97b9b1b15372368dc06529d7191081f5b00000000000000000000001d",
                    "0xA25EaF2906FA1a3a13EdAc9B9657108Af7B703e3",
                    toWei("9"), //max. slippage = 10%,
                    await ggAvaxTokenContract.balanceOf(wrappedLoan.address)
                ]
            )).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.unstakeBalancerV2(
                "0xc13546b97b9b1b15372368dc06529d7191081f5b00000000000000000000001d",
                toWei("10"),
            )).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should stake ggAVAX in Balancer vault", async () => {
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let initialStakedBalance = await ggAvaxTokenContract.balanceOf(wrappedLoan.address);
            expect(initialStakedBalance).to.be.equal(0);

            let hmBefore = fromWei(await wrappedLoan.getHealthMeter());
            console.log("Health meter before: ", hmBefore);

            await wrappedLoan.joinPoolAndStakeBalancerV2(
                [
                    "0xc13546b97b9b1b15372368dc06529d7191081f5b00000000000000000000001d",
                    [
                        "0xA25EaF2906FA1a3a13EdAc9B9657108Af7B703e3",
                        "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
                    ],
                    [
                        toWei("40"), //try with no
                        0
                    ],
                    //TODO: check slippage
                    toWei('0.0001')
                ]
            );
            let hmAfter = fromWei(await wrappedLoan.getHealthMeter());
            console.log("Health meter after: ", hmAfter);
            expect(hmAfter).to.be.closeTo(hmBefore, 0.01);

            let balanceAfterStake = fromWei(await ggAvaxTokenContract.balanceOf(wrappedLoan.address));
            expect(balanceAfterStake).to.be.gt(0);

            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 1);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
        });

        it("should unstake ggAVAX from Balancer vault", async () => {
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let initialStakedBalance = await ggAvaxTokenContract.balanceOf(wrappedLoan.address);
            let initialNotStakedBalance = await tokenContracts.get('BAL_ggAVAX_AVAX')!.balanceOf(wrappedLoan.address);
            expect(initialStakedBalance).to.be.gt(0);
            expect(initialNotStakedBalance).to.be.equal(0);

            let hmBefore = fromWei(await wrappedLoan.getHealthMeter());
            console.log("Health meter before: ", hmBefore);

            await wrappedLoan.unstakeBalancerV2(
                "0xc13546b97b9b1b15372368dc06529d7191081f5b00000000000000000000001d",
                initialStakedBalance,
            );
            let hmAfter = fromWei(await wrappedLoan.getHealthMeter());
            console.log("Health meter after: ", hmAfter);
            expect(hmAfter).to.be.closeTo(hmBefore, 0.01);

            let balanceAfterStake = fromWei(await ggAvaxTokenContract.balanceOf(wrappedLoan.address));
            let finalNonStakedBalance = await tokenContracts.get('BAL_ggAVAX_AVAX')!.balanceOf(wrappedLoan.address);
            expect(balanceAfterStake).to.be.eq(0);
            expect(finalNonStakedBalance).to.be.equal(initialStakedBalance);

            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 1);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
        });
    });
});
