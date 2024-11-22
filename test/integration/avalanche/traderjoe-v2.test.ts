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
import { parseEther } from 'viem';

chai.use(solidity);

const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';
const tjRouterAddress = '0x60aE616a2155Ee3d9A68541Ba4544862310933d4';

const tjv21RouterAddress = "0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30";
const tjv22RouterAddress = "0x18556DA13313f3532c54711497A8FedAC273220E";

const LBTokenAbi = [
    'function balanceOf(address account, uint256 id) external view returns (uint256)',
    'function getActiveId() external view returns (uint24)',
    'function name() external view returns (string memory)',
    'function totalSupply(uint256 id) external view returns (uint256)',
    'function approveForAll(address spender, bool approved) external'
]

const LBRouterAbi = [
    'function addLiquidity((address tokenX, address tokenY, uint256 binStep, uint256 amountX, uint256 amountY, uint256 amountXMin, uint256 amountYMin, uint256 activeIdDesired, uint256 idSlippage, int256[] deltaIds, uint256[] distributionX, uint256[] distributionY, address to, address refundTo, uint256 deadline))',
    'event DepositedToBins(address indexed sender,address indexed to,uint256[] ids,bytes32[] amounts)'
]

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
            diamondAddress: any;

        before("deploy factory and pool", async () => {
            [owner, nonOwner, depositor] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'USDC', 'BTC', 'ETH', 'JOE'];
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

            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("30")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("30"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("30"));

            await wrappedLoan.swapTraderJoe(toBytes32("AVAX"), toBytes32("USDC"), toWei("2.5"), 0);
            await wrappedLoan.swapTraderJoe(toBytes32("AVAX"), toBytes32("BTC"), toWei("7.5"), 0);
            await wrappedLoan.swapTraderJoe(toBytes32("AVAX"), toBytes32("JOE"), toWei("7.5"), 0);
            await wrappedLoan.swapTraderJoe(toBytes32("AVAX"), toBytes32("ETH"), toWei("2.5"), 0);

            //for owner direct liquidity providing
            await wrappedLoan.withdraw(toBytes32("USDC"), parseUnits("10", BigNumber.from(6)));
            await wrappedLoan.withdraw(toBytes32("JOE"), parseUnits("10", BigNumber.from(18)));
            await wrappedLoan.withdraw(toBytes32("AVAX"), parseUnits("0.1", BigNumber.from(18)));
            await wrappedLoan.withdraw(toBytes32("ETH"), parseUnits("0.001", BigNumber.from(18)));
            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("1"));
        });

        it("should fail to add LB as a non-owner", async () => {
            const addedAvax = toWei('1');
            const addedUSDC = parseUnits('10', BigNumber.from('6'));

            await expect(nonOwnerWrappedLoan.addLiquidityTraderJoeV2(
                tjv21RouterAddress,
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

        it("should add LB tokens of AVAX/USDC pair", async () => {
            let LBRouter = new ethers.Contract(tjv21RouterAddress, LBRouterAbi, provider.getSigner()) as ILBRouter;

            let lbToken = new ethers.Contract('0xD446eb1660F766d533BeCeEf890Df7A69d26f7d1', LBTokenAbi, provider.getSigner()) as ILBToken;

            let bins = await wrappedLoan.getOwnedTraderJoeV2Bins();

            expect(bins.length).to.be.equal(0);

            const addedAvax = toWei('1');
            const addedUsdc = parseUnits("10", BigNumber.from(6));

            const tvBefore = fromWei(await wrappedLoan.getTotalValue());
            const hrBefore = fromWei(await wrappedLoan.getHealthRatio());

            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: addedAvax});
            await tokenContracts.get('AVAX')!.connect(owner).approve(LBRouter.address, addedAvax);

            await tokenContracts.get('USDC')!.connect(owner).approve(LBRouter.address, addedUsdc);

           let tx = await LBRouter.connect(owner).addLiquidity(
                {
                    tokenX: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
                    tokenY: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
                    binStep: 20,
                    amountX: addedAvax,
                    amountY: addedUsdc,
                    amountXMin: 0, // min AVAX
                    amountYMin: 0, // min USDC
                    activeIdDesired: 8376120,
                    idSlippage: 16777215, //max uint24 - means that we accept every distance ("slippage") from the active bin
                    deltaIds: [0], //just one bin
                    distributionX: [parseEther("1")],
                    distributionY: [parseEther("1")],
                    to: owner.address,
                    refundTo: owner.address,
                    deadline: Math.ceil((new Date().getTime() / 1000) + 10000)
                }
            );

            let result = await tx.wait();

            // @ts-ignore
            fundDepositId = getLog(result, LBRouterAbi, 'DepositedToBins').args.ids[0];

            let ownerBalance = await lbToken.balanceOf(owner.address, fundDepositId);

            expect(ownerBalance).to.be.gt(0);

            await lbToken.connect(owner).approveForAll(wrappedLoan.address, true);

           await wrappedLoan.fundLiquidityTraderJoeV2(
              "0xD446eb1660F766d533BeCeEf890Df7A69d26f7d1",
                [fundDepositId],
                [ownerBalance]
            );

            let newOwnerBalance = await lbToken.balanceOf(owner.address, fundDepositId);
            expect(newOwnerBalance).to.be.equal(0);

            let loanBalance = await lbToken.balanceOf(wrappedLoan.address, fundDepositId);

            expect(loanBalance).to.be.equal(ownerBalance);

            bins = await wrappedLoan.getOwnedTraderJoeV2Bins();

            const tvAfter = fromWei(await wrappedLoan.getTotalValue());
            const hrAfter = fromWei(await wrappedLoan.getHealthRatio());

            expect(tvAfter).to.be.gt(tvBefore);
            expect(hrAfter).to.be.gt(hrBefore);
            expect(bins.length).to.be.equal(1);
        });

        it("should withdraw LB tokens of AVAX/USDC pair", async () => {
            let lbToken = new ethers.Contract('0xD446eb1660F766d533BeCeEf890Df7A69d26f7d1', LBTokenAbi, provider.getSigner()) as ILBToken;

            const tvBefore = fromWei(await wrappedLoan.getTotalValue());
            const hrBefore = fromWei(await wrappedLoan.getHealthRatio());

            let loanBalance = await lbToken.balanceOf(wrappedLoan.address, fundDepositId);

            await wrappedLoan.withdrawLiquidityTraderJoeV2(
                "0xD446eb1660F766d533BeCeEf890Df7A69d26f7d1",
                [fundDepositId],
                [loanBalance.div(2)]
            );

            let ownerBalance = await lbToken.balanceOf(owner.address, fundDepositId);
            expect(ownerBalance).to.be.equal(loanBalance.div(2));

            let bins = await wrappedLoan.getOwnedTraderJoeV2Bins();

            const tvAfter = fromWei(await wrappedLoan.getTotalValue());
            const hrAfter = fromWei(await wrappedLoan.getHealthRatio());

            expect(tvAfter).to.be.lt(tvBefore);
            expect(hrAfter).to.be.lt(hrBefore);
            expect(bins.length).to.be.equal(1);
        });

        it("should add liquidity to the same bin", async () => {
            const addedAvax = toWei('1');
            const addedUSDC = parseUnits('10', BigNumber.from('6'));

            const tvBefore = fromWei(await wrappedLoan.getTotalValue());
            const hrBefore = fromWei(await wrappedLoan.getHealthRatio());

            await expect(wrappedLoan.addLiquidityTraderJoeV2(
                tjv21RouterAddress,
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

        it("should add liquidity to AVAX/BTC pair", async () => {
            let bins = await wrappedLoan.getOwnedTraderJoeV2Bins();
            expect(bins.length).to.be.equal(1);
            const addedAvax = toWei('1');
            const addedBtc = parseUnits('0.00025', 8);

            const tvBefore = fromWei(await wrappedLoan.getTotalValue());
            const hrBefore = fromWei(await wrappedLoan.getHealthRatio());

            await expect(wrappedLoan.addLiquidityTraderJoeV2(
                tjv21RouterAddress,
                [
                    "0x152b9d0fdc40c096757f570a51e494bd4b943e50",
                    "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
                    10,
                    addedBtc,
                    addedAvax,
                    0, // min ETH
                    0, // min AVAX
                    8376120,
                    16777215, //max uint24 - means that we accept every distance ("slippage") from the active bin
                    [0], //just one bin
                    [addedBtc],
                    [addedAvax],
                    "0x6C21A841d6f029243AF87EF01f6772F05832144b",
                    "0x6C21A841d6f029243AF87EF01f6772F05832144b",
                    Math.ceil((new Date().getTime() / 1000) + 100)]
            )).not.to.be.reverted;

            bins = await wrappedLoan.getOwnedTraderJoeV2Bins();

            const tvAfter = fromWei(await wrappedLoan.getTotalValue());
            const hrAfter = fromWei(await wrappedLoan.getHealthRatio());

            expect(tvBefore).to.be.closeTo(tvAfter, 2);
            expect(hrBefore).to.be.closeTo(hrAfter, 2);
            expect(bins.length).to.be.equal(2);
        });

        it("should remove a part of liquidity from AVAX/USDC pair", async () => {
            const tvBefore = fromWei(await wrappedLoan.getTotalValue());
            const hrBefore = fromWei(await wrappedLoan.getHealthRatio());

            const bins = await wrappedLoan.getOwnedTraderJoeV2Bins();

            const lbToken = await ethers.getContractAt(LBTokenAbi, bins[0].pair, owner);
            const binBalance = await lbToken.balanceOf(wrappedLoan.address, bins[0].id);

            await expect(wrappedLoan.removeLiquidityTraderJoeV2(
                tjv21RouterAddress,
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
                tjv21RouterAddress,
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

        it("should remove all liquidity from AVAX/USDC bin", async () => {
            const tvBefore = fromWei(await wrappedLoan.getTotalValue());
            const hrBefore = fromWei(await wrappedLoan.getHealthRatio());

            const bins = await wrappedLoan.getOwnedTraderJoeV2Bins();

            const lbToken = await ethers.getContractAt(LBTokenAbi, bins[0].pair, owner);
            const binBalance = await lbToken.balanceOf(wrappedLoan.address, bins[0].id);

            await expect(wrappedLoan.removeLiquidityTraderJoeV2(
                tjv21RouterAddress,
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
                tjv21RouterAddress,
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

        it("should add liquidity to AVAX/ETH pair", async () => {
            let bins = await wrappedLoan.getOwnedTraderJoeV2Bins();
            expect(bins.length).to.be.equal(1);
            const addedAvax = toWei('1');
            const addedEth = toWei('0.004');

            const tvBefore = fromWei(await wrappedLoan.getTotalValue());
            const hrBefore = fromWei(await wrappedLoan.getHealthRatio());

            await expect(wrappedLoan.addLiquidityTraderJoeV2(
                tjv21RouterAddress,
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

        it("should withdraw all LB tokens of AVAX/ETH pair", async () => {
            let lbToken = new ethers.Contract('0x1901011a39B11271578a1283D620373aBeD66faA', LBTokenAbi, provider.getSigner()) as ILBToken;

            let bins = await wrappedLoan.getOwnedTraderJoeV2Bins();
            let bin = bins[1];

            const tvBefore = fromWei(await wrappedLoan.getTotalValue());
            const hrBefore = fromWei(await wrappedLoan.getHealthRatio());

            let loanBalance = await lbToken.balanceOf(wrappedLoan.address, bin.id);

            await wrappedLoan.withdrawLiquidityTraderJoeV2(
                "0x1901011a39B11271578a1283D620373aBeD66faA",
                [bin.id],
                [loanBalance]
            );

            let ownerBalance = await lbToken.balanceOf(owner.address, bin.id);
            expect(ownerBalance).to.be.equal(loanBalance);

            bins = await wrappedLoan.getOwnedTraderJoeV2Bins();

            const tvAfter = fromWei(await wrappedLoan.getTotalValue());
            const hrAfter = fromWei(await wrappedLoan.getHealthRatio());

            expect(tvAfter).to.be.lt(tvBefore);
            expect(hrAfter).to.be.lt(hrBefore);
            expect(bins.length).to.be.equal(1);
        });

        it("should revert for a non-whitelisted pair", async () => {
            const addedAvax = toWei('1');
            const addedSecondToken = toWei('1');

            await expect(wrappedLoan.addLiquidityTraderJoeV2(
                tjv21RouterAddress,
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
            ).to.be.revertedWith("TraderJoeV2PoolNotWhitelisted");
        });

        it("should revert for too many bins", async () => {
            let addedAvax = toWei('1');
            let addedEth = toWei('0.004');

            await expect(wrappedLoan.addLiquidityTraderJoeV2(
                tjv21RouterAddress,
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
                    [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20], //just one bin
                    [addedEth],
                    [addedAvax],
                    "0x6C21A841d6f029243AF87EF01f6772F05832144b",
                    "0x6C21A841d6f029243AF87EF01f6772F05832144b",
                    Math.ceil((new Date().getTime() / 1000) + 100)]
            )).to.be.reverted;
        });
        it("should check total value for AVAX-USDC pair", async () => {
            const addedAvax = '1000000000000000000';
            const addedUSDC = '10000000';

            let tjvBefore = fromWei(await wrappedLoan.getTotalTraderJoeV2());

            const tokenX = initializeToken({
                address: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
                decimals: 18,
                symbol: 'WAVAX',
                name: 'WAVAX'
            });


            const tokenY = initializeToken({
                address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
                decimals: 6,
                symbol: 'USDC',
                name: 'USDC'
            });

            const lbPairContract = new ethers.Contract('0xD446eb1660F766d533BeCeEf890Df7A69d26f7d1', LBPairABI, provider);

            const activeId = await lbPairContract.getActiveId()

            let input = getAddLiquidityParameters(
                owner.address,
                tokenX,
                tokenY,
                addedAvax,
                addedUSDC,
                "getUniformDistributionFromBinRange",
                20,
                activeId,
                [activeId - 10, activeId + 10],
                2,
                2

            );

            await expect(wrappedLoan.addLiquidityTraderJoeV2(tjv21RouterAddress, input)).not.to.be.reverted;


            let tjvAfter = fromWei(await wrappedLoan.getTotalTraderJoeV2());
            await expect(tjvAfter - tjvBefore).to.be.closeTo(tokensPrices.get('AVAX') * 1 + tokensPrices.get('USDC') * 10, 0.1);
        });

        it("should check total value for BTC.b-AVAX pair", async () => {
            const addedBtc = '100000';
            const addedAvax = '1000000000000000000';

            let tjvBefore = fromWei(await wrappedLoan.getTotalTraderJoeV2());

            const tokenX = initializeToken({
                address: '0x152b9d0fdc40c096757f570a51e494bd4b943e50',
                decimals: 8,
                symbol: 'BTC',
                name: 'BTC'
            });


            const tokenY = initializeToken({
                address: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
                decimals: 18,
                symbol: 'WAVAX',
                name: 'WAVAX'
            });

            const lbPairContract = new ethers.Contract('0xd9fa522f5bc6cfa40211944f2c8da785773ad99d', LBPairABI, provider);

            const activeId = await lbPairContract.getActiveId()

            let input = getAddLiquidityParameters(
                owner.address,
                tokenX,
                tokenY,
                addedBtc,
                addedAvax,
                "getUniformDistributionFromBinRange",
                10,
                activeId,
                [activeId - 10, activeId + 10],
                2,
                2

            );

            await expect(wrappedLoan.addLiquidityTraderJoeV2(tjv21RouterAddress, input)).not.to.be.reverted;


            let tjvAfter = fromWei(await wrappedLoan.getTotalTraderJoeV2());
            await expect(tjvAfter - tjvBefore).to.be.closeTo(tokensPrices.get('AVAX') * 1 + tokensPrices.get('BTC') * 0.001, 0.1);
        });

        it("should check total value for AVAX-ETH pair", async () => {
            const addedEth = '10000000000000000';
            const addedAvax = '1000000000000000000';

            let tjvBefore = fromWei(await wrappedLoan.getTotalTraderJoeV2());

            const tokenX = initializeToken({
                address: '0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab',
                decimals: 18,
                symbol: 'WETH',
                name: 'WETH'
            });

            const tokenY = initializeToken({
                address: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
                decimals: 18,
                symbol: 'WAVAX',
                name: 'WAVAX'
            });


            const lbPairContract = new ethers.Contract('0x1901011a39b11271578a1283d620373abed66faa', LBPairABI, provider);

            const activeId = await lbPairContract.getActiveId()

            let input = getAddLiquidityParameters(
                owner.address,
                tokenX,
                tokenY,
                addedEth,
                addedAvax,
                "getUniformDistributionFromBinRange",
                10,
                activeId,
                [activeId - 10, activeId + 10],
                2,
                2
            );

            await expect(wrappedLoan.addLiquidityTraderJoeV2(tjv21RouterAddress, input)).not.to.be.reverted;


            let tjvAfter = fromWei(await wrappedLoan.getTotalTraderJoeV2());
            await expect(tjvAfter - tjvBefore).to.be.closeTo(tokensPrices.get('ETH') * 0.01 + tokensPrices.get('AVAX') * 1, 0.1);
        });

        it("should add LB tokens of JOE/AVAX pair", async () => {
            let LBRouter = new ethers.Contract(tjv22RouterAddress, LBRouterAbi, provider.getSigner()) as ILBRouter;

            let lbToken = new ethers.Contract('0xEA7309636E7025Fda0Ee2282733Ea248c3898495', LBTokenAbi, provider.getSigner()) as ILBToken;

            let bins = await wrappedLoan.getOwnedTraderJoeV2Bins();

            expect(bins.length).to.be.equal(63);

            const addedAvax = toWei('1');
            const addedJoe = parseUnits("10", BigNumber.from(18));

            const tvBefore = fromWei(await wrappedLoan.getTotalValue());
            const hrBefore = fromWei(await wrappedLoan.getHealthRatio());

            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: addedAvax});
            await tokenContracts.get('AVAX')!.connect(owner).approve(LBRouter.address, addedAvax);
            await tokenContracts.get('JOE')!.connect(owner).approve(LBRouter.address, addedJoe);
            let tx = await LBRouter.connect(owner).addLiquidity(
                {
                    tokenX: "0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd",
                    tokenY: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
                    binStep: 25,
                    amountX: addedJoe,
                    amountY: addedAvax,
                    amountXMin: 0, // min AVAX
                    amountYMin: 0, // min USDC
                    activeIdDesired: 8386837,
                    idSlippage: 16777215, //max uint24 - means that we accept every distance ("slippage") from the active bin
                    deltaIds: [0], //just one bin
                    distributionX: [parseEther("1")],
                    distributionY: [parseEther("1")],
                    to: owner.address,
                    refundTo: owner.address,
                    deadline: Math.ceil((new Date().getTime() / 1000) + 10000)
                }
            );

            let result = await tx.wait();

            // @ts-ignore
            fundDepositId = getLog(result, LBRouterAbi, 'DepositedToBins').args.ids[0];

            let ownerBalance = await lbToken.balanceOf(owner.address, fundDepositId);
            expect(ownerBalance).to.be.gt(0);
            await lbToken.connect(owner).approveForAll(wrappedLoan.address, true);
           await wrappedLoan.fundLiquidityTraderJoeV2(
              "0xEA7309636E7025Fda0Ee2282733Ea248c3898495",
                [fundDepositId],
                [ownerBalance]
            );

            let newOwnerBalance = await lbToken.balanceOf(owner.address, fundDepositId);
            expect(newOwnerBalance).to.be.equal(0);

            let loanBalance = await lbToken.balanceOf(wrappedLoan.address, fundDepositId);
            expect(loanBalance).to.be.equal(ownerBalance);

            bins = await wrappedLoan.getOwnedTraderJoeV2Bins();

            const tvAfter = fromWei(await wrappedLoan.getTotalValue());
            const hrAfter = fromWei(await wrappedLoan.getHealthRatio());

            expect(tvAfter).to.be.gt(tvBefore);
            expect(hrAfter).to.be.gt(hrBefore);
            expect(bins.length).to.be.equal(64);
        });

        it("should withdraw LB tokens of JOE/AVAX pair", async () => {
            let lbToken = new ethers.Contract('0xEA7309636E7025Fda0Ee2282733Ea248c3898495', LBTokenAbi, provider.getSigner()) as ILBToken;

            const tvBefore = fromWei(await wrappedLoan.getTotalValue());
            const hrBefore = fromWei(await wrappedLoan.getHealthRatio());

            let loanBalance = await lbToken.balanceOf(wrappedLoan.address, fundDepositId);

            await wrappedLoan.withdrawLiquidityTraderJoeV2(
                "0xEA7309636E7025Fda0Ee2282733Ea248c3898495",
                [fundDepositId],
                [loanBalance.div(2)]
            );

            let ownerBalance = await lbToken.balanceOf(owner.address, fundDepositId);
            expect(ownerBalance).to.be.equal(loanBalance.div(2));

            let bins = await wrappedLoan.getOwnedTraderJoeV2Bins();

            const tvAfter = fromWei(await wrappedLoan.getTotalValue());
            const hrAfter = fromWei(await wrappedLoan.getHealthRatio());

            expect(tvAfter).to.be.lt(tvBefore);
            expect(hrAfter).to.be.lt(hrBefore);
            expect(bins.length).to.be.equal(64);
        });

        it("should remove a part of liquidity from JOE/AVAX pair", async () => {
            const tvBefore = fromWei(await wrappedLoan.getTotalValue());
            const hrBefore = fromWei(await wrappedLoan.getHealthRatio());

            const bins = await wrappedLoan.getOwnedTraderJoeV2Bins();

            const lbToken = await ethers.getContractAt(LBTokenAbi, bins[63].pair, owner);
            const binBalance = await lbToken.balanceOf(wrappedLoan.address, bins[63].id);

            await expect(wrappedLoan.removeLiquidityTraderJoeV2(
                tjv22RouterAddress,
                [
                    "0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd",
                    "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
                    25,
                    0, // min JOE
                    0, // min AVAX
                    [bins[63].id], //just one bin
                    [binBalance.div(2)],
                    Math.ceil((new Date().getTime() / 1000) + 100)]
            )).not.to.be.reverted;

            const tvAfter = fromWei(await wrappedLoan.getTotalValue());
            const hrAfter = fromWei(await wrappedLoan.getHealthRatio());

            expect(tvBefore).to.be.closeTo(tvAfter, 0.5);
            expect(hrBefore).to.be.closeTo(hrAfter, 0.5);
        });


        function getAddLiquidityParameters(
            address,
            tokenX,
            tokenY,
            tokenXValue,
            tokenYValue,
            distributionMethod,
            binStep,
            activeBinId,
            binRange,
            userPriceSlippage,
            userAmountsSlippage
        ) {
            // wrap into TokenAmount
            const tokenXAmount = new TokenAmount(tokenX, JSBI.BigInt(tokenXValue));
            const tokenYAmount = new TokenAmount(tokenY, JSBI.BigInt(tokenYValue));

            const allowedAmountsSlippage = userAmountsSlippage * 100;
            const minTokenXAmount =  JSBI.divide(
                JSBI.multiply(tokenXAmount.raw, JSBI.BigInt(10000 - allowedAmountsSlippage)),
                JSBI.BigInt(10000)
            );
            const minTokenYAmount =  JSBI.divide(
                JSBI.multiply(tokenYAmount.raw, JSBI.BigInt(10000 - allowedAmountsSlippage)),
                JSBI.BigInt(10000)
            );

            const allowedPriceSlippage = userPriceSlippage * 100;
            const priceSlippage = allowedPriceSlippage / 10000; // 0.005

            // set deadline for the transaction
            const currenTimeInSec = Math.floor((new Date().getTime()) / 1000);
            const deadline = currenTimeInSec + 3600;

            const idSlippage = getIdSlippageFromPriceSlippage(
                priceSlippage,
                Number(binStep)
            );

            // getting distribution parameters for selected shape given a price range
            let { deltaIds, distributionX, distributionY } = traderJoeSdk[distributionMethod](
                activeBinId,
                binRange,
                [tokenXAmount, tokenYAmount]
            );

            let number =  ((BigInt(distributionX[0])) > 0) ? BigInt(distributionX[0]) - BigInt(10) : BigInt(0);

            distributionX = distributionX.map(el => ((BigInt(el)) > BigInt(10)) ? BigInt(el) - BigInt(10) : BigInt(el))
            distributionY = distributionY.map(el => ((BigInt(el)) > BigInt(10)) ? BigInt(el) - BigInt(10) : BigInt(el))


            // declare liquidity parameters
            const addLiquidityInput = {
                tokenX: tokenX.address,
                tokenY: tokenY.address,
                binStep: Number(binStep),
                amountX: tokenXAmount.raw.toString(),
                amountY: tokenYAmount.raw.toString(),
                amountXMin: minTokenXAmount.toString(),
                amountYMin: minTokenYAmount.toString(),
                activeIdDesired: activeBinId,
                idSlippage,
                deltaIds,
                distributionX,
                distributionY,
                to: address,
                refundTo: address,
                deadline
            };

            return addLiquidityInput;
        }

        function getIdSlippageFromPriceSlippage(priceSlippage, binStep) {
            return Math.floor(
                Math.log(1 + priceSlippage) / Math.log(1 + binStep / 1e4)
            );
        }

        function initializeToken(tokenData) {
            // initialize Token
            const token = new Token(
                43114,
                tokenData.address,
                tokenData.decimals,
                tokenData.symbol,
                tokenData.name
            );

            return token;
        }
    });
});
