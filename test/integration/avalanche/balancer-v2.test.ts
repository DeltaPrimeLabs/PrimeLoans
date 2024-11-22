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
            await wrappedLoan.paraSwapV2(swapData.selector, swapData.data, TOKEN_ADDRESSES['AVAX'], toWei('50'), TOKEN_ADDRESSES['yyAVAX'], 1);
            swapData = await getSwapData('AVAX', 18, 'ggAVAX', 18, toWei('50'));
            await wrappedLoan.paraSwapV2(swapData.selector, swapData.data, TOKEN_ADDRESSES['AVAX'], toWei('50'), TOKEN_ADDRESSES['ggAVAX'], 1);
            swapData = await getSwapData('AVAX', 18, 'sAVAX', 18, toWei('50'));
            await wrappedLoan.paraSwapV2(swapData.selector, swapData.data, TOKEN_ADDRESSES['AVAX'], toWei('50'), TOKEN_ADDRESSES['sAVAX'], 1);

            // transfer BPTs from whale address for testing
            await network.provider.request({
                method: "hardhat_impersonateAccount",
                params: ["0xBA12222222228d8Ba445958a75a0704d566BF2C8"],
            });
            vault = await ethers.provider.getSigner('0xBA12222222228d8Ba445958a75a0704d566BF2C8');

            await tokenContracts.get('BAL_ggAVAX_AVAX')!.connect(vault).transfer(owner.address, toWei("50"));
            await tokenContracts.get('BAL_ggAVAX_AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("50"));
            await wrappedLoan.fund(toBytes32("BAL_ggAVAX_AVAX"), toWei("50"));
            await tokenContracts.get('BAL_yyAVAX_AVAX')!.connect(vault).transfer(owner.address, toWei("50"));
            await tokenContracts.get('BAL_yyAVAX_AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("50"));
            await wrappedLoan.fund(toBytes32("BAL_yyAVAX_AVAX"), toWei("50"));
            await tokenContracts.get('BAL_sAVAX_AVAX')!.connect(vault).transfer(owner.address, toWei("50"));
            await tokenContracts.get('BAL_sAVAX_AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("50"));
            await wrappedLoan.fund(toBytes32("BAL_sAVAX_AVAX"), toWei("50"));
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

            await wrappedLoan.joinPoolAndStakeBalancerV2(
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
            );

            let balanceAfterStake = fromWei(await ggAvaxTokenContract.balanceOf(wrappedLoan.address));
            expect(balanceAfterStake).to.be.gt(0);

            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 1);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
        });

        it("should stake BAL_ggAVAX_AVAX in Balancer vault", async () => {
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let initialStakedBalance = await ggAvaxTokenContract.balanceOf(wrappedLoan.address);

            await wrappedLoan.stakeBalancerV2(
                "0xc13546b97b9b1b15372368dc06529d7191081f5b00000000000000000000001d",
                toWei("10"),
            );

            let afterStakedBalance = await ggAvaxTokenContract.balanceOf(wrappedLoan.address);
            expect(afterStakedBalance).to.be.gt(initialStakedBalance);

            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 1);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
        });

        it("should claim rewards", async () => {
            await expect(wrappedLoan.claimRewardsBalancerV2(
                "0xc13546b97b9b1b15372368dc06529d7191081f5b00000000000000000000001d",
            )).not.to.be.reverted;
        });

        it("should not allow staking in a non-whitelisted Balancer vault", async () => {
            await expect(wrappedLoan.joinPoolAndStakeBalancerV2(
                [
                    "0xb06fdbd2941d2f42d60accee85086198ac72923600020000000000000000001a",
                    [
                        "0x502580fc390606b47FC3b741d6D49909383c28a9",
                        "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
                    ],
                    [
                        0,
                        toWei("10")
                    ],
                    //TODO: check slippage
                    toWei('0.0001')
                ]
            )).to.be.revertedWith('BalancerV2PoolNotWhitelisted');
        });

        it("should not allow staking a non-whitelisted asset", async () => {
            await expect(wrappedLoan.joinPoolAndStakeBalancerV2(
                [
                    "0xc13546b97b9b1b15372368dc06529d7191081f5b00000000000000000000001d",
                    [
                        "0xA25EaF2906FA1a3a13EdAc9B9657108Af7B703e3",
                        "0x7275c131b1f67e8b53b4691f92b0e35a4c1c6e22",
                    ],
                    [
                        0,
                        toWei("10")
                    ],
                    //TODO: check slippage
                    toWei('0.0001')
                ]
            )).to.be.revertedWith('DepositingInactiveToken');
        });

        it("should unstake part of ggAVAX", async () => {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            await wrappedLoan.unstakeAndExitPoolBalancerV2(
                [
                    "0xc13546b97b9b1b15372368dc06529d7191081f5b00000000000000000000001d",
                    "0xA25EaF2906FA1a3a13EdAc9B9657108Af7B703e3",
                    toWei("9"), //max. slippage = 10%,
                    (await ggAvaxTokenContract.balanceOf(wrappedLoan.address)).sub(toWei("10"))
                ]
            );

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 1);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 1);
        });

        it("should unstake part of BAL_ggAVAX_AVAX", async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            await wrappedLoan.unstakeBalancerV2(
                "0xc13546b97b9b1b15372368dc06529d7191081f5b00000000000000000000001d",
                toWei("10"),
            );

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue, 1);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 1);
        });

        it("should stake yyAVAX in Balancer vault", async () => {
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let initialStakedBalance = await yyAvaxTokenContract.balanceOf(wrappedLoan.address);
            expect(initialStakedBalance).to.be.equal(0);

            await wrappedLoan.joinPoolAndStakeBalancerV2(
                [
                    "0x9fa6ab3d78984a69e712730a2227f20bcc8b5ad900000000000000000000001f",
                    [
                        "0x9fa6ab3d78984a69e712730a2227f20bcc8b5ad9",
                        "0x0000000000000000000000000000000000000000",
                        "0xF7D9281e8e363584973F946201b82ba72C965D27",
                    ],
                    [
                        0,
                        0,
                        toWei("10"), //try with no
                    ],
                    //TODO: check slippage
                    toWei('0.0001')
                ]
            );

            let balanceAfterStake = fromWei(await yyAvaxTokenContract.balanceOf(wrappedLoan.address));
            expect(balanceAfterStake).to.be.gt(0);

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 1);
        });

        it("should stake BAL_yyAVAX_AVAX in Balancer vault", async () => {
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let initialStakedBalance = await yyAvaxTokenContract.balanceOf(wrappedLoan.address);

            await wrappedLoan.stakeBalancerV2(
                "0x9fa6ab3d78984a69e712730a2227f20bcc8b5ad900000000000000000000001f",
                toWei("10"),
            );

            let afterStakedBalance = await yyAvaxTokenContract.balanceOf(wrappedLoan.address);
            expect(afterStakedBalance).to.be.gt(initialStakedBalance);

            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 1);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
        });

        it("should claim rewards", async () => {
            await expect(wrappedLoan.claimRewardsBalancerV2(
                "0x9fa6ab3d78984a69e712730a2227f20bcc8b5ad900000000000000000000001f",
            )).not.to.be.reverted;
        });

        it("should not allow staking in a non-whitelisted Balancer vault", async () => {
            await expect(wrappedLoan.joinPoolAndStakeBalancerV2(
                [
                    "0xb06fdbd2941d2f42d60accee85086198ac72923600020000000000000000001a",
                    [
                        "0x502580fc390606b47FC3b741d6D49909383c28a9",
                        "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
                    ],
                    [
                        0,
                        toWei("10")
                    ],
                    //TODO: check slippage
                    toWei('0.0001')
                ]
            )).to.be.revertedWith('BalancerV2PoolNotWhitelisted');
        });

        it("should not allow staking a non-whitelisted asset", async () => {
            await expect(wrappedLoan.joinPoolAndStakeBalancerV2(
                [
                    "0x9fa6ab3d78984a69e712730a2227f20bcc8b5ad900000000000000000000001f",
                    [
                        "0xF7D9281e8e363584973F946201b82ba72C965D27",
                        "0x7275c131b1f67e8b53b4691f92b0e35a4c1c6e22",
                    ],
                    [
                        0,
                        toWei("10")
                    ],
                    //TODO: check slippage
                    toWei('0.0001')
                ]
            )).to.be.revertedWith('DepositingInactiveToken');
        });

        it("should unstake part of yyAVAX", async () => {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            await wrappedLoan.unstakeAndExitPoolBalancerV2(
                [
                    "0x9fa6ab3d78984a69e712730a2227f20bcc8b5ad900000000000000000000001f",
                    "0xF7D9281e8e363584973F946201b82ba72C965D27",
                    toWei("9"), //max. slippage = 10%,
                    (await yyAvaxTokenContract.balanceOf(wrappedLoan.address)).sub(toWei("10"))
                ]
            );

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 1);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 1);
        });

        it("should unstake part of BAL_yyAVAX_AVAX", async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            await wrappedLoan.unstakeBalancerV2(
                "0x9fa6ab3d78984a69e712730a2227f20bcc8b5ad900000000000000000000001f",
                toWei("10"),
            );

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue, 1);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 1);
        });

        it("should stake sAVAX in Balancer vault", async () => {

            let initialStakedBalance = await sAvaxTokenContract.balanceOf(wrappedLoan.address);
            expect(initialStakedBalance).to.be.equal(0);

            await wrappedLoan.joinPoolAndStakeBalancerV2(
                [
                    "0xfd2620c9cfcec7d152467633b3b0ca338d3d78cc00000000000000000000001c",
                    [
                        "0x2b2c81e08f1af8835a78bb2a90ae924ace0ea4be",
                        "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7"
                    ],
                    [
                        toWei("10"),
                        0
                    ],
                    //TODO: check slippage
                    toWei('0.0001')
                ]
            );

            let balanceAfterStake = fromWei(await sAvaxTokenContract.balanceOf(wrappedLoan.address));
            expect(balanceAfterStake).to.be.gt(0);
        });

        it("should stake BAL_sAVAX_AVAX in Balancer vault", async () => {
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let initialStakedBalance = await sAvaxTokenContract.balanceOf(wrappedLoan.address);

            await wrappedLoan.stakeBalancerV2(
                "0xfd2620c9cfcec7d152467633b3b0ca338d3d78cc00000000000000000000001c",
                toWei("10"),
            );

            let afterStakedBalance = await sAvaxTokenContract.balanceOf(wrappedLoan.address);
            expect(afterStakedBalance).to.be.gt(initialStakedBalance);

            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 1);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
        });

        it("should claim rewards", async () => {
            await expect(wrappedLoan.claimRewardsBalancerV2(
                "0xfd2620c9cfcec7d152467633b3b0ca338d3d78cc00000000000000000000001c",
            )).not.to.be.reverted;
        });

        it("should not allow staking in a non-whitelisted Balancer vault", async () => {
            await expect(wrappedLoan.joinPoolAndStakeBalancerV2(
                [
                    "0xb06fdbd2941d2f42d60accee85086198ac72923600020000000000000000001a",
                    [
                        "0x502580fc390606b47FC3b741d6D49909383c28a9",
                        "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
                    ],
                    [
                        0,
                        toWei("10")
                    ],
                    //TODO: check slippage
                    toWei('0.0001')
                ]
            )).to.be.revertedWith('BalancerV2PoolNotWhitelisted');
        });

        it("should not allow staking a non-whitelisted asset", async () => {
            await expect(wrappedLoan.joinPoolAndStakeBalancerV2(
                [
                    "0xfd2620c9cfcec7d152467633b3b0ca338d3d78cc00000000000000000000001c",
                    [
                        "0x2b2c81e08f1af8835a78bb2a90ae924ace0ea4be",
                        "0x7275c131b1f67e8b53b4691f92b0e35a4c1c6e22",
                    ],
                    [
                        0,
                        toWei("10")
                    ],
                    //TODO: check slippage
                    toWei('0.0001')
                ]
            )).to.be.revertedWith('DepositingInactiveToken');
        });

        it("should unstake part of sAVAX", async () => {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            await wrappedLoan.unstakeAndExitPoolBalancerV2(
                [
                    "0xfd2620c9cfcec7d152467633b3b0ca338d3d78cc00000000000000000000001c",
                    "0x2b2c81e08f1af8835a78bb2a90ae924ace0ea4be",
                    toWei("9"), //max. slippage = 10%,
                    (await sAvaxTokenContract.balanceOf(wrappedLoan.address)).sub(toWei("10"))
                ]
            );

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 2);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 2);
        });

        it("should unstake part of BAL_sAVAX_AVAX", async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            await wrappedLoan.unstakeBalancerV2(
                "0xfd2620c9cfcec7d152467633b3b0ca338d3d78cc00000000000000000000001c",
                toWei("10"),
            );

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue, 1);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 1);
        });
    });
});
