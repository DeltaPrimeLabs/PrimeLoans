import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import TOKEN_ADDRESSES from '../../../common/addresses/avax/token_addresses.json';
import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import AddressProviderArtifact from '../../../artifacts/contracts/AddressProvider.sol/AddressProvider.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import {
    addMissingTokenContracts,
    Asset,
    convertAssetsListToSupportedAssets,
    convertTokenPricesMapToMockPrices,
    deployAllFacets,
    deployAndInitExchangeContract,
    deployPools, erc20ABI,
    formatUnits,
    fromBytes32,
    fromWei,
    getFixedGasSigners,
    getRedstonePrices,
    getTokensPricesMap, LPAbi,
    PoolAsset,
    PoolInitializationObject,
    recompileConstantsFile,
    toBytes32,
    toWei
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {
    AddressProvider,
    MockTokenManager,
    PangolinIntermediary,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
} from "../../../typechain";
import {BigNumber, Contract} from "ethers";
import {parseUnits} from "ethers/lib/utils";
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';

chai.use(solidity);

const {deployContract, provider} = waffle;
const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';

describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('A loan with max exposure limitations', () => {
        let exchange: PangolinIntermediary,
            smartLoansFactory: SmartLoansFactory,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            tokenManager: MockTokenManager,
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
            let assetsList = ['AVAX', 'ETH', 'MCKUSD', 'USDC', 'sAVAX', 'PNG_AVAX_USDC_LP', 'YY_AAVE_AVAX'];
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

            tokenManager = await deployContract(
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
        });

        it("should set and check identifier to exposure group mapping", async () => {
            expect(fromBytes32(await tokenManager.identifierToExposureGroup(toBytes32("AVAX")))).to.be.equal("");
            expect(fromBytes32(await tokenManager.identifierToExposureGroup(toBytes32("sAVAX")))).to.be.equal("");
            expect(fromBytes32(await tokenManager.identifierToExposureGroup(toBytes32("MCKUSD")))).to.be.equal("");
            expect(fromBytes32(await tokenManager.identifierToExposureGroup(toBytes32("USDC")))).to.be.equal("");
            expect(fromBytes32(await tokenManager.identifierToExposureGroup(toBytes32("VF_USDC_MAIN_AUTO")))).to.be.equal("");
            expect(fromBytes32(await tokenManager.identifierToExposureGroup(toBytes32("YY_AAVE_AVAX")))).to.be.equal("");

            await tokenManager.setIdentifiersToExposureGroups(
                [
                    toBytes32("AVAX"),
                    toBytes32("sAVAX"),
                    toBytes32("MCKUSD"),
                    toBytes32("USDC"),
                    toBytes32("VF_USDC_MAIN_AUTO"),
                    toBytes32("YY_AAVE_AVAX"),
                ],
                [
                    toBytes32("AVAX_GROUP"),
                    toBytes32("AVAX_GROUP"),
                    toBytes32("STABLES_GROUP"),
                    toBytes32("STABLES_GROUP"),
                    toBytes32("VECTOR_FINANCE"),
                    toBytes32("YIELD_YAK"),
                ]
            );
            expect(fromBytes32(await tokenManager.identifierToExposureGroup(toBytes32("AVAX")))).to.be.equal("AVAX_GROUP");
            expect(fromBytes32(await tokenManager.identifierToExposureGroup(toBytes32("sAVAX")))).to.be.equal("AVAX_GROUP");
            expect(fromBytes32(await tokenManager.identifierToExposureGroup(toBytes32("MCKUSD")))).to.be.equal("STABLES_GROUP");
            expect(fromBytes32(await tokenManager.identifierToExposureGroup(toBytes32("USDC")))).to.be.equal("STABLES_GROUP");
            expect(fromBytes32(await tokenManager.identifierToExposureGroup(toBytes32("VF_USDC_MAIN_AUTO")))).to.be.equal("VECTOR_FINANCE");
            expect(fromBytes32(await tokenManager.identifierToExposureGroup(toBytes32("YY_AAVE_AVAX")))).to.be.equal("YIELD_YAK");
        });

        it("should set and check exposure group current exposures", async () => {
            expect((await tokenManager.groupToExposure(toBytes32("test1")))[0]).to.be.equal(0);
            expect((await tokenManager.groupToExposure(toBytes32("test2")))[0]).to.be.equal(0);

            await expect(tokenManager.connect(depositor).setCurrentProtocolExposure([toBytes32("test1")], [1])).to.be.revertedWith("Ownable: caller is not the owner");
            await tokenManager.setCurrentProtocolExposure([toBytes32("test1")], [10]);
            await tokenManager.setCurrentProtocolExposure([toBytes32("test2")], [11]);

            expect((await tokenManager.groupToExposure(toBytes32("test1")))[0]).to.be.equal(10);
            expect((await tokenManager.groupToExposure(toBytes32("test2")))[0]).to.be.equal(11);

            await tokenManager.setCurrentProtocolExposure([toBytes32("test1")], [0]);
            await tokenManager.setCurrentProtocolExposure([toBytes32("test2")], [0]);
            expect((await tokenManager.groupToExposure(toBytes32("test1")))[0]).to.be.equal(0);
            expect((await tokenManager.groupToExposure(toBytes32("test2")))[0]).to.be.equal(0);
        });

        it("should set and check exposure group max exposures", async () => {
            expect((await tokenManager.groupToExposure(toBytes32("AVAX_GROUP")))[0]).to.be.equal(0);
            expect((await tokenManager.groupToExposure(toBytes32("AVAX_GROUP")))[1]).to.be.equal(0);
            expect((await tokenManager.groupToExposure(toBytes32("STABLES_GROUP")))[0]).to.be.equal(0);
            expect((await tokenManager.groupToExposure(toBytes32("STABLES_GROUP")))[1]).to.be.equal(0);
            expect((await tokenManager.groupToExposure(toBytes32("VECTOR_FINANCE")))[0]).to.be.equal(0);
            expect((await tokenManager.groupToExposure(toBytes32("VECTOR_FINANCE")))[1]).to.be.equal(0);

            await tokenManager.setMaxProtocolsExposure(
                [
                    toBytes32("AVAX_GROUP"),
                    toBytes32("STABLES_GROUP"),
                    toBytes32("VECTOR_FINANCE"),
                    toBytes32("YIELD_YAK"),
                ],
                [
                    toWei("20"),
                    toWei("500"),
                    toWei("10"),
                    toWei("3"),
                ]
            );
            expect((await tokenManager.groupToExposure(toBytes32("AVAX_GROUP")))[0]).to.be.equal(0);
            expect((await tokenManager.groupToExposure(toBytes32("AVAX_GROUP")))[1]).to.be.equal(toWei("20"));
            expect((await tokenManager.groupToExposure(toBytes32("STABLES_GROUP")))[0]).to.be.equal(0);
            expect((await tokenManager.groupToExposure(toBytes32("STABLES_GROUP")))[1]).to.be.equal(toWei("500"));
            expect((await tokenManager.groupToExposure(toBytes32("VECTOR_FINANCE")))[0]).to.be.equal(0);
            expect((await tokenManager.groupToExposure(toBytes32("VECTOR_FINANCE")))[1]).to.be.equal(toWei("10"));
        });

        it("should fund a loan", async () => {
                expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(0);
                expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
                expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.equal(1.157920892373162e+59);
                expect((await tokenManager.groupToExposure(toBytes32("AVAX_GROUP")))[0]).to.be.equal(0);
                expect((await tokenManager.groupToExposure(toBytes32("AVAX_GROUP")))[1]).to.be.equal(toWei("20"));
                expect((await tokenManager.groupToExposure(toBytes32("STABLES_GROUP")))[0]).to.be.equal(0);
                expect((await tokenManager.groupToExposure(toBytes32("STABLES_GROUP")))[1]).to.be.equal(toWei("500"));

                expect(fromWei(await tokenContracts.get('MCKUSD')!.connect(owner).balanceOf(wrappedLoan.address))).to.be.closeTo(0, 0.1);

                await tokenContracts.get('MCKUSD')!.connect(owner).approve(wrappedLoan.address, parseUnits("1000", await tokenContracts.get('MCKUSD')!.decimals()));
                await expect(wrappedLoan.fund(toBytes32("MCKUSD"), parseUnits("501", await tokenContracts.get('MCKUSD')!.decimals()))).to.be.revertedWith("Max asset exposure breached");
                await wrappedLoan.fund(toBytes32("MCKUSD"), parseUnits("500", await tokenContracts.get('MCKUSD')!.decimals()));
                expect(formatUnits(await tokenContracts.get('MCKUSD')!.connect(owner).balanceOf(wrappedLoan.address), await tokenContracts.get('MCKUSD')!.decimals())).to.be.closeTo(500, 0.1);
                await expect(wrappedLoan.fund(toBytes32("MCKUSD"), 1)).to.be.revertedWith("Max asset exposure breached");

                tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("1000")});
                await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("1000"));

                expect(fromWei(await tokenContracts.get('AVAX')!.connect(owner).balanceOf(wrappedLoan.address))).to.be.closeTo(0, 0.1);

                await expect(wrappedLoan.fund(toBytes32("AVAX"), toWei("21"))).to.be.revertedWith("Max asset exposure breached");
                await wrappedLoan.fund(toBytes32("AVAX"), toWei("20"));
                await expect(wrappedLoan.fund(toBytes32("AVAX"), 1)).to.be.revertedWith("Max asset exposure breached");

                expect(fromWei(await tokenContracts.get('AVAX')!.connect(owner).balanceOf(wrappedLoan.address))).to.be.closeTo(20, 0.1);

                expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(tokensPrices.get('AVAX')! * 20 + 500, 2);
                expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
                expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.equal(1.157920892373162e+59);
            });

        it("should buy an asset from funded", async () => {
            const usdcDecimals = await tokenContracts.get('USDC')!.decimals();
            const expectedUSDCAmount = 90;

            const slippageTolerance = 0.03;
            const requiredAvaxAmount = tokensPrices.get('USDC')! * expectedUSDCAmount * (1 + slippageTolerance) / tokensPrices.get('AVAX')!;

            await expect(wrappedLoan.swapPangolin(
                toBytes32('AVAX'),
                toBytes32('USDC'),
                toWei(requiredAvaxAmount.toString()),
                parseUnits(expectedUSDCAmount.toString(), usdcDecimals)
            )).to.be.revertedWith("Max asset exposure breached");

            await wrappedLoan.withdraw(toBytes32("MCKUSD"), toWei("100"));

            expect((await tokenManager.groupToExposure(toBytes32("AVAX_GROUP")))[0]).to.be.equal(toWei("20"));
            expect((await tokenManager.groupToExposure(toBytes32("AVAX_GROUP")))[1]).to.be.equal(toWei("20"));
            expect(fromWei((await tokenManager.groupToExposure(toBytes32("STABLES_GROUP")))[0])).to.be.closeTo(400, 0.1);
            expect((await tokenManager.groupToExposure(toBytes32("STABLES_GROUP")))[1]).to.be.equal(toWei("500"));

            await wrappedLoan.swapPangolin(
                toBytes32('AVAX'),
                toBytes32('USDC'),
                toWei(requiredAvaxAmount.toString()),
                parseUnits(expectedUSDCAmount.toString(), usdcDecimals)
            )

            expect(fromWei((await tokenManager.groupToExposure(toBytes32("AVAX_GROUP")))[0])).to.be.closeTo(20-requiredAvaxAmount,1e-4);
            expect((await tokenManager.groupToExposure(toBytes32("AVAX_GROUP")))[1]).to.be.equal(toWei("20"));
            expect(fromWei((await tokenManager.groupToExposure(toBytes32("STABLES_GROUP")))[0])).to.be.closeTo(
                400 + formatUnits(
                    await tokenContracts.get('USDC')!.balanceOf(wrappedLoan.address),
                    usdcDecimals
                ),
                1
            );
            expect((await tokenManager.groupToExposure(toBytes32("STABLES_GROUP")))[1]).to.be.equal(toWei("500"));
        });

        it("should buy an LP token", async () => {
            const usdcDecimals = await tokenContracts.get('USDC')!.decimals();
            let AVAX_PRICE = tokensPrices.get('AVAX')!;
            let PNG_AVAX_USDC_LP = new ethers.Contract(TOKEN_ADDRESSES['PNG_AVAX_USDC_LP'], LPAbi, provider);

            let initialAvaxBalance = fromWei(await tokenContracts.get('AVAX')!.balanceOf(wrappedLoan.address));
            let initialUsdcBalance = formatUnits(
                await tokenContracts.get('USDC')!.balanceOf(wrappedLoan.address),
                usdcDecimals
            )

            let initialAvaxExposure = fromWei((await tokenManager.groupToExposure(toBytes32("AVAX_GROUP")))[0]);
            let initialUsdcExposure = fromWei((await tokenManager.groupToExposure(toBytes32("STABLES_GROUP")))[0]);

            await wrappedLoan.addLiquidityPangolin(
                toBytes32('AVAX'),
                toBytes32('USDC'),
                toWei("3"),
                parseUnits((AVAX_PRICE * 3).toFixed(6), BigNumber.from("6")),
                toWei("2"),
                parseUnits((AVAX_PRICE * 2).toFixed(6), BigNumber.from("6"))
            );

            let finalAvaxBalance = fromWei(await tokenContracts.get('AVAX')!.balanceOf(wrappedLoan.address));
            let finalUsdcBalance = formatUnits(
                await tokenContracts.get('USDC')!.balanceOf(wrappedLoan.address),
                usdcDecimals
            )

            expect(fromWei(await PNG_AVAX_USDC_LP.balanceOf(wrappedLoan.address))).to.be.gt(0);
            expect(fromWei((await tokenManager.groupToExposure(toBytes32("AVAX_GROUP")))[0])).to.be.closeTo(initialAvaxExposure - (initialAvaxBalance - finalAvaxBalance), 1e-4);
            expect(fromWei((await tokenManager.groupToExposure(toBytes32("STABLES_GROUP")))[0])).to.be.closeTo(initialUsdcExposure - (initialUsdcBalance - finalUsdcBalance), 1e-4);
        });

        it("should stake & unstake in VF", async () => {
            const usdcDecimals = await tokenContracts.get('USDC')!.decimals();
            let initialUsdcBalance = formatUnits(
                await tokenContracts.get('USDC')!.balanceOf(wrappedLoan.address),
                usdcDecimals
            )
            let initialUsdcExposure = fromWei((await tokenManager.groupToExposure(toBytes32("STABLES_GROUP")))[0]);

            await expect(wrappedLoan.vectorStakeUSDC1Auto(parseUnits("11", usdcDecimals))).to.be.revertedWith("Max asset exposure breached");
            await wrappedLoan.vectorStakeUSDC1Auto(parseUnits("10", usdcDecimals));
            expect(formatUnits(await tokenContracts.get('USDC')!.balanceOf(wrappedLoan.address), usdcDecimals)).to.be.equal(initialUsdcBalance - 10);
            expect(fromWei((await tokenManager.groupToExposure(toBytes32("VECTOR_FINANCE")))[0])).to.be.equal(10);
            expect(fromWei((await tokenManager.groupToExposure(toBytes32("STABLES_GROUP")))[0])).to.be.equal(initialUsdcExposure - 10);

            await wrappedLoan.vectorUnstakeUSDC1Auto(parseUnits("10", usdcDecimals), parseUnits("9", usdcDecimals));

            expect(formatUnits(await tokenContracts.get('USDC')!.balanceOf(wrappedLoan.address), usdcDecimals)).to.be.closeTo(initialUsdcBalance, 0.01);
            expect(fromWei((await tokenManager.groupToExposure(toBytes32("VECTOR_FINANCE")))[0])).to.be.equal(0);
            expect(fromWei((await tokenManager.groupToExposure(toBytes32("STABLES_GROUP")))[0])).to.be.closeTo(initialUsdcExposure, 0.01);
        });

        it("should stake & unstake in YY", async () => {

            let YY_AAVE_AVAX = new ethers.Contract("0xaAc0F2d0630d1D09ab2B5A400412a4840B866d95", erc20ABI, provider);
            let initialAvaxBalance = fromWei(await tokenContracts.get('AVAX')!.balanceOf(wrappedLoan.address))
            let initialAvaxExposure = fromWei((await tokenManager.groupToExposure(toBytes32("AVAX_GROUP")))[0]);

            await expect(wrappedLoan.stakeAVAXYak(toWei("4"))).to.be.revertedWith("Max asset exposure breached");
            await wrappedLoan.stakeAVAXYak(toWei("2"));
            expect(fromWei(await tokenContracts.get('AVAX')!.balanceOf(wrappedLoan.address))).to.be.closeTo(initialAvaxBalance - 2, 1e-8);
            expect(fromWei((await tokenManager.groupToExposure(toBytes32("YIELD_YAK")))[0])).to.be.equal(fromWei(await YY_AAVE_AVAX.balanceOf(wrappedLoan.address)));
            expect(fromWei((await tokenManager.groupToExposure(toBytes32("AVAX_GROUP")))[0])).to.be.closeTo(initialAvaxExposure - 2, 1e-8);

            await wrappedLoan.unstakeAVAXYak(toWei("2"));

            expect(fromWei(await tokenContracts.get('AVAX')!.balanceOf(wrappedLoan.address))).to.be.closeTo(initialAvaxBalance, 0.1);
            expect(fromWei((await tokenManager.groupToExposure(toBytes32("YIELD_YAK")))[0])).to.be.equal(0);
            expect(fromWei((await tokenManager.groupToExposure(toBytes32("AVAX_GROUP")))[0])).to.be.closeTo(initialAvaxExposure, 0.1);
        });


    });
});

