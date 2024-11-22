import {ethers, waffle} from 'hardhat'
import chai, {expect, util} from 'chai'
import {solidity} from "ethereum-waffle";
import { constructSimpleSDK, SimpleFetchSDK, SwapSide, ContractMethod } from '@paraswap/sdk';
import axios from 'axios';

import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import liquidityRouterInterface from '../../abis/LevelFinanceLiquidityRouter.json';
import ILevelFinanceArtifact
    from '../../../artifacts/contracts/interfaces/facets/arbitrum/ILevelFinance.sol/ILevelFinance.json';
import AddressProviderArtifact from '../../../artifacts/contracts/AddressProvider.sol/AddressProvider.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
    addMissingTokenContracts,
    Asset,
    convertAssetsListToSupportedAssets,
    convertTokenPricesMapToMockPrices,
    deployAllFacets,
    deployAndInitExchangeContract,
    deployPools,
    erc20ABI,
    fromBytes32,
    fromWei,
    formatUnits,
    getFixedGasSigners,
    getRedstonePrices,
    getTokensPricesMap,
    LPAbi,
    PoolAsset,
    PoolInitializationObject,
    recompileConstantsFile,
    time,
    toBytes32,
    toWei,
    parseParaSwapRouteData,
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import {
    AddressProvider,
    MockTokenManager,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
    SushiSwapIntermediary,
} from "../../../typechain";
import {BigNumber, Contract, constants} from "ethers";
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';
import TOKEN_ADDRESSES from '../../../common/addresses/arbitrum/token_addresses.json';
import { parseUnits } from 'ethers/lib/utils'

chai.use(solidity);

const {deployContract, provider} = waffle;

const masterChefAddress = '0xC18c952F800516E1eef6aB482F3d331c84d43d38';

describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('A loan with Level Finance staking operations', () => {
        let smartLoansFactory: SmartLoansFactory,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            nonOwnerWrappedLoan: any,
            btcBalance: BigNumber,
            usdtBalance: BigNumber,
            usdcBalance: BigNumber,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            tokensPrices: Map<string, number>,
            owner: SignerWithAddress,
            nonOwner: SignerWithAddress,
            depositor: SignerWithAddress,
            paraSwapMin: SimpleFetchSDK,
            liquidityRouter: Contract,
            MOCK_PRICES: any,
            diamondAddress: any;

        const getSwapData = async (srcToken: keyof typeof TOKEN_ADDRESSES, destToken: keyof typeof TOKEN_ADDRESSES, srcDecimals: number, destDecimals: number, srcAmount: any) => {
            const priceRoute = await paraSwapMin.swap.getRate({
                srcToken: TOKEN_ADDRESSES[srcToken],
                destToken: TOKEN_ADDRESSES[destToken],
                srcDecimals,
                destDecimals,
                amount: srcAmount.toString(),
                userAddress: wrappedLoan.address,
                side: SwapSide.SELL,
                options: {
                    includeContractMethods: [ContractMethod.simpleSwap]
                }
            });
            const txParams = await paraSwapMin.swap.buildTx({
                srcToken: priceRoute.srcToken,
                destToken: priceRoute.destToken,
                srcDecimals,
                destDecimals,
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
            paraSwapMin = constructSimpleSDK({ chainId: 42161, axios });

            [owner, nonOwner, depositor] = await getFixedGasSigners(10000000);
            let assetsList = ['ETH', 'BTC', 'USDT', 'USDC', 'LVL', 'arbSnrLLP', 'arbMzeLLP', 'arbJnrLLP'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'ETH', airdropList: [depositor]}
            ];

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor, 1000, 'ARBITRUM');

            tokensPrices = await getTokensPricesMap(assetsList.filter(el => !(['LVL'].includes(el))), "arbitrum", getRedstonePrices, [{symbol: 'LVL', value: 1}]);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            addMissingTokenContracts(tokenContracts, assetsList, 'ARBITRUM');
            supportedAssets = convertAssetsListToSupportedAssets(assetsList, [], 'ARBITRUM');

            let tokenManager = await deployContract(
                owner,
                MockTokenManagerArtifact,
                []
            ) as MockTokenManager;

            await tokenManager.connect(owner).initialize(supportedAssets, lendingPools);
            await tokenManager.connect(owner).setFactoryAddress(smartLoansFactory.address);

            await smartLoansFactory.initialize(diamondAddress, tokenManager.address);

            liquidityRouter = new ethers.Contract("0x1E46Ab9D3D9e87b95F2CD802208733C90a608805", liquidityRouterInterface.abi, provider);

            await tokenManager.setDebtCoverageStaked(toBytes32("stkdSnrLLP"), toWei("0.8333333333333333"));

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
                'lib',
                5000,
                "1.042e18",
                200,
                "ETH",
                "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"
            );

            await deployAllFacets(diamondAddress, true, 'ARBITRUM');
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

        async function logLLPBalances(address: string){
            let stakingContract = await new ethers.Contract(masterChefAddress, ILevelFinanceArtifact.abi, provider);

            console.log(`LLP balances of ${address}`);
            console.log(`SnrLLP: ${fromWei(await tokenContracts.get('arbSnrLLP')!.balanceOf(address))}`);
            console.log(`LLP staking balances:`);
            console.log(`SnrLLP: ${fromWei((await stakingContract.userInfo(0, address))[0])}`);
        }

        it("should mint LLP outside of DP and deposit", async () => {
            console.log(`Owner (${owner.address}) balance: ${fromWei(await provider.getBalance(owner.address))}`);
            console.log(`liquidityRouter address: ${liquidityRouter.address}`);

            let snrLLP = tokenContracts.get("arbSnrLLP");

            console.log('LOAN:')
            await logLLPBalances(wrappedLoan.address);

            console.log('OWNER:')
            await logLLPBalances(owner.address);

            // MINT SNR
            await liquidityRouter.connect(owner).addLiquidityETH(
                snrLLP!.address,
                100, // We don't really care about it in this test case
                owner.address,
                {value: toWei("1.0")}
            )

            console.log('OWNER:')
            await logLLPBalances(owner.address);

            // Deposit and stake SNR LLP

            await tokenContracts.get('arbSnrLLP')!.connect(owner).approve(wrappedLoan.address, await snrLLP!.balanceOf(owner.address));
            await wrappedLoan.depositLLPAndStake(0, await snrLLP!.balanceOf(owner.address));

            console.log('OWNER afer depositLLPAndStake')
            await logLLPBalances(owner.address);
            console.log('LOAN:')
            await logLLPBalances(wrappedLoan.address);

            // Unstake and withdraw SNR LLP

            await wrappedLoan.unstakeAndWithdrawLLP(0, await wrappedLoan.levelSnrBalance());

            console.log('OWNER afer unstakeAndWithdrawLLP')
            await logLLPBalances(owner.address);
            console.log('LOAN:')
            await logLLPBalances(wrappedLoan.address);
        });


        it("should swap and fund", async () => {
            await tokenContracts.get('ETH')!.connect(owner).deposit({value: toWei("100")});
            await tokenContracts.get('ETH')!.connect(owner).approve(wrappedLoan.address, toWei("100"));
            await wrappedLoan.fund(toBytes32("ETH"), toWei("100"));

            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = await wrappedLoan.getHealthRatio();
            let initialTWV = await wrappedLoan.getThresholdWeightedValue();

            let swapData = await getSwapData('ETH', 'BTC', 18, 8, toWei('2'));
            await wrappedLoan.paraSwap(swapData.selector, swapData.data, TOKEN_ADDRESSES['ETH'], toWei('2'), TOKEN_ADDRESSES['BTC'], parseUnits((tokensPrices.get("ETH")! * 1.96).toFixed(8), 8));
            btcBalance = await tokenContracts.get('BTC')!.balanceOf(wrappedLoan.address);
            swapData = await getSwapData('ETH', 'USDT', 18, 6, toWei('2'));
            await wrappedLoan.paraSwap(swapData.selector, swapData.data, TOKEN_ADDRESSES['ETH'], toWei('2'), TOKEN_ADDRESSES['USDT'], parseUnits((tokensPrices.get("ETH")! * 1.96).toFixed(6), 6));
            usdtBalance = await tokenContracts.get('USDT')!.balanceOf(wrappedLoan.address);
            swapData = await getSwapData('ETH', 'USDC', 18, 6, toWei('2'));
            await wrappedLoan.paraSwap(swapData.selector, swapData.data, TOKEN_ADDRESSES['ETH'], toWei('2'), TOKEN_ADDRESSES['USDC'], parseUnits((tokensPrices.get("ETH")! * 1.96).toFixed(6), 6));
            usdcBalance = await tokenContracts.get('USDC')!.balanceOf(wrappedLoan.address);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 20);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.eq(fromWei(initialHR));
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(fromWei(initialTWV), 20);
        });

        it("should fail to stake as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.levelStakeEthSnr(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.levelStakeEthMze(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.levelStakeEthJnr(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.levelStakeBtcSnr(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.levelStakeBtcMze(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.levelStakeBtcJnr(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.levelStakeUsdtSnr(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.levelStakeUsdtMze(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.levelStakeUsdtJnr(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.levelStakeUsdcSnr(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.levelStakeUsdcMze(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.levelStakeUsdcJnr(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to unstake as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.levelUnstakeEthSnr(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.levelUnstakeEthMze(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.levelUnstakeEthJnr(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.levelUnstakeBtcSnr(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.levelUnstakeBtcMze(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.levelUnstakeBtcJnr(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.levelUnstakeUsdtSnr(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.levelUnstakeUsdtMze(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.levelUnstakeUsdtJnr(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.levelUnstakeUsdcSnr(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.levelUnstakeUsdcMze(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.levelUnstakeUsdcJnr(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to stake to mze, jnr pools", async () => {
            await expect(wrappedLoan.levelStakeEthMze(toWei("9999"), toWei("9999"))).to.be.revertedWith("Jnr and Mze tranches are no longer supported");
            await expect(wrappedLoan.levelStakeEthJnr(toWei("9999"), toWei("9999"))).to.be.revertedWith("Jnr and Mze tranches are no longer supported");
            await expect(wrappedLoan.levelStakeBtcMze(toWei("9999"), toWei("9999"))).to.be.revertedWith("Jnr and Mze tranches are no longer supported");
            await expect(wrappedLoan.levelStakeBtcJnr(toWei("9999"), toWei("9999"))).to.be.revertedWith("Jnr and Mze tranches are no longer supported");
            await expect(wrappedLoan.levelStakeUsdtMze(toWei("9999"), toWei("9999"))).to.be.revertedWith("Jnr and Mze tranches are no longer supported");
            await expect(wrappedLoan.levelStakeUsdtJnr(toWei("9999"), toWei("9999"))).to.be.revertedWith("Jnr and Mze tranches are no longer supported");
            await expect(wrappedLoan.levelStakeUsdcMze(toWei("9999"), toWei("9999"))).to.be.revertedWith("Jnr and Mze tranches are no longer supported");
            await expect(wrappedLoan.levelStakeUsdcJnr(toWei("9999"), toWei("9999"))).to.be.revertedWith("Jnr and Mze tranches are no longer supported");
        });

        it("should stake", async () => {
            await testStake("levelStakeEthSnr", "levelSnrBalance", 0, toWei('1'), constants.Zero);
            await testStake("levelStakeBtcSnr", "levelSnrBalance", 0, btcBalance, constants.Zero);
            await testStake("levelStakeUsdtSnr", "levelSnrBalance", 0, usdtBalance, constants.Zero);
            await testStake("levelStakeUsdcSnr", "levelSnrBalance", 0, usdcBalance, constants.Zero);
        });

        it("should unstake", async () => {
            let snrBalance = await wrappedLoan.levelSnrBalance();

            await testUnstake("levelUnstakeEthSnr", "levelSnrBalance", 0, snrBalance.div(4), constants.Zero);
            await testUnstake("levelUnstakeBtcSnr", "levelSnrBalance", 0, snrBalance.div(4), constants.Zero);
            await testUnstake("levelUnstakeUsdtSnr", "levelSnrBalance", 0, snrBalance.div(4), constants.Zero);
            await testUnstake("levelUnstakeUsdcSnr", "levelSnrBalance", 0, snrBalance.div(4), constants.Zero);
        });

        async function testStake(stakeMethod: string, balanceMethod: string, pid: number, amount: BigNumber, minLpAmount: BigNumber) {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = await wrappedLoan.getHealthRatio();
            let initialTWV = await wrappedLoan.getThresholdWeightedValue();

            let stakingContract = await new ethers.Contract(masterChefAddress, ILevelFinanceArtifact.abi, provider);

            let initialStakedBalance = (await stakingContract.userInfo(pid, wrappedLoan.address)).amount;

            await wrappedLoan[stakeMethod](amount, minLpAmount);

            expect(await wrappedLoan[balanceMethod]()).to.be.gt(0);
            expect((await stakingContract.userInfo(pid, wrappedLoan.address)).amount).to.be.gt(initialStakedBalance);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 50);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(fromWei(initialHR), 0.0001);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(fromWei(initialTWV), 50);
        }

        async function testUnstake(unstakeMethod: string, balanceMethod: string, pid: number, amount: BigNumber, minAmount: BigNumber) {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = await wrappedLoan.getHealthRatio();

            await wrappedLoan[unstakeMethod](amount, minAmount);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 50);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(fromWei(initialHR), 0.01);
        }
    });
});
