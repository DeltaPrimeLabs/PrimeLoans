import { ethers, waffle } from 'hardhat'
import chai, { expect } from 'chai'
import { solidity } from "ethereum-waffle";
import axios from 'axios';
import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import AddressProviderArtifact from '../../../artifacts/contracts/AddressProvider.sol/AddressProvider.json';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
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
    parseParaSwapRouteData,
    PoolAsset,
    PoolInitializationObject,
    recompileConstantsFile,
    toBytes32,
    toWei, yakRouterAbi
} from "../../_helpers";
import { syncTime } from "../../_syncTime"
import { WrapperBuilder } from "@redstone-finance/evm-connector";
import { parseUnits } from "ethers/lib/utils";
import {
    AddressProvider,
    MockTokenManager,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
} from "../../../typechain";
import { BigNumber, Contract } from "ethers";
import { deployDiamond } from '../../../tools/diamond/deploy-diamond';
import TOKEN_ADDRESSES from '../../../common/addresses/arbitrum/token_addresses.json';
import { constructSimpleSDK, ContractMethod, SimpleFetchSDK, SwapSide } from '@paraswap/sdk';

chai.use(solidity);

const NONFUNGIBLE_POSITION_MANAGER_ADDRESS = '0x91ae842A5Ffd8d12023116943e72A606179294f3';

const { deployContract, provider } = waffle;
const yakRouterAddress = '0xb32C79a25291265eF240Eb32E9faBbc6DcEE3cE3';

