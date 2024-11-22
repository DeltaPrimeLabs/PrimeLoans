import chai, {expect} from 'chai'
import {deployContract, solidity} from "ethereum-waffle";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import AddressProviderArtifact from '../../../artifacts/contracts/AddressProvider.sol/AddressProvider.json';
import {
    addMissingTokenContracts,
    Asset, convertAssetsListToSupportedAssets, convertTokenPricesMapToMockPrices,
    deployAllFacets, deployPools, fromWei,
    getFixedGasSigners, getRedstonePrices, getTokensPricesMap,
    PoolAsset, PoolInitializationObject,
    deployAndInitExchangeContract,
    recompileConstantsFile,
    toBytes32,
    toWei, ZERO
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import { parseUnits } from "ethers/lib/utils";
import {
    AddressProvider,
    TraderJoeIntermediary,
    MockTokenManager,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
} from "../../../typechain";
import {ethers} from "hardhat";
import {deployDiamond, replaceFacet} from '../../../tools/diamond/deploy-diamond';
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import CACHE_LAYER_URLS from "../../../common/redstone-cache-layer-urls.json";
import TOKEN_ADDRESSES from "../../../common/addresses/avax/token_addresses.json";
import { Contract, BigNumber } from "ethers";

chai.use(solidity);

const traderJoeRouterAddress = "0x60aE616a2155Ee3d9A68541Ba4544862310933d4";

describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('A loan with edge LTV cases', () => {
        let smartLoansFactory: SmartLoansFactory,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            MOCK_PRICES: any,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            tokensPrices: Map<string, number>;

        before("deploy factory, exchange, wrapped native token pool and USD pool", async () => {
            [owner, depositor] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'MCKUSD', 'ETH'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]},
                {name: 'MCKUSD', airdropList: [owner, depositor]}
            ];

            let diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor);
            tokensPrices = await getTokensPricesMap(assetsList.filter(el => el !== 'MCKUSD'), "avalanche", getRedstonePrices, [{symbol: 'MCKUSD', value: 1}]);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList, {MCKUSD: tokenContracts.get('MCKUSD')!.address});
            addMissingTokenContracts(tokenContracts, assetsList);

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
                'lib',
                5020
            );

            await deployAllFacets(diamondAddress);
            const diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress, owner);
            await diamondCut.pause();
            await replaceFacet('MockSolvencyFacetAlwaysSolvent', diamondAddress, ['isSolvent']);
            await diamondCut.unpause();
        });

        it("should deploy a smart loan", async () => {
            await smartLoansFactory.connect(owner).createLoan();

            const loanAddress = await smartLoansFactory.getLoanForOwner(owner.address);
            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loanAddress, owner);

            wrappedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan)
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });
        });

        it("should check debt equal to 0", async () => {
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.equal(1.157920892373162e+59);
            expect(fromWei(await wrappedLoan.getHealthMeter())).to.be.eq(100);
            expect(await wrappedLoan.isSolvent()).to.be.true;

            await tokenContracts.get('MCKUSD')!.connect(owner).approve(wrappedLoan.address, toWei("100"));
            await wrappedLoan.fund(toBytes32("MCKUSD"), toWei("100"));

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.equal(1.157920892373162e+59);
            expect(fromWei(await wrappedLoan.getHealthMeter())).to.be.eq(100);
        });

        it("should check debt greater than 0 and lesser than totalValue", async () => {
            await wrappedLoan.borrow(toBytes32("MCKUSD"), toWei("25"));

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(4.1666667, 0.000001);
            expect(fromWei(await wrappedLoan.getHealthMeter())).to.be.eq(95);
        });

        it("should check health ratio above 1", async () => {
            await wrappedLoan.borrow(toBytes32("MCKUSD"), toWei("474"));

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(1.000334, 0.000001);
            expect(fromWei(await wrappedLoan.getHealthMeter())).to.be.closeTo(0.2, 0.001);
        });

        it("should check health ratio equals to 1", async () => {
            await wrappedLoan.borrow(toBytes32("MCKUSD"), toWei("1"));

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(1, 0.00001);
            expect(fromWei(await wrappedLoan.getHealthMeter())).to.be.eq(0);
        });

        it("should check health ratio below 1", async () => {
            await wrappedLoan.borrow(toBytes32("MCKUSD"), toWei("1"));

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(0.999667, 0.000001);
            expect(fromWei(await wrappedLoan.getHealthMeter())).to.be.eq(0);
        });
    });

    describe('A loan with non-borrowable asset', () => {
        let smartLoansFactory: SmartLoansFactory,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            MOCK_PRICES: any,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            tokensPrices: Map<string, number>;

        before("deploy factory, exchange, wrapped native token pool and USD pool", async () => {
            [owner, depositor] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'ETH', 'YY_AAVE_AVAX'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]},
            ];

            let diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor);
            tokensPrices = await getTokensPricesMap(assetsList, getRedstonePrices, []);
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
                5020
            );

            await deployAllFacets(diamondAddress);
            const diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress, owner);
            await diamondCut.pause();
            await replaceFacet('MockSolvencyFacetAlwaysSolvent', diamondAddress, ['isSolvent']);
            await diamondCut.unpause();
        });

        it("should deploy a smart loan", async () => {
            await smartLoansFactory.connect(owner).createLoan();

            const loanAddress = await smartLoansFactory.getLoanForOwner(owner.address);
            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loanAddress, owner);

            wrappedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan)
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });
        });

        it("should check debt equal to 0", async () => {
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.equal(1.157920892373162e+59);
            expect(fromWei(await wrappedLoan.getHealthMeter())).to.be.eq(100);
            expect(await wrappedLoan.isSolvent()).to.be.true;

            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("100")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("100"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("100"));

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.equal(1.157920892373162e+59);
            expect(fromWei(await wrappedLoan.getHealthMeter())).to.be.eq(100);
        });

        it("should check debt greater than 0 and lesser than totalValue", async () => {
            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("25"));

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(4.1666667, 0.000001);
            expect(fromWei(await wrappedLoan.getHealthMeter())).to.be.eq(95);
        });

        it("should check health ratio above 1", async () => {
            const stakedAvaxAmount = 50;

            await wrappedLoan.stakeAVAXYak(
                toWei(stakedAvaxAmount.toString())
            );

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(4.1666667, 0.001);
            expect(fromWei(await wrappedLoan.getHealthMeter())).to.be.closeTo(95, 0.001);
        });
    });

    describe("A loan with less balance than borrowed", () => {
        let smartLoansFactory: SmartLoansFactory,
            exchange: TraderJoeIntermediary,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            owner: SignerWithAddress,
            borrower: SignerWithAddress,
            depositor: SignerWithAddress,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            tokensPrices: Map<string, number>;

        before(
            "deploy factory, wrapped native token pool and USD pool",
            async () => {
                [owner, depositor, borrower] = await getFixedGasSigners(10000000);

                let assetsList = ["AVAX", "USDC"];
                let poolNameAirdropList: Array<PoolInitializationObject> = [
                    { name: "AVAX", airdropList: [borrower, depositor, owner] },
                    { name: "USDC", airdropList: [] },
                ];

                smartLoansFactory = (await deployContract(
                    owner,
                    SmartLoansFactoryArtifact
                )) as SmartLoansFactory;

                await deployPools(
                    smartLoansFactory,
                    poolNameAirdropList,
                    tokenContracts,
                    poolContracts,
                    lendingPools,
                    owner,
                    depositor
                );
                tokensPrices = await getTokensPricesMap(
                    assetsList,
                    "avalanche",
                    getRedstonePrices,
                    []
                );
                supportedAssets = convertAssetsListToSupportedAssets(assetsList);
                addMissingTokenContracts(tokenContracts, assetsList);

                let diamondAddress = await deployDiamond();

                let tokenManager = (await deployContract(
                    owner,
                    MockTokenManagerArtifact,
                    []
                )) as MockTokenManager;

                await tokenManager
                    .connect(owner)
                    .initialize(supportedAssets, lendingPools);
                await tokenManager
                    .connect(owner)
                    .setFactoryAddress(smartLoansFactory.address);

                let addressProvider = await deployContract(
                    owner,
                    AddressProviderArtifact,
                    []
                ) as AddressProvider;

                await recompileConstantsFile(
                    "local",
                    "DeploymentConstants",
                    [],
                    tokenManager.address,
                    addressProvider.address,
                    diamondAddress,
                    smartLoansFactory.address,
                    "lib"
                );

                exchange = (await deployAndInitExchangeContract(
                    owner,
                    traderJoeRouterAddress,
                    tokenManager.address,
                    supportedAssets,
                    "TraderJoeIntermediary"
                )) as TraderJoeIntermediary;

                await smartLoansFactory.initialize(diamondAddress, tokenManager.address);

                await recompileConstantsFile(
                    "local",
                    "DeploymentConstants",
                    [
                        {
                            facetPath: "./contracts/facets/avalanche/TraderJoeDEXFacet.sol",
                            contractAddress: exchange.address,
                        },
                    ],
                    tokenManager.address,
                    addressProvider.address,
                    diamondAddress,
                    smartLoansFactory.address,
                    "lib"
                );

                await deployAllFacets(diamondAddress, false);
            }
        );

        it("should deploy a smart loan", async () => {
            await smartLoansFactory.connect(borrower).createLoan();

            const loan_proxy_address = await smartLoansFactory.getLoanForOwner(
                borrower.address
            );
            loan = await ethers.getContractAt(
                "SmartLoanGigaChadInterface",
                loan_proxy_address,
                borrower
            );

            // @ts-ignore
            wrappedLoan = WrapperBuilder.wrap(loan).usingDataService(
                {
                    dataServiceId: "redstone-avalanche-prod",
                    uniqueSignersCount: 3,
                    dataFeeds: ["AVAX", "ETH", "USDC", "BTC"],
                    // @ts-ignore
                    disablePayloadsDryRun: true,
                },
                CACHE_LAYER_URLS.urls
            );
        });

        it("should fund and borrow", async () => {
            expect(fromWei(await wrappedLoan.getHealthMeter())).to.be.eq(100);

            await tokenContracts
                .get("AVAX")!
                .connect(borrower)
                .deposit({ value: toWei("100") });
            await tokenContracts
                .get("AVAX")!
                .connect(borrower)
                .approve(wrappedLoan.address, toWei("100"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("100"));

            const borrowAmount = toWei("50");
            await wrappedLoan.borrow(toBytes32("AVAX"), borrowAmount);

            expect(fromWei(await wrappedLoan.getHealthMeter())).to.be.eq(90);
        });

        it("should invest to yield yak", async () => {
            const usdcDeposited = parseUnits("500", BigNumber.from("6"));
            const amountSwapped = toWei("50");
            await tokenContracts
                .get("AVAX")!
                .connect(borrower)
                .deposit({ value: amountSwapped });
            await tokenContracts
                .get("AVAX")!
                .connect(borrower)
                .approve(exchange.address, amountSwapped);
            await tokenContracts
                .get("AVAX")!
                .connect(borrower)
                .transfer(exchange.address, amountSwapped);

            await exchange
                .connect(borrower)
                .swap(
                    TOKEN_ADDRESSES["AVAX"],
                    TOKEN_ADDRESSES["USDC"],
                    amountSwapped,
                    usdcDeposited
                );
            await tokenContracts
                .get("USDC")!
                .connect(borrower)
                .approve(wrappedLoan.address, usdcDeposited);
            await wrappedLoan.fund(toBytes32("USDC"), usdcDeposited);

            const investAmount = toWei("110");

            await wrappedLoan.vectorStakeWAVAX1(investAmount);

            await wrappedLoan.getHealthMeter();
        });
    });
});
