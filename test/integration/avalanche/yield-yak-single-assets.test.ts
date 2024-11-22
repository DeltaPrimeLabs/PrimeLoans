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
    calculateStakingTokensAmountBasedOnAvaxValue,
    convertAssetsListToSupportedAssets,
    convertTokenPricesMapToMockPrices,
    deployAllFacets,
    deployAndInitExchangeContract,
    deployPools, erc20ABI,
    fromWei,
    getFixedGasSigners,
    getRedstonePrices,
    getTokensPricesMap, GLPManagerRewarderAbi,
    PoolAsset,
    PoolInitializationObject,
    recompileConstantsFile,
    toBytes32,
    toWei, ZERO,
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
const yakAVAXStakingTokenAddress = TOKEN_ADDRESSES['YY_AAVE_AVAX'];
const yaksAVAXStakingTokenAddress = TOKEN_ADDRESSES['YY_PTP_sAVAX'];
const yakGLPStakingTokenAddress = TOKEN_ADDRESSES['YY_GLP'];
const GLP_REWARDER_ADDRESS = "0xB70B91CE0771d3f4c81D87660f71Da31d48eB3B3";
const STAKED_GLP_ADDRESS = "0xaE64d55a6f09E4263421737397D1fdFA71896a69";
const GLP_MANAGER_ADDRESS = "0xD152c7F25db7F4B95b7658323c5F33d176818EE4";
const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';

describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('A loan with staking operations', () => {
        let smartLoansFactory: SmartLoansFactory,
            exchange: PangolinIntermediary,
            glpManagerContract: Contract,
            stakedGlpContract: Contract,
            yakAVAXStakingContract: Contract,
            yaksAVAXStakingContract: Contract,
            yakGLPStakingContract: Contract,
            glpBalanceAfterMint: any,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            nonOwnerWrappedLoan: any,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            liquidator: SignerWithAddress,
            diamondAddress: any,
            MOCK_PRICES: any,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            tokensPrices: Map<string, number>;

        before("deploy factory and pool", async () => {
            [owner, depositor, liquidator] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'USDC', 'sAVAX', 'YY_AAVE_AVAX', 'YY_PTP_sAVAX', 'GLP', 'YY_GLP'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]},
            ];

            diamondAddress = await deployDiamond();

            glpManagerContract = new ethers.Contract(GLP_REWARDER_ADDRESS, GLPManagerRewarderAbi, provider);
            stakedGlpContract = new ethers.Contract(STAKED_GLP_ADDRESS, erc20ABI, provider);

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor);
            tokensPrices = await getTokensPricesMap(assetsList, "avalanche", getRedstonePrices);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList);
            addMissingTokenContracts(tokenContracts, assetsList);

            yakAVAXStakingContract = await new ethers.Contract(yakAVAXStakingTokenAddress, erc20ABI, provider);
            yaksAVAXStakingContract = await new ethers.Contract(yaksAVAXStakingTokenAddress, erc20ABI, provider);
            yakGLPStakingContract = await new ethers.Contract(yakGLPStakingTokenAddress, erc20ABI, provider);

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

        it("should mint GLP for owner", async () => {
            let currentGlpBalance = await tokenContracts.get("GLP")!.balanceOf(owner.address);
            let currentStakedGlpBalance = await stakedGlpContract.balanceOf(owner.address);
            expect(currentGlpBalance).to.be.equal(0);

            const minGlpAmount = tokensPrices.get("AVAX")! / tokensPrices.get("GLP")! * 98 / 100;

            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("10")});
            const avaxBalanceBefore = await tokenContracts.get('AVAX')!.balanceOf(owner.address);
            await tokenContracts.get('AVAX')!.connect(owner).approve(GLP_MANAGER_ADDRESS, toWei("10"));
            await glpManagerContract.connect(owner).mintAndStakeGlp(
                TOKEN_ADDRESSES['AVAX'],
                toWei("10"),
                0,
                toWei(minGlpAmount.toString())
            )

            const avaxUsedForMinting = fromWei(avaxBalanceBefore) - fromWei(await tokenContracts.get('AVAX')!.balanceOf(owner.address));

            glpBalanceAfterMint = await tokenContracts.get("GLP")!.balanceOf(owner.address);
            currentStakedGlpBalance = await stakedGlpContract.balanceOf(owner.address)
            expect(glpBalanceAfterMint).to.be.gt(0);
        });

        it("should fund a loan", async () => {
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.equal(1.157920892373162e+59);

            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("200")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("200"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("200"));
            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("1"));

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(201 * tokensPrices.get('AVAX')!, 0.01);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(167.5, 0.01);

            await stakedGlpContract.connect(owner).approve(wrappedLoan.address, glpBalanceAfterMint);
            await wrappedLoan.connect(owner).fundGLP(glpBalanceAfterMint);

            expect(fromWei(await tokenContracts.get('GLP')!.connect(owner).balanceOf(wrappedLoan.address))).to.be.equal(fromWei(glpBalanceAfterMint));
            expect(fromWei(await stakedGlpContract.connect(owner).balanceOf(wrappedLoan.address))).to.be.equal(fromWei(glpBalanceAfterMint));
            expect(fromWei(await tokenContracts.get('GLP')!.connect(owner).balanceOf(owner.address))).to.be.equal(0);
            expect(fromWei(await stakedGlpContract.connect(owner).balanceOf(owner.address))).to.be.equal(0);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(201 * tokensPrices.get('AVAX')! + fromWei(await stakedGlpContract.connect(owner).balanceOf(wrappedLoan.address)) * tokensPrices.get('GLP')!, 2);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(175.81, 0.1);
        });

        it("should fail to stake AVAX as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.stakeAVAXYak(toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to unstake AVAX as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.unstakeAVAXYak(toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to stake sAVAX as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.stakeSAVAXYak(toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to unstake sAVAX as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.unstakeSAVAXYak(toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to stake GLP as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.stakeGLPYak(toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to unstake GLP as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.unstakeGLPYak(toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should stake GLP", async () => {
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(201 * tokensPrices.get('AVAX')! + fromWei(await stakedGlpContract.connect(owner).balanceOf(wrappedLoan.address)) * tokensPrices.get('GLP')!, 2);

            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let initialStakedBalance = await yakGLPStakingContract.balanceOf(wrappedLoan.address);
            expect(initialStakedBalance).to.be.equal(0);

            await expect(wrappedLoan.stakeGLPYak(toWei("9999"), {gasLimit: 8000000})).to.be.revertedWith("Not enough token available");

            await wrappedLoan.stakeGLPYak(glpBalanceAfterMint);

            let afterStakingStakedBalance = await yakGLPStakingContract.balanceOf(wrappedLoan.address);
            let expectedAfterStakingStakedBalance = tokensPrices.get('GLP')! * fromWei(glpBalanceAfterMint) / tokensPrices.get('YY_GLP')!;

            expect(fromWei(afterStakingStakedBalance)).to.be.closeTo(expectedAfterStakingStakedBalance, 2);
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(201 * tokensPrices.get('AVAX')! + fromWei(afterStakingStakedBalance) * tokensPrices.get('YY_GLP')!, 2);

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.1);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 2);
        });

        it("should unstake GLP", async () => {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            await wrappedLoan.unstakeGLPYak(await wrappedLoan.getBalance(toBytes32('YY_GLP')));

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 2);

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.1);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV,  1);
        });

        it("should stake AVAX", async () => {
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(201 * tokensPrices.get('AVAX')! + fromWei(await stakedGlpContract.connect(owner).balanceOf(wrappedLoan.address)) * tokensPrices.get('GLP')!, 2);

            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let initialStakedBalance = await yakAVAXStakingContract.balanceOf(wrappedLoan.address);
            expect(initialStakedBalance).to.be.equal(0);

            const stakedAvaxAmount = 50;

            await wrappedLoan.stakeAVAXYak(
                toWei(stakedAvaxAmount.toString())
            );

            let afterStakingStakedBalance = await yakAVAXStakingContract.balanceOf(wrappedLoan.address);
            let expectedAfterStakingStakedBalance = await calculateStakingTokensAmountBasedOnAvaxValue(yakAVAXStakingContract, toWei(stakedAvaxAmount.toString()));

            expect(afterStakingStakedBalance).to.be.equal(expectedAfterStakingStakedBalance);
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(161 * tokensPrices.get('AVAX')! + fromWei(afterStakingStakedBalance) * tokensPrices.get('YY_AAVE_AVAX')!, 2);

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.1);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 2);
        });

        it("should unstake part of staked AVAX", async () => {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let initialAvaxBalance = await tokenContracts.get('AVAX')!.balanceOf(wrappedLoan.address);
            let amountAvaxToReceive = toWei("10");
            let initialStakedTokensBalance = await yakAVAXStakingContract.balanceOf(wrappedLoan.address);
            let tokenAmountToUnstake = await calculateStakingTokensAmountBasedOnAvaxValue(yakAVAXStakingContract, amountAvaxToReceive);

            let expectedAfterUnstakeTokenBalance = initialStakedTokensBalance.sub(tokenAmountToUnstake);

            await wrappedLoan.unstakeAVAXYak(tokenAmountToUnstake);

            expect(expectedAfterUnstakeTokenBalance).to.be.equal(await yakAVAXStakingContract.balanceOf(wrappedLoan.address));
            expect(fromWei(await tokenContracts.get('AVAX')!.balanceOf(wrappedLoan.address))).to.be.closeTo(fromWei(initialAvaxBalance.add(amountAvaxToReceive)), 0.4);
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 2);

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.1);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 0.25);
        });

        it("should not fail to unstake more than was initially staked but unstake all", async () => {
            await wrappedLoan.unstakeAVAXYak(toWei("999999"));
            expect(await yakAVAXStakingContract.balanceOf(wrappedLoan.address)).to.be.equal(0);
        });

        it("should stake sAVAX", async () => {
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(211 * tokensPrices.get('AVAX')!, 2);
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let initialStakedBalance = await yaksAVAXStakingContract.balanceOf(wrappedLoan.address);
            expect(initialStakedBalance).to.be.equal(0);

            await wrappedLoan.swapPangolin(
                toBytes32('AVAX'),
                toBytes32('sAVAX'),
                toWei('50'),
                0,
            );

            expect(await wrappedLoan.getBalance(toBytes32('sAVAX'))).to.be.gt(0);

            await wrappedLoan.stakeSAVAXYak(1);

            expect(await wrappedLoan.getBalance(toBytes32('sAVAX'))).to.be.gt(0);

            // Should stake max if amount > balance
            await wrappedLoan.stakeSAVAXYak(toWei("99999999"));
            expect(await wrappedLoan.getBalance(toBytes32('sAVAX'))).to.be.eq(0);

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 2);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 30);
        });

        it("should unstake sAVAX", async () => {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            await wrappedLoan.unstakeSAVAXYak(await wrappedLoan.getBalance(toBytes32('YY_PTP_sAVAX')));

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 2);

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.1);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV,  1);
        });

        it("should allow anyone to unstake if insolvent", async () => {
            await wrappedLoan.stakeAVAXYak(await wrappedLoan.getBalance(toBytes32('AVAX')));
            await wrappedLoan.stakeSAVAXYak(await wrappedLoan.getBalance(toBytes32('sAVAX')));

            await expect(nonOwnerWrappedLoan.unstakeAVAXYak(await wrappedLoan.getBalance(toBytes32('YY_AAVE_AVAX')))).to.be.reverted;
            await expect(nonOwnerWrappedLoan.unstakeSAVAXYak(await wrappedLoan.getBalance(toBytes32('YY_PTP_sAVAX')))).to.be.reverted;


            const diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress, owner);
            await diamondCut.pause();
            await replaceFacet('MockSolvencyFacetAlwaysSolvent', diamondAddress, ['isSolvent']);
            await diamondCut.unpause();

            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("1100"));


            await diamondCut.pause();
            await replaceFacet('SolvencyFacetMock', diamondAddress, ['isSolvent']);
            await diamondCut.unpause();

            const whitelistingContract = await ethers.getContractAt('SmartLoanGigaChadInterface', diamondAddress, owner);

            expect(await wrappedLoan.isSolvent()).to.be.false;

            await expect(nonOwnerWrappedLoan.unstakeAVAXYak(await wrappedLoan.getBalance(toBytes32('YY_AAVE_AVAX')))).to.be.reverted;
            await expect(nonOwnerWrappedLoan.unstakeSAVAXYak(await wrappedLoan.getBalance(toBytes32('YY_PTP_sAVAX')))).to.be.reverted;

            await whitelistingContract.whitelistLiquidators([liquidator.address]);

            await expect(nonOwnerWrappedLoan.unstakeAVAXYak(await wrappedLoan.getBalance(toBytes32('YY_AAVE_AVAX')))).not.to.be.reverted;
            await expect(nonOwnerWrappedLoan.unstakeSAVAXYak(await wrappedLoan.getBalance(toBytes32('YY_PTP_sAVAX')))).not.to.be.reverted;
        });
    });

    describe('A loan with staking liquidation', () => {
        let exchange: PangolinIntermediary,
            loan: SmartLoanGigaChadInterface,
            smartLoansFactory: SmartLoansFactory,
            wrappedLoan: any,
            wrappedLoanUpdated: any,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            liquidator: SignerWithAddress,
            yakStakingContract: Contract,
            MOCK_PRICES: any,
            MOCK_PRICES_UPDATED: any,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            diamondAddress: string,
            tokensPrices: Map<string, number>;

        before("deploy provider, exchange and pool", async () => {
            [owner, depositor, liquidator] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'USDC', 'YY_AAVE_AVAX'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]},
            ];

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor);
            tokensPrices = await getTokensPricesMap(assetsList, "avalanche", getRedstonePrices, []);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList);
            addMissingTokenContracts(tokenContracts, assetsList);

            yakStakingContract = await new ethers.Contract(yakAVAXStakingTokenAddress, erc20ABI, provider);

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

            exchange = await deployAndInitExchangeContract(owner, pangolinRouterAddress, tokenManager.address, supportedAssets, "PangolinIntermediary") as PangolinIntermediary;

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

        it("should deploy a smart loan, fund, borrow and invest", async () => {
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

            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("100")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("100"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("100"));
            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("300"));

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(400 * tokensPrices.get('AVAX')!, 0.1);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.closeTo(300 * tokensPrices.get('AVAX')!, 0.1);

            let debt = 300 * tokensPrices.get('AVAX')!;
            let maxDebt = 0.833333 * 400 * tokensPrices.get('AVAX')!;

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(maxDebt /debt, 0.01);

            const slippageTolerance = 0.03;

            let usdAmount = Math.floor(30 * tokensPrices.get('AVAX')!);
            let requiredAvaxAmount = tokensPrices.get('USDC')! * usdAmount * (1 + slippageTolerance) / tokensPrices.get('AVAX')!;

            await wrappedLoan.swapPangolin(
                toBytes32('AVAX'),
                toBytes32('USDC'),
                toWei(requiredAvaxAmount.toString()),
                parseUnits(usdAmount.toString(), await tokenContracts.get('USDC')!.decimals()),
            );
        });

        it("should stake in YieldYak", async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = await wrappedLoan.getThresholdWeightedValue();

            await wrappedLoan.stakeAVAXYak(
                toWei("305")
            );

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue, 5);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(fromWei(initialTWV), 5);
        });

        it("should withdraw collateral and part of borrowed funds, bring prices back to normal and liquidate the loan by supplying additional AVAX", async () => {
            // Define "updated" (USDC x 1000) prices and build an updated wrapped loan
            MOCK_PRICES_UPDATED = [
                {
                    dataFeedId: 'USDC',
                    value: tokensPrices.get('USDC')! * 1000
                },
                {
                    dataFeedId: 'AVAX',
                    value: tokensPrices.get('AVAX')!
                },
                {
                    dataFeedId: 'YY_AAVE_AVAX',
                    value: tokensPrices.get('YY_AAVE_AVAX')!
                }
            ]

            wrappedLoanUpdated = WrapperBuilder
                // @ts-ignore
                .wrap(loan)
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES_UPDATED,
                });

            // Withdraw funds using the updated prices and make sure the "standard" wrappedLoan is Insolvent as a consequence
            expect(await wrappedLoan.isSolvent()).to.be.true;

            const diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress, owner);
            await diamondCut.pause();
            await replaceFacet('MockSolvencyFacetAlwaysSolvent', diamondAddress, ['canRepayDebtFully']);
            await diamondCut.unpause();

            await wrappedLoanUpdated.withdraw(toBytes32("AVAX"), toWei("60"));

            expect(await wrappedLoanUpdated.isSolvent()).to.be.true;
            expect(await wrappedLoan.isSolvent()).to.be.false;

            let wrappedLoanLiquidator = WrapperBuilder
                // @ts-ignore
                .wrap(loan.connect(liquidator))
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });

            let initialStakedBalance = await yakStakingContract.balanceOf(wrappedLoan.address);

            let allowance = toWei("150");
            await tokenContracts.get('AVAX')!.connect(liquidator).approve(wrappedLoan.address, allowance);
            await tokenContracts.get('AVAX')!.connect(liquidator).deposit({value: allowance});

            let liquidatorsList = await ethers.getContractAt('ISmartLoanLiquidationFacet', diamondAddress, owner);
            await liquidatorsList.whitelistLiquidators([liquidator.address]);
            expect(await liquidatorsList.isLiquidatorWhitelisted(liquidator.address)).to.be.true;

            await wrappedLoanLiquidator.liquidateLoan([toBytes32("AVAX")], [toWei("150")], 50);
            let currentStakedBalance = await yakStakingContract.balanceOf(wrappedLoan.address);

            expect(fromWei(initialStakedBalance)).to.be.greaterThan(fromWei(currentStakedBalance));
            expect(fromWei(currentStakedBalance)).to.be.greaterThan(0);
            expect(await wrappedLoan.isSolvent()).to.be.true;
        });
    });
});