const yakRouter = new ethers.Contract(
    yakRouterAddress,
    yakRouterAbi,
    provider
)
//TODO: put in one file
async function query(tknFrom: string, tknTo: string, amountIn: BigNumber) {
    const maxHops = 3
    const gasPrice = ethers.utils.parseUnits('225', 'gwei')
    return yakRouter.findBestPathWithGas(
        amountIn,
        tknFrom,
        tknTo,
        maxHops,
        gasPrice,
        { gasLimit: 1e9 }
    )
}
describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('A loan with Uniswap V3 operations', () => {
        let smartLoansFactory: SmartLoansFactory,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            nonOwnerWrappedLoan: any,
            tokenManager: MockTokenManager,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            tokensPrices: Map<string, number>,
            owner: SignerWithAddress,
            nonOwner: SignerWithAddress,
            paraSwapMin: SimpleFetchSDK,
            depositor: SignerWithAddress,
            MOCK_PRICES: any,
            diamondAddress: any;

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
            paraSwapMin = constructSimpleSDK({ chainId: 42161, axios });

            [owner, depositor] = await getFixedGasSigners(10000000);
            let assetsList = ['ETH', 'USDC'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                { name: 'ETH', airdropList: [depositor] },
            ];

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor, 1000, 'ARBITRUM');
            tokensPrices = await getTokensPricesMap(assetsList, "arbitrum", getRedstonePrices, []);

            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            addMissingTokenContracts(tokenContracts, assetsList, 'ARBITRUM');
            supportedAssets = convertAssetsListToSupportedAssets(assetsList, [], 'ARBITRUM');

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
                'lib',
                5000,
                "1.042e18",
                100,
                "ETH",
                "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"
            );

            await deployAllFacets(diamondAddress, true, 'ARBITRUM');
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

        it("should fund a loan and swap to USDC", async () => {
            await tokenContracts.get('ETH')!.connect(owner).deposit({ value: toWei("10") });
            await tokenContracts.get('ETH')!.connect(owner).approve(wrappedLoan.address, toWei("10"));
            await wrappedLoan.fund(toBytes32("ETH"), toWei("100"));

            let swapData = await getSwapData('ETH', 18, 'USDC', 6, toWei('10'));
            await wrappedLoan.paraSwapV2(swapData.selector, swapData.data, TOKEN_ADDRESSES['ETH'], toWei('10'), TOKEN_ADDRESSES['USDC'], 1);
        });

        it("should mint ETH/USDC UniswapV3 liquidity", async () => {
            const addedEth = toWei('1');
            const addedUSDC = parseUnits('10', BigNumber.from('6'));

            const tvBefore = fromWei(await wrappedLoan.getTotalValue());
            const hrBefore = fromWei(await wrappedLoan.getHealthRatio());

            await tokenContracts.get('ETH')!.approve(wrappedLoan.address, toWei("10"));
            await tokenContracts.get('USDC')!.approve(wrappedLoan.address, toWei("10"));

            await wrappedLoan.mintLiquidityUniswapV3(
                [
                    TOKEN_ADDRESSES['ETH'],
                    TOKEN_ADDRESSES['USDC'],
                    500,
                    // 10000,
                    // 10100,
                    -1000,
                    1000,
                    addedEth,
                    addedUSDC,
                    0,
                    0,
                    "0xc79890C726fF34e43E16afA736847900e4fc9c37", //can be anything, it's overwritten on the contract level
                    Math.ceil((new Date().getTime() / 1000) + 1000)
                ]
            );

            const tvAfter = fromWei(await wrappedLoan.getTotalValue());
            const hrAfter = fromWei(await wrappedLoan.getHealthRatio());

            expect(tvBefore).to.be.closeTo(tvAfter, 0.001);
            expect(hrBefore).to.be.closeTo(hrAfter, 0.001);
        });



        it("should increase ETH/USDC UniswapV3 liquidity", async () => {
            let id = (await wrappedLoan.getOwnedUniswapV3TokenIds())[0];
            const addedEth = toWei('0.5');
            const addedUSDC = parseUnits('5', BigNumber.from('6'));

            const tvBefore = fromWei(await wrappedLoan.getTotalValue());
            const hrBefore = fromWei(await wrappedLoan.getHealthRatio());

            await expect(wrappedLoan.increaseLiquidityUniswapV3(
                [
                    id,
                    addedEth,
                    addedUSDC,
                    0,
                    0,
                    Math.ceil((new Date().getTime() / 1000) + 100)
                ]
            )).not.to.be.reverted;

            const tvAfter = fromWei(await wrappedLoan.getTotalValue());
            const hrAfter = fromWei(await wrappedLoan.getHealthRatio());

            await expect((await wrappedLoan.getOwnedUniswapV3TokenIds()).length).to.be.equal(1);
            expect(tvBefore).to.be.closeTo(tvAfter, 0.001);
            expect(hrBefore).to.be.closeTo(hrAfter, 0.001);
        });

        it("should decrease ETH/USDC UniswapV3 liquidity", async () => {
            let id = (await wrappedLoan.getOwnedUniswapV3TokenIds())[0];

            const manager = await ethers.getContractAt("INonfungiblePositionManager", NONFUNGIBLE_POSITION_MANAGER_ADDRESS, owner);

            const liquidityBefore = (await manager.positions(id)).liquidity;
            const decreasedLiquidity = liquidityBefore.div(3);

            const tvBefore = fromWei(await wrappedLoan.getTotalValue());
            const hrBefore = fromWei(await wrappedLoan.getHealthRatio());

            await expect(wrappedLoan.decreaseLiquidityUniswapV3(
                [
                    id,
                    decreasedLiquidity,
                    0,
                    0,
                    Math.ceil((new Date().getTime() / 1000) + 100)
                ]
            )).not.to.be.reverted;

            const tvAfter = fromWei(await wrappedLoan.getTotalValue());
            const hrAfter = fromWei(await wrappedLoan.getHealthRatio());

            const liquidityAfter = (await manager.positions(id)).liquidity;

            expect(tvBefore).to.be.closeTo(tvAfter, 0.001);
            expect(hrBefore).to.be.closeTo(hrAfter, 0.001);
            await expect((await wrappedLoan.getOwnedUniswapV3TokenIds()).length).to.be.equal(1);
            expect(fromWei(liquidityAfter)).to.be.closeTo(fromWei(liquidityBefore) - fromWei(decreasedLiquidity), 0.0001);
        });

        it("should withdraw rest and burn UniswapV3 token", async () => {
            let id = (await wrappedLoan.getOwnedUniswapV3TokenIds())[0];

            const manager = await ethers.getContractAt("INonfungiblePositionManager", NONFUNGIBLE_POSITION_MANAGER_ADDRESS, owner);

            const liquidity = (await manager.positions(id)).liquidity;

            const tvBefore = fromWei(await wrappedLoan.getTotalValue());
            const hrBefore = fromWei(await wrappedLoan.getHealthRatio());

            await expect(wrappedLoan.decreaseLiquidityUniswapV3(
                [
                    id,
                    liquidity,
                    0,
                    0,
                    Math.ceil((new Date().getTime() / 1000) + 100)
                ]
            )).not.to.be.reverted;

            const tvAfter = fromWei(await wrappedLoan.getTotalValue());
            const hrAfter = fromWei(await wrappedLoan.getHealthRatio());

            const newLiquidity = (await manager.positions(id)).liquidity;

            expect(tvBefore).to.be.closeTo(tvAfter, 0.001);
            expect(hrBefore).to.be.closeTo(hrAfter, 0.001);
            expect(fromWei(newLiquidity)).to.be.equal(0);

            await expect(wrappedLoan.burnLiquidityUniswapV3(id)).not.to.be.reverted;
            await expect((await wrappedLoan.getOwnedUniswapV3TokenIds()).length).to.be.equal(0);
        });
    });
});
