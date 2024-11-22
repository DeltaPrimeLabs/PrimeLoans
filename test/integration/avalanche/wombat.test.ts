import {ethers, network, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import axios from 'axios';
import { constructSimpleSDK, SimpleFetchSDK, SwapSide } from '@paraswap/sdk';

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
    deployPools,
    fromBytes32,
    fromWei,
    getFixedGasSigners,
    getRedstonePrices,
    getTokensPricesMap,
    parseParaSwapRouteData,
    PoolAsset,
    PoolInitializationObject,
    recompileConstantsFile,
    time,
    toBytes32,
    toWei,
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import TOKEN_ADDRESSES from "../../../common/addresses/avax/token_addresses.json";
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import {
    AddressProvider,
    MockTokenManager,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
} from "../../../typechain";
import {Contract} from "ethers";
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';

chai.use(solidity);

const {deployContract, provider} = waffle;

describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('A loan with wombat staking operations', () => {
        let smartLoansFactory: SmartLoansFactory,
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
            let assetsList = ['AVAX', 'ggAVAX', 'sAVAX', 'WOMBAT_ggAVAX_AVAX_LP_AVAX', 'WOMBAT_ggAVAX_AVAX_LP_ggAVAX', 'WOMBAT_sAVAX_AVAX_LP_AVAX', 'WOMBAT_sAVAX_AVAX_LP_sAVAX'];
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
                []
            );
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

            await tokenManager.setDebtCoverageStaked(toBytes32("WOMBAT_ggAVAX_AVAX_LP_AVAX"), toWei("0.8333333333333333"));
            await tokenManager.setDebtCoverageStaked(toBytes32("WOMBAT_ggAVAX_AVAX_LP_ggAVAX"), toWei("0.8333333333333333"));
            await tokenManager.setDebtCoverageStaked(toBytes32("WOMBAT_sAVAX_AVAX_LP_AVAX"), toWei("0.8333333333333333"));
            await tokenManager.setDebtCoverageStaked(toBytes32("WOMBAT_sAVAX_AVAX_LP_sAVAX"), toWei("0.8333333333333333"));

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

            await deployAllFacets(diamondAddress);

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

        it("should fund a loan, get ggAVAX and sAVAX", async () => {
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.equal(1.157920892373162e+59);

            await network.provider.request({
                method: "hardhat_setBalance",
                params: ["0x6521a549834F5E6d253CD2e5F4fbe4048f86cd7b", "0xffffffffffffffff"],
            });
            await network.provider.request({
                method: "hardhat_impersonateAccount",
                params: ["0x6521a549834F5E6d253CD2e5F4fbe4048f86cd7b"],
            });
            const whale = await ethers.provider.getSigner('0x6521a549834F5E6d253CD2e5F4fbe4048f86cd7b');

            await tokenContracts.get('WOMBAT_ggAVAX_AVAX_LP_AVAX')!.connect(whale).transfer(owner.address, toWei("10"));
            await tokenContracts.get('WOMBAT_ggAVAX_AVAX_LP_AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("10"));
            await tokenContracts.get('WOMBAT_ggAVAX_AVAX_LP_ggAVAX')!.connect(whale).transfer(owner.address, toWei("10"));
            await tokenContracts.get('WOMBAT_ggAVAX_AVAX_LP_ggAVAX')!.connect(owner).approve(wrappedLoan.address, toWei("10"));
            await tokenContracts.get('WOMBAT_sAVAX_AVAX_LP_AVAX')!.connect(whale).transfer(owner.address, toWei("10"));
            await tokenContracts.get('WOMBAT_sAVAX_AVAX_LP_AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("10"));
            await tokenContracts.get('WOMBAT_sAVAX_AVAX_LP_sAVAX')!.connect(whale).transfer(owner.address, toWei("10"));
            await tokenContracts.get('WOMBAT_sAVAX_AVAX_LP_sAVAX')!.connect(owner).approve(wrappedLoan.address, toWei("10"));

            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("300")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("300"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("300"));

            let swapData = await getSwapData('AVAX', 18, 'ggAVAX', 18, toWei('50'));
            await wrappedLoan.paraSwapV2(swapData.selector, swapData.data, TOKEN_ADDRESSES['AVAX'], toWei('50'), TOKEN_ADDRESSES['ggAVAX'], 1);

            await network.provider.request({
                method: "hardhat_setBalance",
                params: ["0x0f1DfeF1a40557d279d0de6E49aB306891A638b8", "0xffffffffffffffff"],
            });
            await network.provider.request({
                method: "hardhat_impersonateAccount",
                params: ["0x0f1DfeF1a40557d279d0de6E49aB306891A638b8"],
            });
            const sAvaxWhale = await ethers.provider.getSigner('0x0f1DfeF1a40557d279d0de6E49aB306891A638b8');
            await tokenContracts.get('sAVAX')!.connect(sAvaxWhale).transfer(owner.address, toWei("50"));
            await tokenContracts.get('sAVAX')!.connect(owner).approve(wrappedLoan.address, toWei("50"));
            await wrappedLoan.fund(toBytes32("sAVAX"), toWei("50"));

            // swapData = await getSwapData('AVAX', 18, 'sAVAX', 18, toWei('50'));
            // await wrappedLoan.paraSwapV2(swapData.selector, swapData.data, TOKEN_ADDRESSES['AVAX'], toWei('50'), TOKEN_ADDRESSES['sAVAX'], 1);
        });

        it("should fail to deposit as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.depositSavaxToAvaxSavax(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.depositGgavaxToAvaxGgavax(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.depositAvaxToAvaxSavax(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.depositAvaxToAvaxGgavax(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.depositAndStakeAvaxSavaxLpSavax(toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.depositAndStakeAvaxSavaxLpAvax(toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.depositAvaxGgavaxLpGgavax(toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.depositAndStakeAvaxGgavaxLpAvax(toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to withdraw as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.withdrawSavaxFromAvaxSavax(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.withdrawGgavaxFromAvaxGgavax(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.withdrawAvaxFromAvaxSavax(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.withdrawAvaxFromAvaxGgavax(toWei("9999"), toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.unstakeAndWithdrawAvaxSavaxLpSavax(toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.unstakeAndWithdrawAvaxSavaxLpAvax(toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.unstakeAndWithdrawAvaxGgavaxLpGgavax(toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.unstakeAndWithdrawAvaxGgavaxLpAvax(toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should deposit sAVAX-AVAX pool sAVAX lp", async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());

            await wrappedLoan.depositAndStakeAvaxSavaxLpSavax(toWei("10"));

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue + 10 * tokensPrices.get("WOMBAT_sAVAX_AVAX_LP_sAVAX")!, 20);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
        });

        it("should deposit sAVAX-AVAX pool AVAX lp", async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());

            await wrappedLoan.depositAndStakeAvaxSavaxLpAvax(toWei("10"));

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue + 10 * tokensPrices.get("WOMBAT_sAVAX_AVAX_LP_AVAX")!, 20);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
        });

        it("should deposit ggAVAX-AVAX pool ggAVAX lp", async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());

            await wrappedLoan.depositAvaxGgavaxLpGgavax(toWei("10"));

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue + 10 * tokensPrices.get("WOMBAT_ggAVAX_AVAX_LP_ggAVAX")!, 20);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
        });

        it("should deposit ggAVAX-AVAX pool AVAX lp", async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());

            await wrappedLoan.depositAndStakeAvaxGgavaxLpAvax(toWei("10"));

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue + 10 * tokensPrices.get("WOMBAT_ggAVAX_AVAX_LP_AVAX")!, 20);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
        });

        it("should claim rewards", async () => {
            await time.increase(3600);

            await wrappedLoan.claimAllWombatRewards();
        });

        it("should withdraw sAVAX-AVAX pool sAVAX lp", async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());

            await wrappedLoan.unstakeAndWithdrawAvaxSavaxLpSavax(toWei("9999"));

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue - 10 * tokensPrices.get("WOMBAT_sAVAX_AVAX_LP_sAVAX")!, 20);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
        });

        it("should withdraw sAVAX-AVAX pool AVAX lp", async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());

            await wrappedLoan.unstakeAndWithdrawAvaxSavaxLpAvax(toWei("9999"));

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue - 10 * tokensPrices.get("WOMBAT_sAVAX_AVAX_LP_AVAX")!, 20);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
        });

        it("should withdraw ggAVAX-AVAX pool ggAVAX lp", async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());

            await wrappedLoan.unstakeAndWithdrawAvaxGgavaxLpGgavax(toWei("9999"));

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue - 10 * tokensPrices.get("WOMBAT_ggAVAX_AVAX_LP_ggAVAX")!, 20);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
        });

        it("should withdraw ggAVAX-AVAX pool AVAX lp", async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());

            await wrappedLoan.unstakeAndWithdrawAvaxGgavaxLpAvax(toWei("9999"));

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue - 10 * tokensPrices.get("WOMBAT_ggAVAX_AVAX_LP_AVAX")!, 20);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
        });

        it("should deposit sAVAX", async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            expect(await loanOwnsAsset("sAVAX")).to.be.true;

            await wrappedLoan.depositSavaxToAvaxSavax(toWei("9999"), 0);

            expect(await loanOwnsAsset("sAVAX")).to.be.false;

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue, 20);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 20);
        });

        it("should deposit ggAVAX", async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            expect(await loanOwnsAsset("ggAVAX")).to.be.true;

            await wrappedLoan.depositGgavaxToAvaxGgavax(toWei("9999"), 0);

            expect(await loanOwnsAsset("ggAVAX")).to.be.false;

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue, 20);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 20);
        });

        it("should deposit AVAX to sAVAX-AVAX pool", async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            await wrappedLoan.depositAvaxToAvaxSavax(toWei("50"), 0);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue, 20);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 20);
        });

        it("should deposit AVAX to ggAVAX-AVAX pool", async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            await wrappedLoan.depositAvaxToAvaxGgavax(toWei("50"), 0);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue, 20);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 20);
        });

        it("should claim rewards", async () => {
            await time.increase(3600);

            await wrappedLoan.claimAllWombatRewards();
        });

        it("should withdraw sAVAX from sAVAX-AVAX pool AVAX lp", async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            expect(await loanOwnsAsset("sAVAX")).to.be.false;

            await wrappedLoan.withdrawSavaxFromAvaxSavaxInOtherToken(toWei("20"), 0);

            expect(await loanOwnsAsset("sAVAX")).to.be.true;

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue, 20);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 20);
        });

        it("should withdraw ggAVAX from ggAVAX-AVAX pool AVAX lp", async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            expect(await loanOwnsAsset("ggAVAX")).to.be.false;

            await wrappedLoan.withdrawGgavaxFromAvaxGgavaxInOtherToken(toWei("20"), 0);

            expect(await loanOwnsAsset("ggAVAX")).to.be.true;

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue, 20);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 20);
        });

        it("should withdraw AVAX from sAVAX-AVAX pool sAVAX lp", async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            await wrappedLoan.withdrawAvaxFromAvaxSavaxInOtherToken(toWei("20"), 0);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue, 20);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 20);
        });

        it("should withdraw AVAX from ggAVAX-AVAX pool ggAVAX lp", async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            await wrappedLoan.withdrawAvaxFromAvaxGgavaxInOtherToken(toWei("20"), 0);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue, 20);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 20);
        });

        it("should withdraw sAVAX", async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            await wrappedLoan.withdrawSavaxFromAvaxSavax(toWei("9999"), 0);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue, 20);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 20);
        });

        it("should withdraw ggAVAX", async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            await wrappedLoan.withdrawGgavaxFromAvaxGgavax(toWei("9999"), 0);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue, 20);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 20);
        });

        it("should withdraw AVAX from sAVAX-AVAX pool", async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            await wrappedLoan.withdrawAvaxFromAvaxSavax(toWei("9999"), 0);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue, 20);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 20);
        });

        it("should withdraw AVAX from ggAVAX-AVAX pool", async () => {
            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            await wrappedLoan.withdrawAvaxFromAvaxGgavax(toWei("9999"), 0);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(initialTotalValue, 20);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 20);
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
