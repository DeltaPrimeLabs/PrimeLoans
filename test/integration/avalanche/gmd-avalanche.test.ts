import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import AddressProviderArtifact from '../../../artifacts/contracts/AddressProvider.sol/AddressProvider.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
    addMissingTokenContracts,
    Asset,
    convertAssetsListToSupportedAssets,
    convertTokenPricesMapToMockPrices,
    deployAllFacets,
    deployAndInitExchangeContract,
    deployPools, erc20ABI,
    GMDVaultABI,
    fromWei,
    getFixedGasSigners,
    getRedstonePrices,
    getTokensPricesMap,
    PoolAsset,
    PoolInitializationObject,
    recompileConstantsFile,
    toBytes32,
    toWei, formatUnits,
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import {parseUnits} from "ethers/lib/utils";
import {
    AddressProvider,
    MockTokenManager,
    PangolinIntermediary,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
} from "../../../typechain";
import {BigNumber, Contract} from "ethers";
import {deployDiamond, replaceFacet} from '../../../tools/diamond/deploy-diamond';
import TOKEN_ADDRESSES from "../../../common/addresses/avax/token_addresses.json";

chai.use(solidity);

const {deployContract, provider} = waffle;
const gmdVaultAddress = "0x5517c5F22177BcF7b320A2A5daF2334344eFb38C";
const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';

describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('A loan with staking operations', () => {
        let smartLoansFactory: SmartLoansFactory,
            exchange: PangolinIntermediary,
            gmdVaultContract: Contract,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            nonOwnerWrappedLoan: any,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            liquidator: SignerWithAddress,
            diamondAddress: any,
            MOCK_PRICES: any,
            GMDTokensContracts: Map<string, Contract>,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            tokensPrices: Map<string, number>;

        before("deploy factory and pool", async () => {
            [owner, depositor, liquidator] = await getFixedGasSigners(10000000);
            let assetsList = ['USDC', 'AVAX', 'BTC', 'ETH', 'gmdUSDC', 'gmdWAVAX', 'gmdBTCb', 'gmdWETHe'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'USDC', airdropList: []},
                {name: 'AVAX', airdropList: [depositor]},
                {name: 'BTC', airdropList: []},
                {name: 'ETH', airdropList: []},
            ];

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor);

            let gmdTokensList = ['gmdUSDC', 'gmdWAVAX', 'gmdBTCb', 'gmdWETHe'];
            let baseAssetsList = ['USDC', 'AVAX', 'BTC', 'ETH'];

            gmdVaultContract = await new ethers.Contract(gmdVaultAddress, GMDVaultABI, provider)
            GMDTokensContracts = new Map();
            let GMDTokensPrices = new Map();

            for(const token of gmdTokensList){
                // @ts-ignore
                GMDTokensContracts.set(token, await new ethers.Contract(TOKEN_ADDRESSES[token], erc20ABI, provider));
            }

            for(const [index, token] of gmdTokensList.entries()){
                GMDTokensPrices.set(
                    token,
                    (await getRedstonePrices([baseAssetsList[index]]))[0] * (await gmdVaultContract.poolInfo(index)).totalStaked / (await GMDTokensContracts.get(token)!.totalSupply())
                )
            }

            tokensPrices = await getTokensPricesMap(assetsList.filter(el => !(gmdTokensList.includes(el))), "avalanche", getRedstonePrices, gmdTokensList.map(token => {return {symbol: token, value: GMDTokensPrices.get(token)}}));
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList);
            addMissingTokenContracts(tokenContracts, assetsList);

            let tokenManager = await deployContract(
                owner,
                MockTokenManagerArtifact,
                []
            ) as MockTokenManager;

            await tokenManager.connect(owner).initialize(supportedAssets, lendingPools);
            await tokenManager.connect(owner).setFactoryAddress(smartLoansFactory.address);

            await smartLoansFactory.initialize(diamondAddress, tokenManager.address);

            exchange = await deployAndInitExchangeContract(owner, pangolinRouterAddress, tokenManager.address, supportedAssets, "PangolinIntermediary") as PangolinIntermediary;

            let addressProvider = await deployContract(
                owner,
                AddressProviderArtifact,
                []
            ) as AddressProvider;

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [
                    {
                        facetPath: './contracts/facets/avalanche/PangolinDEXFacet.sol',
                        contractAddress: exchange.address,
                    }
                ],
                tokenManager.address,
                addressProvider.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib'
            );

            await deployAllFacets(diamondAddress)
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

        it("should fund a loan", async () => {
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.equal(1.157920892373162e+59);

            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("200")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("200"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("200"));
            await wrappedLoan.swapTraderJoe(toBytes32("AVAX"), toBytes32("USDC"), toWei("10"), 0);
            await wrappedLoan.swapTraderJoe(toBytes32("AVAX"), toBytes32("BTC"), toWei("10"), 0);
            await wrappedLoan.swapTraderJoe(toBytes32("AVAX"), toBytes32("ETH"), toWei("10"), 0);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(200 * tokensPrices.get('AVAX')!, 5);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(1.157920892373162e+59 , 0.01);
        });

        it("should fail to stake USDC as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.gmdStakeUSDC(toWei("9999"), 0)).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to unstake USDC as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.gmdUnstakeUSDC(toWei("9999"), 0)).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to stake AVAX as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.gmdStakeAVAX(toWei("9999"), 0)).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to unstake AVAX as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.gmdUnstakeAVAX(toWei("9999"), 0)).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to stake BTC as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.gmdStakeBTCb(toWei("9999"), 0)).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to unstake BTC as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.gmdUnstakeBTCb(toWei("9999"), 0)).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to stake ETH as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.gmdStakeWETHe(toWei("9999"), 0)).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to unstake ETH as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.gmdUnstakeWETHe(toWei("9999"), 0)).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should stake USDC", async () => {
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(200 * tokensPrices.get('AVAX')!, 5);
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let initialStakedBalance = await GMDTokensContracts.get('gmdUSDC')!.balanceOf(wrappedLoan.address);
            let initialUSDCBalance = await tokenContracts.get('USDC')!.balanceOf(wrappedLoan.address);

            expect(initialStakedBalance).to.be.equal(0);
            expect(initialUSDCBalance).to.be.gt(0);

            let stakedAmount = 10;
            let totalDeposits = (await gmdVaultContract.poolInfo(0)).totalStaked;
            let totalSupply = await GMDTokensContracts.get('gmdUSDC')!.totalSupply();
            let expectedSharesReceived = BigNumber.from(stakedAmount.toString()).div(totalDeposits).mul(totalSupply)

            // 0.5% deposit fee
            await wrappedLoan.gmdStakeUSDC(parseUnits(stakedAmount.toString(), 6), expectedSharesReceived.mul("995").div("1000"));

            let sharesAfterStaking = fromWei(await GMDTokensContracts.get('gmdUSDC')!.balanceOf(wrappedLoan.address));
            expect(formatUnits(initialUSDCBalance, 6) - formatUnits(await tokenContracts.get('USDC')!.balanceOf(wrappedLoan.address), 6)).to.be.closeTo(10, 1e-8);
            expect(toWei(sharesAfterStaking.toString())).to.be.gte(toWei(expectedSharesReceived.toString()))

            // Should stake max if amount > balance
            await wrappedLoan.gmdStakeUSDC(toWei("99999999"), 0);
            expect(formatUnits(await tokenContracts.get('USDC')!.balanceOf(wrappedLoan.address), 6)).to.be.eq(0);
            expect(fromWei(await GMDTokensContracts.get('gmdUSDC')!.balanceOf(wrappedLoan.address))).to.be.gt(sharesAfterStaking)

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 2);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 30);
        });

        it("should unstake USDC", async () => {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let initialStakedBalance = await GMDTokensContracts.get('gmdUSDC')!.balanceOf(wrappedLoan.address);
            let initialUSDCBalance = await tokenContracts.get('USDC')!.balanceOf(wrappedLoan.address);

            expect(initialStakedBalance).to.be.gt(0);
            expect(initialUSDCBalance).to.be.eq(0);

            let unstakedAmount = initialStakedBalance.div("2");
            let totalDeposits = (await gmdVaultContract.poolInfo(0)).totalStaked;
            let totalSupply = await GMDTokensContracts.get('gmdUSDC')!.totalSupply();
            let expectedUnstakedTokenReceived = fromWei(BigNumber.from(unstakedAmount.toString()).mul(totalDeposits).div(totalSupply)).toFixed(6)

            await wrappedLoan.gmdUnstakeUSDC(unstakedAmount, parseUnits(expectedUnstakedTokenReceived.toString(), 6));

            let sharesAfterUnstaking = await GMDTokensContracts.get('gmdUSDC')!.balanceOf(wrappedLoan.address);
            let tokenReceived = (await tokenContracts.get('USDC')!.balanceOf(wrappedLoan.address)).sub(initialUSDCBalance);

            expect(formatUnits(tokenReceived, 6)).to.be.closeTo(Number(expectedUnstakedTokenReceived), 1);
            expect(initialStakedBalance.sub(sharesAfterUnstaking)).to.be.eq(unstakedAmount);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 2);

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.1);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV,  1);
        });

        it("should not fail to unstake more than was initially staked but unstake all USDC", async () => {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let initialStakedBalance = await GMDTokensContracts.get('gmdUSDC')!.balanceOf(wrappedLoan.address);
            let initialUSDCBalance = await tokenContracts.get('USDC')!.balanceOf(wrappedLoan.address);

            expect(initialStakedBalance).to.be.gt(0);

            await wrappedLoan.gmdUnstakeUSDC(toWei("999999"), 0);
            expect(await GMDTokensContracts.get('gmdUSDC')!.balanceOf(wrappedLoan.address)).to.be.eq(0);
            expect(await tokenContracts.get('USDC')!.balanceOf(wrappedLoan.address)).to.be.gt(initialUSDCBalance)

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 2);

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.1);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV,  1);
        });

        // Max vault cap reached
        it("should stake WAVAX", async () => {
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(200 * tokensPrices.get('AVAX')!, 5);
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let initialStakedBalance = await GMDTokensContracts.get('gmdWAVAX')!.balanceOf(wrappedLoan.address);
            let initialAVAXBalance = await tokenContracts.get('AVAX')!.balanceOf(wrappedLoan.address);

            expect(initialStakedBalance).to.be.equal(0);
            expect(initialAVAXBalance).to.be.gt(0);

            let stakedAmount = 10;
            let totalDeposits = (await gmdVaultContract.poolInfo(0)).totalStaked;
            let totalSupply = await GMDTokensContracts.get('gmdWAVAX')!.totalSupply();
            let expectedSharesReceived = BigNumber.from(stakedAmount.toString()).div(totalDeposits).mul(totalSupply)

            // 0.5% deposit fee
            await wrappedLoan.gmdStakeAVAX(parseUnits(stakedAmount.toString(), 6), expectedSharesReceived.mul("995").div("1000"));

            let sharesAfterStaking = fromWei(await GMDTokensContracts.get('gmdWAVAX')!.balanceOf(wrappedLoan.address));
            expect(formatUnits(initialAVAXBalance, 6) - formatUnits(await tokenContracts.get('AVAX')!.balanceOf(wrappedLoan.address), 6)).to.be.eq(10);
            expect(toWei(sharesAfterStaking.toString())).to.be.gte(toWei(expectedSharesReceived.toString()))

            // Should stake max if amount > balance
            await wrappedLoan.gmdStakeAVAX(toWei("99999999"), 0);
            expect(formatUnits(await tokenContracts.get('AVAX')!.balanceOf(wrappedLoan.address), 6)).to.be.eq(0);
            expect(fromWei(await GMDTokensContracts.get('gmdWAVAX')!.balanceOf(wrappedLoan.address))).to.be.gt(sharesAfterStaking)

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 2);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 30);
        });

        it("should unstake WAVAX", async () => {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let initialStakedBalance = await GMDTokensContracts.get('gmdWAVAX')!.balanceOf(wrappedLoan.address);
            let initialAVAXBalance = await tokenContracts.get('AVAX')!.balanceOf(wrappedLoan.address);

            expect(initialStakedBalance).to.be.gt(0);
            expect(initialAVAXBalance).to.be.eq(0);

            let unstakedAmount = initialStakedBalance.div("2");
            let totalDeposits = (await gmdVaultContract.poolInfo(0)).totalStaked;
            let totalSupply = await GMDTokensContracts.get('gmdWAVAX')!.totalSupply();
            let expectedUnstakedTokenReceived = fromWei(BigNumber.from(unstakedAmount.toString()).mul(totalDeposits).div(totalSupply)).toFixed(6)

            await wrappedLoan.gmdUnstakeAVAX(unstakedAmount, parseUnits(expectedUnstakedTokenReceived.toString(), 6));

            let sharesAfterUnstaking = await GMDTokensContracts.get('gmdWAVAX')!.balanceOf(wrappedLoan.address);
            let tokenReceived = (await tokenContracts.get('AVAX')!.balanceOf(wrappedLoan.address)).sub(initialAVAXBalance);

            expect(formatUnits(tokenReceived, 6)).to.be.closeTo(Number(expectedUnstakedTokenReceived), 1);
            expect(initialStakedBalance.sub(sharesAfterUnstaking)).to.be.eq(unstakedAmount);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 2);

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.1);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV,  1);
        });

        it("should not fail to unstake more than was initially staked but unstake all WAVAX", async () => {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let initialStakedBalance = await GMDTokensContracts.get('gmdWAVAX')!.balanceOf(wrappedLoan.address);
            let initialAVAXBalance = await tokenContracts.get('AVAX')!.balanceOf(wrappedLoan.address);

            expect(initialStakedBalance).to.be.gt(0);

            await wrappedLoan.gmdUnstakeAVAX(toWei("999999"), 0);
            expect(await GMDTokensContracts.get('gmdWAVAX')!.balanceOf(wrappedLoan.address)).to.be.eq(0);
            expect(await tokenContracts.get('AVAX')!.balanceOf(wrappedLoan.address)).to.be.gt(initialAVAXBalance)

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 2);

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.1);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV,  1);
        });

        // Max vault cap reached
        it("should stake gmdBTCb", async () => {
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(200 * tokensPrices.get('AVAX')!, 5);
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let initialStakedBalance = await GMDTokensContracts.get('gmdBTCb')!.balanceOf(wrappedLoan.address);
            let initialBTCBalance = await tokenContracts.get('BTC')!.balanceOf(wrappedLoan.address);

            expect(initialStakedBalance).to.be.equal(0);
            expect(initialBTCBalance).to.be.gt(0);

            let stakedAmount = 10;
            let totalDeposits = (await gmdVaultContract.poolInfo(0)).totalStaked;
            let totalSupply = await GMDTokensContracts.get('gmdBTCb')!.totalSupply();
            let expectedSharesReceived = BigNumber.from(stakedAmount.toString()).div(totalDeposits).mul(totalSupply)

            // 0.5% deposit fee
            await wrappedLoan.gmdStakeBTCb(parseUnits(stakedAmount.toString(), 6), expectedSharesReceived.mul("995").div("1000"));

            let sharesAfterStaking = fromWei(await GMDTokensContracts.get('gmdBTCb')!.balanceOf(wrappedLoan.address));
            expect(formatUnits(initialBTCBalance, 6) - formatUnits(await tokenContracts.get('BTC')!.balanceOf(wrappedLoan.address), 6)).to.be.eq(10);
            expect(toWei(sharesAfterStaking.toString())).to.be.gte(toWei(expectedSharesReceived.toString()))

            // Should stake max if amount > balance
            await wrappedLoan.gmdStakeBTCb(toWei("99999999"), 0);
            expect(formatUnits(await tokenContracts.get('BTC')!.balanceOf(wrappedLoan.address), 6)).to.be.eq(0);
            expect(fromWei(await GMDTokensContracts.get('gmdBTCb')!.balanceOf(wrappedLoan.address))).to.be.gt(sharesAfterStaking)

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 2);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 30);
        });

        it("should unstake gmdBTCb", async () => {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let initialStakedBalance = await GMDTokensContracts.get('gmdBTCb')!.balanceOf(wrappedLoan.address);
            let initialBTCBalance = await tokenContracts.get('BTC')!.balanceOf(wrappedLoan.address);

            expect(initialStakedBalance).to.be.gt(0);
            expect(initialBTCBalance).to.be.eq(0);

            let unstakedAmount = initialStakedBalance.div("2");
            let totalDeposits = (await gmdVaultContract.poolInfo(0)).totalStaked;
            let totalSupply = await GMDTokensContracts.get('gmdBTCb')!.totalSupply();
            let expectedUnstakedTokenReceived = fromWei(BigNumber.from(unstakedAmount.toString()).mul(totalDeposits).div(totalSupply)).toFixed(6)

            await wrappedLoan.gmdUnstakeBTCb(unstakedAmount, parseUnits(expectedUnstakedTokenReceived.toString(), 6));

            let sharesAfterUnstaking = await GMDTokensContracts.get('gmdBTCb')!.balanceOf(wrappedLoan.address);
            let tokenReceived = (await tokenContracts.get('BTC')!.balanceOf(wrappedLoan.address)).sub(initialBTCBalance);

            expect(formatUnits(tokenReceived, 6)).to.be.closeTo(Number(expectedUnstakedTokenReceived), 1);
            expect(initialStakedBalance.sub(sharesAfterUnstaking)).to.be.eq(unstakedAmount);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 2);

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.1);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV,  1);
        });

        it("should not fail to unstake more than was initially staked but unstake all gmdBTCb", async () => {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let initialStakedBalance = await GMDTokensContracts.get('gmdBTCb')!.balanceOf(wrappedLoan.address);
            let initialBTCBalance = await tokenContracts.get('BTC')!.balanceOf(wrappedLoan.address);

            expect(initialStakedBalance).to.be.gt(0);

            await wrappedLoan.gmdUnstakeBTC(toWei("999999"), 0);
            expect(await GMDTokensContracts.get('gmdBTCb')!.balanceOf(wrappedLoan.address)).to.be.eq(0);
            expect(await tokenContracts.get('BTC')!.balanceOf(wrappedLoan.address)).to.be.gt(initialBTCBalance)

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 2);

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.1);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV,  1);
        });

        // Max vault cap reached
        it("should stake gmdWETHe", async () => {
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(200 * tokensPrices.get('AVAX')!, 5);
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let initialStakedBalance = await GMDTokensContracts.get('gmdWETHe')!.balanceOf(wrappedLoan.address);
            let initialETHBalance = await tokenContracts.get('ETH')!.balanceOf(wrappedLoan.address);

            expect(initialStakedBalance).to.be.equal(0);
            expect(initialETHBalance).to.be.gt(0);

            let stakedAmount = 10;
            let totalDeposits = (await gmdVaultContract.poolInfo(0)).totalStaked;
            let totalSupply = await GMDTokensContracts.get('gmdWETHe')!.totalSupply();
            let expectedSharesReceived = BigNumber.from(stakedAmount.toString()).div(totalDeposits).mul(totalSupply)

            // 0.5% deposit fee
            await wrappedLoan.gmdStakeWETHe(parseUnits(stakedAmount.toString(), 6), expectedSharesReceived.mul("995").div("1000"));

            let sharesAfterStaking = fromWei(await GMDTokensContracts.get('gmdWETHe')!.balanceOf(wrappedLoan.address));
            expect(formatUnits(initialETHBalance, 6) - formatUnits(await tokenContracts.get('ETH')!.balanceOf(wrappedLoan.address), 6)).to.be.eq(10);
            expect(toWei(sharesAfterStaking.toString())).to.be.gte(toWei(expectedSharesReceived.toString()))

            // Should stake max if amount > balance
            await wrappedLoan.gmdStakeWETHe(toWei("99999999"), 0);
            expect(formatUnits(await tokenContracts.get('ETH')!.balanceOf(wrappedLoan.address), 6)).to.be.eq(0);
            expect(fromWei(await GMDTokensContracts.get('gmdWETHe')!.balanceOf(wrappedLoan.address))).to.be.gt(sharesAfterStaking)

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 2);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 30);
        });

        it("should unstake gmdWETHe", async () => {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let initialStakedBalance = await GMDTokensContracts.get('gmdWETHe')!.balanceOf(wrappedLoan.address);
            let initialETHBalance = await tokenContracts.get('ETH')!.balanceOf(wrappedLoan.address);

            expect(initialStakedBalance).to.be.gt(0);
            expect(initialETHBalance).to.be.eq(0);

            let unstakedAmount = initialStakedBalance.div("2");
            let totalDeposits = (await gmdVaultContract.poolInfo(0)).totalStaked;
            let totalSupply = await GMDTokensContracts.get('gmdWETHe')!.totalSupply();
            let expectedUnstakedTokenReceived = fromWei(BigNumber.from(unstakedAmount.toString()).mul(totalDeposits).div(totalSupply)).toFixed(6)

            await wrappedLoan.gmdUnstakeWETHe(unstakedAmount, parseUnits(expectedUnstakedTokenReceived.toString(), 6));

            let sharesAfterUnstaking = await GMDTokensContracts.get('gmdWETHe')!.balanceOf(wrappedLoan.address);
            let tokenReceived = (await tokenContracts.get('ETH')!.balanceOf(wrappedLoan.address)).sub(initialETHBalance);

            expect(formatUnits(tokenReceived, 6)).to.be.closeTo(Number(expectedUnstakedTokenReceived), 1);
            expect(initialStakedBalance.sub(sharesAfterUnstaking)).to.be.eq(unstakedAmount);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 2);

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.1);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV,  1);
        });

        it("should not fail to unstake more than was initially staked but unstake all gmdWETHe", async () => {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let initialStakedBalance = await GMDTokensContracts.get('gmdWETHe')!.balanceOf(wrappedLoan.address);
            let initialETHBalance = await tokenContracts.get('ETH')!.balanceOf(wrappedLoan.address);

            expect(initialStakedBalance).to.be.gt(0);

            await wrappedLoan.gmdUnstakeWETHe(toWei("999999"), 0);
            expect(await GMDTokensContracts.get('gmdWETHe')!.balanceOf(wrappedLoan.address)).to.be.eq(0);
            expect(await tokenContracts.get('ETH')!.balanceOf(wrappedLoan.address)).to.be.gt(initialETHBalance)

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 2);

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.1);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV,  1);
        });
    });
});

