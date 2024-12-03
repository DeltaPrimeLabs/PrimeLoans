import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import AddressProviderArtifact from '../../../artifacts/contracts/AddressProvider.sol/AddressProvider.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import TOKEN_ADDRESSES from '../../../common/addresses/avax/token_addresses.json';
import {
    addMissingTokenContracts,
    Asset,
    convertAssetsListToSupportedAssets,
    convertTokenPricesMapToMockPrices,
    deployAllFacets,
    deployAndInitExchangeContract,
    deployPools,
    erc20ABI,
    formatUnits,
    fromWei,
    getFixedGasSigners,
    getRedstonePrices,
    getTokensPricesMap,
    LPAbi,
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
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
    TraderJoeIntermediary,
} from "../../../typechain";
import {BigNumber, Contract} from "ethers";
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';

chai.use(solidity);

const {deployContract, provider} = waffle;

const traderJoeRouterAddress = '0x60aE616a2155Ee3d9A68541Ba4544862310933d4';

describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('A loan with staking TJ LP tokens on BeefyFinance', () => {
        let exchange: TraderJoeIntermediary,
            smartLoansFactory: SmartLoansFactory,
            lpTokenAddress: string,
            lpToken: Contract,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            nonOwnerWrappedLoan: any,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            MOCK_PRICES: any,
            tjLPTokenPrice: number,
            beefyTJLPTokenPrice: number,
            diamondAddress: any,
            tokenManager: MockTokenManager,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            totalValueBeforeStaking: any,
            tokensPrices: Map<string, number>;

        before("deploy factory and pool", async () => {
            [owner, depositor] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'USDC', 'TJ_AVAX_USDC_LP', 'MOO_TJ_AVAX_USDC_LP'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]},
            ];

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor)
            tokensPrices = await getTokensPricesMap(assetsList.filter(el => !(['TJ_AVAX_USDC_LP', 'MOO_TJ_AVAX_USDC_LP'].includes(el))), "avalanche", getRedstonePrices, []);

            // TODO: Add possibility of adding custom ABIs to addMissingTokenContracts()
            tokenContracts.set('TJ_AVAX_USDC_LP', new ethers.Contract(TOKEN_ADDRESSES['TJ_AVAX_USDC_LP'], LPAbi, provider));
            tokenContracts.set('MOO_TJ_AVAX_USDC_LP', new ethers.Contract(TOKEN_ADDRESSES['MOO_TJ_AVAX_USDC_LP'], LPAbi, provider));

            let lpTokenTotalSupply = await tokenContracts.get('TJ_AVAX_USDC_LP')!.totalSupply();
            let [lpTokenToken0Reserve, lpTokenToken1Reserve] = await tokenContracts.get('TJ_AVAX_USDC_LP')!.getReserves();
            let token0USDValue = fromWei(lpTokenToken0Reserve) * tokensPrices.get('AVAX')!;
            let token1USDValue = formatUnits(lpTokenToken1Reserve, BigNumber.from("6")) * tokensPrices.get('USDC')!;
            tjLPTokenPrice = (token0USDValue + token1USDValue) / fromWei(lpTokenTotalSupply);
            let bfTotalSupply = await tokenContracts.get('MOO_TJ_AVAX_USDC_LP')!.totalSupply();
            let bfTotalDeposits = await tokenContracts.get('MOO_TJ_AVAX_USDC_LP')!.balance();
            beefyTJLPTokenPrice = tjLPTokenPrice * fromWei(bfTotalDeposits) / fromWei(bfTotalSupply)


            tokensPrices = await getTokensPricesMap(
                [],
                "avalanche",
                getRedstonePrices,
                [
                    {symbol: 'TJ_AVAX_USDC_LP', value: tjLPTokenPrice},
                    {symbol: 'MOO_TJ_AVAX_USDC_LP', value: beefyTJLPTokenPrice},
                ],
                tokensPrices
            );
            addMissingTokenContracts(tokenContracts, assetsList);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList);

            tokenManager = await deployContract(
                owner,
                MockTokenManagerArtifact,
                []
            ) as MockTokenManager;

            await tokenManager.connect(owner).initialize(supportedAssets, lendingPools);
            await tokenManager.connect(owner).setFactoryAddress(smartLoansFactory.address);

            await smartLoansFactory.initialize(diamondAddress, tokenManager.address);

            exchange = await deployAndInitExchangeContract(owner, traderJoeRouterAddress, tokenManager.address, supportedAssets, "TraderJoeIntermediary") as TraderJoeIntermediary;

            lpTokenAddress = await exchange.connect(owner).getPair(TOKEN_ADDRESSES['AVAX'], TOKEN_ADDRESSES['USDC']);
            lpToken = new ethers.Contract(lpTokenAddress, erc20ABI, provider);

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
                        facetPath: './contracts/facets/avalanche/TraderJoeDEXFacet.sol',
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

            tokensPrices = await getTokensPricesMap(['AVAX', 'USDC'], "avalanche", getRedstonePrices,
                [{
                    symbol: 'TJ_AVAX_USDC_LP',
                    value: tjLPTokenPrice
                },
                    {
                        symbol: 'MOO_TJ_AVAX_USDC_LP',
                        value: beefyTJLPTokenPrice
                    }]);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);

            wrappedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan)
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });

            nonOwnerWrappedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan.connect(depositor))
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });
        });

        it("should swap and addLiquidity on TJ", async () => {
            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("500")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("500"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("500"));


            await wrappedLoan.swapTraderJoe(
                toBytes32('AVAX'),
                toBytes32('USDC'),
                toWei('200'),
                0
            );

            let initialHR = await wrappedLoan.getHealthRatio();
            let initialTWV = await wrappedLoan.getThresholdWeightedValue();

            expect(await lpToken.balanceOf(wrappedLoan.address)).to.be.equal(0);

            await wrappedLoan.addLiquidityTraderJoe(
                toBytes32('AVAX'),
                toBytes32('USDC'),
                toWei("180"),
                parseUnits((tokensPrices.get('AVAX')! * 180).toFixed(6), BigNumber.from("6")),
                toWei("160"),
                parseUnits((tokensPrices.get('AVAX')! * 160).toFixed(6), BigNumber.from("6"))
            );
            expect(await lpToken.balanceOf(wrappedLoan.address)).to.be.gt(0);

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(fromWei(initialHR), 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(fromWei(initialTWV), 10);
        });


        it("should fail to stake TJ LP tokens on Beefy", async () => {
            await tokenManager.deactivateToken(tokenContracts.get("TJ_AVAX_USDC_LP")!.address);
            await tokenManager.deactivateToken(tokenContracts.get("MOO_TJ_AVAX_USDC_LP")!.address);
            await expect(wrappedLoan.stakeTjUsdcAvaxLpBeefy(1)).to.be.revertedWith("LP token not supported");

            await tokenManager.activateToken(tokenContracts.get("TJ_AVAX_USDC_LP")!.address);
            await expect(wrappedLoan.stakeTjUsdcAvaxLpBeefy(1)).to.be.revertedWith("Vault token not supported");

            await tokenManager.activateToken(tokenContracts.get("MOO_TJ_AVAX_USDC_LP")!.address);
        });



        it("should stake TJ LP tokens on Beefy", async () => {
            let initialTJAVAXUSDCBalance = await lpToken.balanceOf(wrappedLoan.address);
            let initialStakedBalance = await tokenContracts.get('MOO_TJ_AVAX_USDC_LP')!.balanceOf(wrappedLoan.address);

            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = await wrappedLoan.getHealthRatio();
            let initialTWV = await wrappedLoan.getThresholdWeightedValue();
            totalValueBeforeStaking = initialTotalValue;

            expect(initialTJAVAXUSDCBalance).to.be.gt(0);
            expect(initialStakedBalance).to.be.eq(0);

            await wrappedLoan.stakeTjUsdcAvaxLpBeefy(initialTJAVAXUSDCBalance.mul(2));

            let endTJAVAXUSDCBalance = await lpToken.balanceOf(wrappedLoan.address);
            let endStakedBalance = await tokenContracts.get('MOO_TJ_AVAX_USDC_LP')!.balanceOf(wrappedLoan.address);

            expect(endTJAVAXUSDCBalance).to.be.eq(0);
            expect(endStakedBalance).to.be.gt(0);

            await expect(fromWei(initialTotalValue) - fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(0, 0.1);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(fromWei(initialHR), 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(fromWei(initialTWV), 0.01);
        });

        it("should fail to unstake TJ LP tokens from Beefy", async () => {
            await expect(wrappedLoan.unstakeTjUsdcAvaxLpBeefy(0)).to.be.revertedWith("Cannot unstake 0 tokens");
        });

        it("should unstake TJ LP tokens from Beefy", async () => {
            const initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialHR = await wrappedLoan.getHealthRatio();
            let initialTWV = await wrappedLoan.getThresholdWeightedValue();

            let initialStakedBalance = await tokenContracts.get('MOO_TJ_AVAX_USDC_LP')!.balanceOf(wrappedLoan.address);
            let initialTJAVAXUSDCBalance = await lpToken.balanceOf(wrappedLoan.address);

            expect(initialTJAVAXUSDCBalance).to.be.eq(0);
            expect(initialStakedBalance).to.be.gt(0);

            await wrappedLoan.unstakeTjUsdcAvaxLpBeefy(initialStakedBalance);

            let endTJAVAXUSDCBalance = await lpToken.balanceOf(wrappedLoan.address);
            let endStakedBalance = await tokenContracts.get('MOO_TJ_AVAX_USDC_LP')!.balanceOf(wrappedLoan.address);

            expect(endTJAVAXUSDCBalance).to.be.gt(0);
            expect(endStakedBalance).to.be.eq(0);

            const withdrawalFee = 0.001;    // 0.1 %
            const expectedDelta = initialTotalValue * withdrawalFee

            const currentTotalValue = fromWei(await wrappedLoan.getTotalValue());

            await expect(initialTotalValue - currentTotalValue).to.be.closeTo(0, expectedDelta);
            expect(currentTotalValue).to.be.closeTo(fromWei(totalValueBeforeStaking), 30);

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(fromWei(initialHR), 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(fromWei(initialTWV), 50);
        });
    });
});

