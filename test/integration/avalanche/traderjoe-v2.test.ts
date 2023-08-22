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
    toWei
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
import { IVectorFinanceCompounder__factory } from './../../../typechain/factories/IVectorFinanceCompounder__factory';
import {BigNumber, Contract} from "ethers";
import {deployDiamond, replaceFacet} from '../../../tools/diamond/deploy-diamond';
import TOKEN_ADDRESSES from '../../../common/addresses/avax/token_addresses.json';

chai.use(solidity);

const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';

const LBTokenAbi = [
    'function balanceOf(address account, uint256 id) external view returns (uint256)'
]

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
            MOCK_PRICES: any,
            diamondAddress: any;

        before("deploy factory and pool", async () => {
            [owner, nonOwner, depositor] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'USDC', 'ETH'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]}
            ];

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
            await smartLoansFactory.initialize(diamondAddress);

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor, 2000);

            tokensPrices = await getTokensPricesMap(
                assetsList,
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

            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("10")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("10"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("10"));

            await wrappedLoan.swapPangolin(toBytes32("AVAX"), toBytes32("USDC"), toWei("2.5"), 0);
            await wrappedLoan.swapPangolin(toBytes32("AVAX"), toBytes32("ETH"), toWei("2.5"), 0);

            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("1"));

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(11 * tokensPrices.get('AVAX')!, 3);
        });

        it("should fail to add LB as a non-owner", async () => {
            const addedAvax = toWei('1');
            const addedUSDC = parseUnits('10', BigNumber.from('6'));

            await expect(nonOwnerWrappedLoan.addLiquidityTraderJoeV2(
                [
                    "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
                    "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
                    20,
                    addedAvax,
                    addedUSDC,
                    0, // min AVAX
                    0, // min USDC
                    8376120,
                    16777215, //max uint24 - means that we accept every distance ("slippage") from the active bin
                    [0], //just one bin
                    [addedAvax],
                    [addedUSDC],
                    "0x6C21A841d6f029243AF87EF01f6772F05832144b",
                    "0x6C21A841d6f029243AF87EF01f6772F05832144b",
                    Math.ceil((new Date().getTime() / 1000) + 100)]
                )
            ).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should add liquidity to AVAX/USDC pair", async () => {
            let bins = await wrappedLoan.getOwnedTraderJoeV2Bins();
            expect(bins.length).to.be.equal(0);
            const addedAvax = toWei('1');
            const addedUSDC = parseUnits('10', BigNumber.from('6'));

            const tvBefore = fromWei(await wrappedLoan.getTotalValue());
            const hrBefore = fromWei(await wrappedLoan.getHealthRatio());

            await expect(wrappedLoan.addLiquidityTraderJoeV2(
                [
                    "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
                    "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
                    20,
                    addedAvax,
                    addedUSDC,
                    0, // min AVAX
                    0, // min USDC
                    8376120,
                    16777215, //max uint24 - means that we accept every distance ("slippage") from the active bin
                    [0], //just one bin
                    [addedAvax],
                    [addedUSDC],
                    "0x6C21A841d6f029243AF87EF01f6772F05832144b",
                    "0x6C21A841d6f029243AF87EF01f6772F05832144b",
                    Math.ceil((new Date().getTime() / 1000) + 100)]
            )).not.to.be.reverted;

            bins = await wrappedLoan.getOwnedTraderJoeV2Bins();

            const tvAfter = fromWei(await wrappedLoan.getTotalValue());
            const hrAfter = fromWei(await wrappedLoan.getHealthRatio());

            expect(tvBefore).to.be.closeTo(tvAfter, 0.5);
            expect(hrBefore).to.be.closeTo(hrAfter, 0.5);
            expect(bins.length).to.be.equal(1);
        });

        it("should add liquidity to the same bin", async () => {
            const addedAvax = toWei('1');
            const addedUSDC = parseUnits('10', BigNumber.from('6'));

            const tvBefore = fromWei(await wrappedLoan.getTotalValue());
            const hrBefore = fromWei(await wrappedLoan.getHealthRatio());

            await expect(wrappedLoan.addLiquidityTraderJoeV2(
                [
                    "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
                    "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
                    20,
                    addedAvax,
                    addedUSDC,
                    0, // min AVAX
                    0, // min USDC
                    8376120,
                    16777215, //max uint24 - means that we accept every distance ("slippage") from the active bin
                    [0], //just one bin
                    [addedAvax],
                    [addedUSDC],
                    "0x6C21A841d6f029243AF87EF01f6772F05832144b",
                    "0x6C21A841d6f029243AF87EF01f6772F05832144b",
                    Math.ceil((new Date().getTime() / 1000) + 100)]
            )).not.to.be.reverted;

            const bins = await wrappedLoan.getOwnedTraderJoeV2Bins();

            const tvAfter = fromWei(await wrappedLoan.getTotalValue());
            const hrAfter = fromWei(await wrappedLoan.getHealthRatio());

            expect(tvBefore).to.be.closeTo(tvAfter, 0.5);
            expect(hrBefore).to.be.closeTo(hrAfter, 0.5);
            expect(bins.length).to.be.equal(1);
        });

        it("should add liquidity to AVAX/ETH pair", async () => {
            let bins = await wrappedLoan.getOwnedTraderJoeV2Bins();
            expect(bins.length).to.be.equal(1);
            const addedAvax = toWei('1');
            const addedEth = toWei('0.004');

            const tvBefore = fromWei(await wrappedLoan.getTotalValue());
            const hrBefore = fromWei(await wrappedLoan.getHealthRatio());

            await expect(wrappedLoan.addLiquidityTraderJoeV2(
                [
                    "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB",
                    "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
                    10,
                    addedEth,
                    addedAvax,
                    0, // min ETH
                    0, // min AVAX
                    8376120,
                    16777215, //max uint24 - means that we accept every distance ("slippage") from the active bin
                    [0], //just one bin
                    [addedEth],
                    [addedAvax],
                    "0x6C21A841d6f029243AF87EF01f6772F05832144b",
                    "0x6C21A841d6f029243AF87EF01f6772F05832144b",
                    Math.ceil((new Date().getTime() / 1000) + 100)]
            )).not.to.be.reverted;

            bins = await wrappedLoan.getOwnedTraderJoeV2Bins();

            const tvAfter = fromWei(await wrappedLoan.getTotalValue());
            const hrAfter = fromWei(await wrappedLoan.getHealthRatio());

            expect(tvBefore).to.be.closeTo(tvAfter, 0.5);
            expect(hrBefore).to.be.closeTo(hrAfter, 0.5);
            expect(bins.length).to.be.equal(2);
        });

        it("should remove a part of liquidity from AVAX/USDC pair", async () => {
            const tvBefore = fromWei(await wrappedLoan.getTotalValue());
            const hrBefore = fromWei(await wrappedLoan.getHealthRatio());

            const bins = await wrappedLoan.getOwnedTraderJoeV2Bins();

            const lbToken = await ethers.getContractAt(LBTokenAbi, bins[0].pair, owner);
            const binBalance = await lbToken.balanceOf(wrappedLoan.address, bins[0].id);

            await expect(wrappedLoan.removeLiquidityTraderJoeV2(
                [
                    "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
                    "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
                    20,
                    0, // min AVAX
                    0, // min USDC
                    [bins[0].id], //just one bin
                    [binBalance.div(2)],
                    Math.ceil((new Date().getTime() / 1000) + 100)]
            )).not.to.be.reverted;

            const tvAfter = fromWei(await wrappedLoan.getTotalValue());
            const hrAfter = fromWei(await wrappedLoan.getHealthRatio());

            expect(tvBefore).to.be.closeTo(tvAfter, 0.5);
            expect(hrBefore).to.be.closeTo(hrAfter, 0.5);
        });

        it("should add liquidity to a different bin", async () => {
            const addedAvax = toWei('1');
            const addedUSDC = parseUnits('10', BigNumber.from('6'));

            const tvBefore = fromWei(await wrappedLoan.getTotalValue());
            const hrBefore = fromWei(await wrappedLoan.getHealthRatio());

            await expect(wrappedLoan.addLiquidityTraderJoeV2(
                [
                    "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
                    "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
                    20,
                    addedAvax,
                    addedUSDC,
                    0, // min AVAX
                    0, // min USDC
                    8376121,
                    16777215, //max uint24 - means that we accept every distance ("slippage") from the active bin
                    [1], //just one bin
                    [addedAvax],
                    [addedUSDC],
                    "0x6C21A841d6f029243AF87EF01f6772F05832144b",
                    "0x6C21A841d6f029243AF87EF01f6772F05832144b",
                    Math.ceil((new Date().getTime() / 1000) + 100)]
            )).not.to.be.reverted;

            const bins = await wrappedLoan.getOwnedTraderJoeV2Bins();

            const tvAfter = fromWei(await wrappedLoan.getTotalValue());
            const hrAfter = fromWei(await wrappedLoan.getHealthRatio());

            expect(tvBefore).to.be.closeTo(tvAfter, 0.5);
            expect(hrBefore).to.be.closeTo(hrAfter, 0.5);
            expect(bins.length).to.equal(3);
        });

        it("should remove all liquidity from the first AVAX/USDC bin", async () => {
            const tvBefore = fromWei(await wrappedLoan.getTotalValue());
            const hrBefore = fromWei(await wrappedLoan.getHealthRatio());

            const bins = await wrappedLoan.getOwnedTraderJoeV2Bins();

            const lbToken = await ethers.getContractAt(LBTokenAbi, bins[0].pair, owner);
            const binBalance = await lbToken.balanceOf(wrappedLoan.address, bins[0].id);

            await expect(wrappedLoan.removeLiquidityTraderJoeV2(
                [
                    "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
                    "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
                    20,
                    0, // min AVAX
                    0, // min USDC
                    [bins[0].id], //just one bin
                    [binBalance],
                    Math.ceil((new Date().getTime() / 1000) + 100)]
            )).not.to.be.reverted;

            const tvAfter = fromWei(await wrappedLoan.getTotalValue());
            const hrAfter = fromWei(await wrappedLoan.getHealthRatio());

            const binsAfterUnstake = await wrappedLoan.getOwnedTraderJoeV2Bins();

            expect(tvBefore).to.be.closeTo(tvAfter, 0.5);
            expect(hrBefore).to.be.closeTo(hrAfter, 0.5);
            expect(binsAfterUnstake.length).to.equal(2);
        });

        it("should remove all liquidity from the second AVAX/USDC bin", async () => {
            const tvBefore = fromWei(await wrappedLoan.getTotalValue());
            const hrBefore = fromWei(await wrappedLoan.getHealthRatio());

            const bins = await wrappedLoan.getOwnedTraderJoeV2Bins();

            const lbToken = await ethers.getContractAt(LBTokenAbi, bins[0].pair, owner);
            const binBalance = await lbToken.balanceOf(wrappedLoan.address, bins[0].id);

            await expect(wrappedLoan.removeLiquidityTraderJoeV2(
                [
                    "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
                    "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
                    20,
                    0, // min AVAX
                    0, // min USDC
                    [bins[0].id], //just one bin
                    [binBalance],
                    Math.ceil((new Date().getTime() / 1000) + 100)]
            )).not.to.be.reverted;

            const tvAfter = fromWei(await wrappedLoan.getTotalValue());
            const hrAfter = fromWei(await wrappedLoan.getHealthRatio());

            const binsAfterUnstake = await wrappedLoan.getOwnedTraderJoeV2Bins();

            expect(tvBefore).to.be.closeTo(tvAfter, 0.5);
            expect(hrBefore).to.be.closeTo(hrAfter, 0.5);
            expect(binsAfterUnstake.length).to.equal(1);
        });

        it("should revert for a non-whitelisted pair", async () => {
            const addedAvax = toWei('1');
            const addedSecondToken = toWei('1');

            await expect(wrappedLoan.addLiquidityTraderJoeV2(
                    [
                        "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
                        "0xfd538ca3f58dc309da55b11f007ff53fb4602876",
                        25,
                        addedAvax,
                        addedSecondToken,
                        0, // min AVAX
                        0, // min USDC
                        8376120,
                        16777215, //max uint24 - means that we accept every distance ("slippage") from the active bin
                        [0], //just one bin
                        [addedAvax],
                        [addedSecondToken],
                        "0x6C21A841d6f029243AF87EF01f6772F05832144b",
                        "0x6C21A841d6f029243AF87EF01f6772F05832144b",
                        Math.ceil((new Date().getTime() / 1000) + 100)]
                )
            ).to.be.revertedWith("TraderJoeV2PoolNotWhitelisted()");
        });
    });
});
