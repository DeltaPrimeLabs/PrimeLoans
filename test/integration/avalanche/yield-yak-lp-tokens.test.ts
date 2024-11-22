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
import {deployDiamond, replaceFacet} from '../../../tools/diamond/deploy-diamond';

chai.use(solidity);

const {deployContract, provider} = waffle;

const traderJoeRouterAddress = '0x60aE616a2155Ee3d9A68541Ba4544862310933d4';

describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('A loan with staking TJ LP tokens on YY', () => {
        let exchange: TraderJoeIntermediary,
            smartLoansFactory: SmartLoansFactory,
            lpTokenAddress: string,
            lpToken: Contract,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            nonOwnerWrappedLoan: any,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            liquidator: SignerWithAddress,
            MOCK_PRICES: any,
            diamondAddress: any,
            tokenManager: MockTokenManager,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            totalValueBeforeStaking: any,
            tokensPrices: Map<string, number>;

        before("deploy factory and pool", async () => {
            [owner, depositor, liquidator] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'USDC', 'TJ_AVAX_USDC_LP', 'YY_TJ_AVAX_USDC_LP'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]},
            ];

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor, 5000)
            tokensPrices = await getTokensPricesMap(assetsList, "avalanche", getRedstonePrices, []);

            // TODO: Add possibility of adding custom ABIs to addMissingTokenContracts()
            tokenContracts.set('TJ_AVAX_USDC_LP', new ethers.Contract(TOKEN_ADDRESSES['TJ_AVAX_USDC_LP'], LPAbi, provider));
            tokenContracts.set('YY_TJ_AVAX_USDC_LP', new ethers.Contract(TOKEN_ADDRESSES['YY_TJ_AVAX_USDC_LP'], LPAbi, provider));

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
                .wrap(loan.connect(liquidator))
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

            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
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

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(fromWei(initialTWV), 5);
        });


        it("should fail to stake TJ LP tokens on YY", async () => {
            await tokenManager.deactivateToken(tokenContracts.get("TJ_AVAX_USDC_LP")!.address);
            await tokenManager.deactivateToken(tokenContracts.get("YY_TJ_AVAX_USDC_LP")!.address);
            await expect(wrappedLoan.stakeTJAVAXUSDCYak(1)).to.be.revertedWith("Token not supported");

            await tokenManager.activateToken(tokenContracts.get("TJ_AVAX_USDC_LP")!.address);
            await expect(wrappedLoan.stakeTJAVAXUSDCYak(1)).to.be.revertedWith("Vault token not supported");

            await tokenManager.activateToken(tokenContracts.get("YY_TJ_AVAX_USDC_LP")!.address);
        });



        it("should stake TJ LP tokens on YY", async () => {
            let initialTJAVAXUSDCBalance = await lpToken.balanceOf(wrappedLoan.address);
            let initialStakedBalance = await tokenContracts.get('YY_TJ_AVAX_USDC_LP')!.balanceOf(wrappedLoan.address);

            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = await wrappedLoan.getThresholdWeightedValue();
            totalValueBeforeStaking = initialTotalValue;

            expect(initialTJAVAXUSDCBalance).to.be.gt(0);
            expect(initialStakedBalance).to.be.eq(0);

            await wrappedLoan.stakeTJAVAXUSDCYak(100000);

            initialTJAVAXUSDCBalance = await lpToken.balanceOf(wrappedLoan.address);
            initialStakedBalance = await tokenContracts.get('YY_TJ_AVAX_USDC_LP')!.balanceOf(wrappedLoan.address);
            expect(initialTJAVAXUSDCBalance).to.be.gt(0);
            expect(initialStakedBalance).to.be.gt(0);

            // Should stake max if amount > balance
            await wrappedLoan.stakeTJAVAXUSDCYak(toWei("9999999"));

            initialTJAVAXUSDCBalance = await lpToken.balanceOf(wrappedLoan.address);
            expect(await tokenContracts.get('YY_TJ_AVAX_USDC_LP')!.balanceOf(wrappedLoan.address)).to.be.gt(initialStakedBalance);
            expect(initialTJAVAXUSDCBalance).to.be.eq(0);

            let endTJAVAXUSDCBalance = await lpToken.balanceOf(wrappedLoan.address);
            let endStakedBalance = await tokenContracts.get('YY_TJ_AVAX_USDC_LP')!.balanceOf(wrappedLoan.address);

            expect(endTJAVAXUSDCBalance).to.be.eq(0);
            expect(endStakedBalance).to.be.gt(0);

            let totalValueDifference = initialTotalValue - fromWei(await wrappedLoan.getTotalValue());

            await expect(totalValueDifference).to.be.closeTo(0, 5);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(fromWei(initialTWV), 2);
        });

        it("should unstake TJ LP tokens from YY", async () => {
            let initialStakedBalance = await tokenContracts.get('YY_TJ_AVAX_USDC_LP')!.balanceOf(wrappedLoan.address);
            let initialTJAVAXUSDCBalance = await lpToken.balanceOf(wrappedLoan.address);

            let initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            expect(initialTJAVAXUSDCBalance).to.be.eq(0);
            expect(initialStakedBalance).to.be.gt(0);

            await wrappedLoan.unstakeTJAVAXUSDCYak(initialStakedBalance);

            let endTJAVAXUSDCBalance = await lpToken.balanceOf(wrappedLoan.address);
            let endStakedBalance = await tokenContracts.get('YY_TJ_AVAX_USDC_LP')!.balanceOf(wrappedLoan.address);

            expect(endTJAVAXUSDCBalance).to.be.gt(0);
            expect(endStakedBalance).to.be.eq(0);

            const currentTotalValue = fromWei(await wrappedLoan.getTotalValue());

            await expect(initialTotalValue - currentTotalValue).to.be.closeTo(0, 5);
            expect(currentTotalValue).to.be.closeTo(totalValueBeforeStaking, 5);

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 2);
        });

        it("should not fail to unstake TJ LP tokens from YY but unstake everything", async () => {
            await wrappedLoan.stakeTJAVAXUSDCYak(await lpToken.balanceOf(wrappedLoan.address));
            await wrappedLoan.unstakeTJAVAXUSDCYak(toWei("9999"));
            expect(await tokenContracts.get('YY_TJ_AVAX_USDC_LP')!.balanceOf(wrappedLoan.address)).to.be.equal(0);
        });

        it("should allow anyone to unstake if insolvent", async () => {
            await wrappedLoan.stakeTJAVAXUSDCYak(await lpToken.balanceOf(wrappedLoan.address));

            await expect(nonOwnerWrappedLoan.unstakeTJAVAXUSDCYak(await wrappedLoan.getBalance(toBytes32('YY_TJ_AVAX_USDC_LP')))).to.be.reverted;

            const diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress, owner);
            await diamondCut.pause();
            await replaceFacet('MockSolvencyFacetAlwaysSolvent', diamondAddress, ['isSolvent']);
            await diamondCut.unpause();

            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("3000"));

            await diamondCut.pause();
            await replaceFacet('SolvencyFacetMock', diamondAddress, ['isSolvent']);
            await diamondCut.unpause();

            const whitelistingContract = await ethers.getContractAt('SmartLoanGigaChadInterface', diamondAddress, owner);

            expect(await wrappedLoan.isSolvent()).to.be.false;

            await expect(nonOwnerWrappedLoan.unstakeTJAVAXUSDCYak(await wrappedLoan.getBalance(toBytes32('YY_TJ_AVAX_USDC_LP')))).to.be.reverted;

            await whitelistingContract.whitelistLiquidators([liquidator.address]);

            await expect(nonOwnerWrappedLoan.unstakeTJAVAXUSDCYak(await wrappedLoan.getBalance(toBytes32('YY_TJ_AVAX_USDC_LP')))).not.to.be.reverted;
        });
    });
});

