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
    getTokensPricesMap,
    PoolAsset,
    PoolInitializationObject,
    recompileConstantsFile,
    toBytes32,
    toWei,
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
const curveTokenAddress = TOKEN_ADDRESSES['crvUSDBTCETH'];
const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';

describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('A loan with staking operations', () => {
        let smartLoansFactory: SmartLoansFactory,
            exchange: PangolinIntermediary,
            curveTokenContract: Contract,
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
            let assetsList = ['DAIe', 'USDCe', "USDT.e", 'WBTCe', 'ETH', 'AVAX', 'crvUSDBTCETH'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]},
            ];

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor);
            tokensPrices = await getTokensPricesMap(
                ['ETH', 'AVAX'],
                "avalanche",
                getRedstonePrices,
                [
                    {symbol: 'DAIe', value: 1},
                    {symbol: 'USDCe', value: 1},
                    {symbol: "USDT.e", value: 1},
                    {symbol: 'WBTCe', value: 28000},
                    {symbol: 'crvUSDBTCETH', value: 1012},
                ]
            );
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList);
            addMissingTokenContracts(tokenContracts, assetsList);

            curveTokenContract = await new ethers.Contract(curveTokenAddress, erc20ABI, provider);

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
            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("1"));

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(201 * tokensPrices.get('AVAX')!, 0.01);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(167.5, 0.01);
        });

        it("should fail to stake as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.stakeCurve([toWei("9999"), toWei("9999"), toWei("9999"), toWei("9999"), toWei("9999")])).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to unstake tokens as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.unstakeCurve(toWei("9999"), [0, 0, 0, 0, 0])).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to unstake one token as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.unstakeOneTokenCurve(0, toWei("9999"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should stake tokens", async () => {
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let initialStakedBalance = await curveTokenContract.balanceOf(wrappedLoan.address);
            expect(initialStakedBalance).to.be.equal(0);

            await expect(wrappedLoan.stakeCurve([0, 0, 0, 0, 0])).to.be.revertedWith("Cannot stake 0 tokens");

            const tokens = ['DAIe', 'USDCe', "USDT.e", 'WBTCe', 'ETH'];
            for (let i = 0; i < tokens.length; i++) {
                await wrappedLoan.swapPangolin(
                    toBytes32('AVAX'),
                    toBytes32(tokens[i]),
                    toWei('20'),
                    0,
                );
                expect(await wrappedLoan.getBalance(toBytes32(tokens[i]))).to.be.gt(0);
            };

            // Should stake max if amount > balance
            await wrappedLoan.stakeCurve([toWei("99999999"), toWei("99999999"), toWei("99999999"), toWei("99999999"), toWei("99999999")]);
            for (let i = 0; i < tokens.length; i++) {
                expect(await wrappedLoan.getBalance(toBytes32(tokens[i]))).to.be.eq(0);
            };

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 20);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 300);
        });

        it("should unstake DAI", async () => {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            await wrappedLoan.unstakeOneTokenCurve(0, parseUnits(Math.round(20 * tokensPrices.get('AVAX')!).toString(), BigNumber.from("6")));

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 25);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 4);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 60);
        });

        it("should unstake all tokens", async () => {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            await wrappedLoan.unstakeCurve(toWei("99999999"), [0, 0, 0, 0, 0]);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 250);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 20);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 300);
        });
    });
});
