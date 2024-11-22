import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import IYakWrapRouterArtifact from '../../../artifacts/contracts/interfaces/IYakWrapRouter.sol/IYakWrapRouter.json';
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
    erc20ABI, formatUnits,
    fromWei,
    getFixedGasSigners,
    getRedstonePrices,
    getTokensPricesMap,
    PoolAsset,
    PoolInitializationObject,
    recompileConstantsFile,
    toBytes32,
    toWei
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import {parseUnits} from "ethers/lib/utils";
import {
    IYakWrapRouter,
    AddressProvider,
    MockTokenManager,
    PangolinIntermediary,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
} from "../../../typechain";
import { IVectorFinanceCompounder__factory } from './../../../typechain/factories/IVectorFinanceCompounder__factory';
import {BigNumber, Contract} from "ethers";
import {deployDiamond, replaceFacet} from '../../../tools/diamond/deploy-diamond';
import TOKEN_ADDRESSES from '../../../common/addresses/avax/token_addresses.json';

chai.use(solidity);

const {deployContract, provider} = waffle;

const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';

const SteakHutAvaxUsdcLP = '0x668530302c6ecc4ebe693ec877b79300ac72527c';
const SteakHutBtcAvaxLP = '0x536d7e7423e8fb799549caf574cfa12aae95ffcd';
const SteakHutUsdteUsdtLP = '0x9f44e67ba256c18411bb041375e572e3dd11fa72';

describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('A loan with SteakHut staking operations', () => {
        let smartLoansFactory: SmartLoansFactory,
            steakhutAvaxUsdcLpToken: Contract,
            steakhutBtcAvaxLpToken: Contract,
            steakhutUsdteUsdtLpToken: Contract,
            steakhutEurocUsdcLpToken: Contract,
            steakhutJoeAvaxLpToken: Contract,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            nonOwnerWrappedLoan: any,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            tokensPrices: Map<string, number>,
            owner: SignerWithAddress,
            nonOwner: SignerWithAddress,
            depositor: SignerWithAddress,
            MOCK_PRICES: any,
            diamondAddress: any;

        before("deploy factory and pool", async () => {
            [owner, nonOwner, depositor] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'USDC', 'EUROC', 'JOE', 'BTC', "USDT.e", 'USDT', 'SHLB_AVAX-USDC_B', 'SHLB_BTC.b-AVAX_B', 'SHLB_USDT.e-USDt_C', 'SHLB_EUROC-USDC_V2_1_B', 'SHLB_JOE-AVAX_B'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]}
            ];

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor, 2000);

            tokensPrices = await getTokensPricesMap(
                assetsList,
                "avalanche",
                getRedstonePrices,
                []
            );
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList);
            addMissingTokenContracts(tokenContracts, assetsList.filter(asset => !Array.from(tokenContracts.keys()).includes(asset)));
            supportedAssets

            steakhutAvaxUsdcLpToken = await new ethers.Contract(TOKEN_ADDRESSES["SHLB_AVAX-USDC_B"], erc20ABI, provider);
            steakhutBtcAvaxLpToken = await new ethers.Contract(TOKEN_ADDRESSES["SHLB_BTC.b-AVAX_B"], erc20ABI, provider);
            steakhutUsdteUsdtLpToken = await new ethers.Contract(TOKEN_ADDRESSES["SHLB_USDT.e-USDt_C"], erc20ABI, provider);
            steakhutEurocUsdcLpToken = await new ethers.Contract(TOKEN_ADDRESSES["SHLB_EUROC-USDC_V2_1_B"], erc20ABI, provider);
            steakhutJoeAvaxLpToken = await new ethers.Contract(TOKEN_ADDRESSES["SHLB_JOE-AVAX_B"], erc20ABI, provider);

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

            let exchange = await deployAndInitExchangeContract(owner, pangolinRouterAddress, tokenManager.address, supportedAssets, "PangolinIntermediary");

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
                .wrap(loan.connect(nonOwner))
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });
        });

        it("should fund a loan, get USDC and borrow", async () => {
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.equal(1.157920892373162e+59);

            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("300")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("300"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("300"));

            await wrappedLoan.swapPangolin(toBytes32("AVAX"), toBytes32("USDC"), toWei("50"), 0);

            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("300"));
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(600 * tokensPrices.get('AVAX')!, 80);
        });

        it("should fail to stake as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.stakeSteakHutAVAXUSDC(toWei("9999"), toWei("9999"), 0, 0)).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.stakeSteakHutBTCAVAX(toWei("9999"), toWei("9999"), 0, 0)).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.stakeSteakHutUSDTeUSDT(toWei("9999"), toWei("9999"), 0, 0)).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to unstake as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.unstakeSteakHutAVAXUSDC(toWei("9999"), 0, 0)).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.unstakeSteakHutBTCAVAX(toWei("9999"), 0, 0)).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.unstakeSteakHutUSDTeUSDT(toWei("9999"), 0, 0)).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should stake AVAX/USDC", async () => {
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let initialStakedBalance = await steakhutAvaxUsdcLpToken.balanceOf(wrappedLoan.address);
            expect(initialStakedBalance).to.be.equal(0);

            await expect(wrappedLoan.stakeSteakHutAVAXUSDC(0, 0, 0, 0)).to.be.revertedWith("Cannot stake 0 tokens");

            await wrappedLoan.swapPangolin(
                toBytes32('AVAX'),
                toBytes32('USDC'),
                toWei('20'),
                0,
            );
            expect(await wrappedLoan.getBalance(toBytes32('USDC'))).to.be.gt(0);

            // Should stake max if amount > balance
            await wrappedLoan.stakeSteakHutAVAXUSDC(toWei("99999999"), toWei("99999999"), 0, 0);

            expect(await steakhutAvaxUsdcLpToken.balanceOf(wrappedLoan.address)).to.be.gt(0);

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 5);
        });

        it("should unstake AVAX/USDC", async () => {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            await wrappedLoan.unstakeSteakHutAVAXUSDC(toWei("99999999"), 0, 0);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 5);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 5);
        });

        it("should stake BTC/AVAX", async () => {
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let initialStakedBalance = await steakhutBtcAvaxLpToken.balanceOf(wrappedLoan.address);
            expect(initialStakedBalance).to.be.equal(0);

            await expect(wrappedLoan.stakeSteakHutBTCAVAX(0, 0, 0, 0)).to.be.revertedWith("Cannot stake 0 tokens");

            await wrappedLoan.swapTraderJoe(
                toBytes32('AVAX'),
                toBytes32('BTC'),
                toWei('20'),
                0,
            );
            expect(await wrappedLoan.getBalance(toBytes32('BTC'))).to.be.gt(0);

            // Should stake max if amount > balance
            await wrappedLoan.stakeSteakHutBTCAVAX(toWei("99999999"), toWei("99999999"), 0, 0);

            expect(await steakhutBtcAvaxLpToken.balanceOf(wrappedLoan.address)).to.be.gt(0);

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 5);
        });

        it("should unstake BTC/AVAX", async () => {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            await wrappedLoan.unstakeSteakHutBTCAVAX(toWei("99999999"), 0, 0);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 10);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 10);
        });

        it("should stake USDT.e/USDT", async () => {
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let initialStakedBalance = await steakhutUsdteUsdtLpToken.balanceOf(wrappedLoan.address);
            expect(initialStakedBalance).to.be.equal(0);

            await expect(wrappedLoan.stakeSteakHutUSDTeUSDT(0, 0, 0, 0)).to.be.revertedWith("Cannot stake 0 tokens");

            await wrappedLoan.swapPangolin(
                toBytes32('AVAX'),
                toBytes32("USDT.e"),
                toWei('20'),
                0,
            );
            expect(await wrappedLoan.getBalance(toBytes32("USDT.e"))).to.be.gt(0);
            await wrappedLoan.swapPangolin(
                toBytes32('AVAX'),
                toBytes32('USDT'),
                toWei('20'),
                0,
            );
            expect(await wrappedLoan.getBalance(toBytes32('USDT'))).to.be.gt(0);

            // Should stake max if amount > balance
            await wrappedLoan.stakeSteakHutUSDTeUSDT(toWei("99999999"), toWei("99999999"), 0, 0);

            expect(await steakhutUsdteUsdtLpToken.balanceOf(wrappedLoan.address)).to.be.gt(0);

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 5);
        });

        it("should unstake USDT.e/USDT", async () => {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            await wrappedLoan.unstakeSteakHutUSDTeUSDT(toWei("99999999"), 0, 0);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 5);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 5);
        });


        it("should stake EUROC/USDC", async () => {
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let initialStakedBalance = await steakhutUsdteUsdtLpToken.balanceOf(wrappedLoan.address);
            expect(initialStakedBalance).to.be.equal(0);

            await expect(wrappedLoan.stakeSteakHutEUROCUSDC(0, 0, 0, 0)).to.be.revertedWith("Cannot stake 0 tokens");

            const yieldYakWrapRouterAddress = '0x44f4737C3Bb4E5C1401AE421Bd34F135E0BB8394';
            let yieldYakWrapRouter = new ethers.Contract(yieldYakWrapRouterAddress, IYakWrapRouterArtifact.abi, provider) as IYakWrapRouter;
            const gasPrice = ethers.utils.parseUnits('225', 'gwei');
            // TODO: Resolve problem with yakswap local query
            let queryRes = await yieldYakWrapRouter.findBestPathAndWrap(toWei("20"), TOKEN_ADDRESSES["AVAX"], TOKEN_ADDRESSES["EUROC"], 1, gasPrice);

            const minGlpAmount = parseUnits(String(20 * tokensPrices.get("AVAX")! / tokensPrices.get("EUROC")! * 95 / 100), BigNumber.from("6"));

            await wrappedLoan.yakSwap(
                queryRes.amounts[0],
                minGlpAmount,
                queryRes.path,
                queryRes.adapters
            );
            expect(await wrappedLoan.getBalance(toBytes32("EUROC"))).to.be.gt(0);

            await wrappedLoan.swapPangolin(
                toBytes32('AVAX'),
                toBytes32('USDC'),
                toWei('20'),
                0,
            );
            expect(await wrappedLoan.getBalance(toBytes32('USDC'))).to.be.gt(0);

            // Should stake max if amount > balance
            await wrappedLoan.stakeSteakHutEUROCUSDC(toWei("99999999"), toWei("99999999"), 0, 0);

            expect(await steakhutEurocUsdcLpToken.balanceOf(wrappedLoan.address)).to.be.gt(0);

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 5);
        });

        it("should unstake EUROC/USDC", async () => {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            await wrappedLoan.unstakeSteakHutEUROCUSDC(toWei("99999999"), 0, 0);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 5);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 5);
        });


        it("should stake JOE/AVAX", async () => {

            let initialStakedBalance = await steakhutUsdteUsdtLpToken.balanceOf(wrappedLoan.address);
            expect(initialStakedBalance).to.be.equal(0);

            await expect(wrappedLoan.stakeSteakHutJOEAVAX(0, 0, 0, 0)).to.be.revertedWith("Cannot stake 0 tokens");

            await wrappedLoan.swapPangolin(
                toBytes32('AVAX'),
                toBytes32("JOE"),
                toWei('20'),
                0,
            );
            expect(await wrappedLoan.getBalance(toBytes32("JOE"))).to.be.gt(0);

            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());
            // Should stake max if amount > balance
            await wrappedLoan.stakeSteakHutJOEAVAX(toWei("99999999"), toWei("99999999"), 0, 0);

            expect(await steakhutJoeAvaxLpToken.balanceOf(wrappedLoan.address)).to.be.gt(0);

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 5);
        });

        it("should unstake JOE/AVAX", async () => {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            await wrappedLoan.unstakeSteakHutJOEAVAX(toWei("99999999"), 0, 0);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 5);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 5);
        });
    });
});
