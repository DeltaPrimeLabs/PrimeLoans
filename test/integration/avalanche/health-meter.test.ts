import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
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
    toWei,
    wavaxAbi
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import {parseUnits} from "ethers/lib/utils";
import {
    getLog
} from '../../../src/utils/blockchain';
import {
    AddressProvider, ILBRouter, ILBToken,
    MockTokenManager,
    PangolinIntermediary,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
} from "../../../typechain";
import { IVectorFinanceCompounder__factory } from './../../../typechain/factories/IVectorFinanceCompounder__factory';
import {BigNumber, BigNumberish, Contract} from "ethers";
import {deployDiamond, replaceFacet} from '../../../tools/diamond/deploy-diamond';
import TOKEN_ADDRESSES from '../../../common/addresses/avax/token_addresses.json';
import * as traderJoeSdk from "@traderjoe-xyz/sdk-v2";
import {TokenAmount} from "@traderjoe-xyz/sdk-core";
import {JSBI} from "@traderjoe-xyz/sdk";
import { Token } from '@traderjoe-xyz/sdk-core';

chai.use(solidity);

const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';
const tjRouterAddress = '0x60aE616a2155Ee3d9A68541Ba4544862310933d4';

const LBPairABI = [
    'function getReserves() public view returns (uint128, uint128)',
    'function getActiveId() public view returns (uint24)',
    'function balanceOf(address, uint256) public view returns (uint256)',
    'function getBin(uint24) public view returns (uint128, uint128)',
    'function totalSupply(uint256) public view returns (uint256)'
];

const {deployContract, provider} = waffle;
describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('A loan with TraderJoe LB positions', () => {
        let smartLoansFactory: SmartLoansFactory,
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
            fundDepositId: number,
            MOCK_PRICES: any,
            AVAX_PRICE: number,
            diamondAddress: any;

        before("deploy factory and pool", async () => {
            [owner, nonOwner, depositor] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'USDC', 'BTC', 'ETH'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]},
                {name: 'USDC', airdropList: []}
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
            let tjExchange = await deployAndInitExchangeContract(owner, tjRouterAddress, tokenManager.address, supportedAssets, "TraderJoeIntermediary");

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [
                    {
                        facetPath: './contracts/facets/avalanche/PangolinDEXFacet.sol',
                        contractAddress: exchange.address,
                    },
                    {
                        facetPath: './contracts/facets/avalanche/TraderJoeDEXFacet.sol',
                        contractAddress: tjExchange.address,
                    }
                ],
                tokenManager.address,
                addressProvider.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib'
            );

            AVAX_PRICE = tokensPrices.get('AVAX')!;
            const wavaxToken = new ethers.Contract(TOKEN_ADDRESSES['AVAX'], wavaxAbi, provider);

            const usdcDeposited = parseUnits("4000", BigNumber.from("6"));
            const amountSwapped = toWei((4800 / AVAX_PRICE).toString());
            await wavaxToken.connect(depositor).deposit({value: amountSwapped});
            await wavaxToken.connect(depositor).approve(exchange.address, amountSwapped);
            await wavaxToken.connect(depositor).transfer(exchange.address, amountSwapped);

            await exchange.connect(depositor).swap(TOKEN_ADDRESSES['AVAX'], TOKEN_ADDRESSES['USDC'], amountSwapped, usdcDeposited);
            await tokenContracts.get("USDC")!.connect(depositor).approve(poolContracts.get("USDC")!.address, usdcDeposited);
            await poolContracts.get("USDC")!.connect(depositor).deposit(usdcDeposited);

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

            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("20")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("20"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("20"));

            await wrappedLoan.swapTraderJoe(toBytes32("AVAX"), toBytes32("USDC"), toWei("10"), 0);

            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("20"));
            let hm = fromWei(await wrappedLoan.getHealthMeter())
            console.log('hm', hm)
            expect(hm).to.be.closeTo(80, 0.5);
        });

        it("should add liquidity to AVAX/USDC pair", async () => {
            const lbPairContract = new ethers.Contract('0xD446eb1660F766d533BeCeEf890Df7A69d26f7d1', LBPairABI, provider);
            const addedAvax = toWei('5');
            const addedUSDC = parseUnits('200', BigNumber.from('6'));

            const tvBefore = fromWei(await wrappedLoan.getTotalValue());
            const hrBefore = fromWei(await wrappedLoan.getHealthRatio());
            const hmBefore = fromWei(await wrappedLoan.getHealthMeter());

            // avax and usdc balances before:
            const avaxBalanceBefore = await tokenContracts.get('AVAX')!.balanceOf(wrappedLoan.address);
            const usdcBalanceBefore = await tokenContracts.get('USDC')!.balanceOf(wrappedLoan.address);
            console.log('avaxBalanceBefore', formatUnits(avaxBalanceBefore, 18));
            console.log('usdcBalanceBefore', formatUnits(usdcBalanceBefore, 6));

            await expect(wrappedLoan.addLiquidityTraderJoeV2(
                [
                    "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
                    "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
                    20,
                    addedAvax,
                    addedUSDC,
                    0, // min AVAX
                    0, // min USDC
                    await lbPairContract.getActiveId(),
                    // 8376120,
                    16777215, //max uint24 - means that we accept every distance ("slippage") from the active bin
                    [0], //just one bin
                    [toWei("1.0")],
                    [toWei("1.0")],
                    "0x6C21A841d6f029243AF87EF01f6772F05832144b",
                    "0x6C21A841d6f029243AF87EF01f6772F05832144b",
                    Math.ceil((new Date().getTime() / 1000) + 100)]
            )).not.to.be.reverted;

            // avax and usdc balances after:
            const avaxBalanceAfter = await tokenContracts.get('AVAX')!.balanceOf(wrappedLoan.address);
            const usdcBalanceAfter = await tokenContracts.get('USDC')!.balanceOf(wrappedLoan.address);
            console.log('avaxBalanceAfter', formatUnits(avaxBalanceAfter, 18));
            console.log('usdcBalanceAfter', formatUnits(usdcBalanceAfter, 6));

            let hm = fromWei(await wrappedLoan.getHealthMeter())
            console.log('HM after', hm)
            expect(hm).to.be.closeTo(hmBefore, 0.3)

            const bins = await wrappedLoan.getOwnedTraderJoeV2Bins();

            const tvAfter = fromWei(await wrappedLoan.getTotalValue());
            const hrAfter = fromWei(await wrappedLoan.getHealthRatio());

            expect(tvBefore).to.be.closeTo(tvAfter, 10);
            expect(hrBefore).to.be.closeTo(hrAfter, 0.01);
            expect(bins.length).to.be.equal(1);
        });

        it("should borrow USDC and swap all USDC to AVAX", async () => {
            await wrappedLoan.borrow(toBytes32("USDC"), parseUnits("200", 6));

            const hmBefore = fromWei(await wrappedLoan.getHealthMeter());

            const usdcBalance = await tokenContracts.get("USDC")!.balanceOf(wrappedLoan.address);
            await wrappedLoan.swapTraderJoe(toBytes32("USDC"), toBytes32("AVAX"), usdcBalance, 0);

            let hm = fromWei(await wrappedLoan.getHealthMeter())
            console.log('HM after', hm)
            expect(hm).to.be.closeTo(hmBefore, 0.3)
        });
    });
});
