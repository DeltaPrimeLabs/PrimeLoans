import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import AddressProviderArtifact from '../../../artifacts/contracts/AddressProvider.sol/AddressProvider.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import TOKEN_ADDRESSES from '../../../common/addresses/arbitrum/token_addresses.json';
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
    SushiSwapIntermediary,
} from "../../../typechain";
import {BigNumber, Contract} from "ethers";
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';

chai.use(solidity);

const {deployContract, provider} = waffle;

const sushiSwapRouterAddress = '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506';

describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('A loan with staking tokens on BeefyFinance', () => {
        let exchange: SushiSwapIntermediary,
            smartLoansFactory: SmartLoansFactory,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
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
            [owner, depositor] = await getFixedGasSigners(10000000);
            let assetsList = ['ETH', 'GMX', 'MOO_GMX'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'ETH', airdropList: [depositor]},
            ];

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor, 1000, 'ARBITRUM');
            tokensPrices = await getTokensPricesMap(assetsList, "arbitrum", getRedstonePrices, []);

            // TODO: Add possibility of adding custom ABIs to addMissingTokenContracts()
            tokenContracts.set('MOO_GMX', new ethers.Contract(TOKEN_ADDRESSES['MOO_GMX'], LPAbi, provider));

            tokensPrices = await getTokensPricesMap(
                [],
                "arbitrum",
                getRedstonePrices,
                [],
                tokensPrices
            );
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

            exchange = await deployAndInitExchangeContract(owner, sushiSwapRouterAddress, tokenManager.address, supportedAssets, "SushiSwapIntermediary") as SushiSwapIntermediary;

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
                        facetPath: './contracts/facets/arbitrum/SushiSwapDEXFacet.sol',
                        contractAddress: exchange.address,
                    }
                ],
                tokenManager.address,
                addressProvider.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib',
                5000,
                "1.042e18",
                200,
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
        });

        it("should swap on Sushi", async () => {
            await tokenContracts.get('ETH')!.connect(owner).deposit({value: toWei("300")});
            await tokenContracts.get('ETH')!.connect(owner).approve(wrappedLoan.address, toWei("300"));
            await wrappedLoan.fund(toBytes32("ETH"), toWei("300"));

            await wrappedLoan.swapSushiSwap(
                toBytes32('ETH'),
                toBytes32('GMX'),
                toWei('10'),
                0
            );

            let initialHR = await wrappedLoan.getHealthRatio();
            let initialTWV = await wrappedLoan.getThresholdWeightedValue();

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(fromWei(initialHR), 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(fromWei(initialTWV), 50);
        });

        it("should fail to stake GMX on Beefy", async () => {
            await tokenManager.deactivateToken(tokenContracts.get("GMX")!.address);
            await tokenManager.deactivateToken(tokenContracts.get("MOO_GMX")!.address);
            await expect(wrappedLoan.stakeGmxBeefy(1)).to.be.revertedWith("LP token not supported");

            await tokenManager.activateToken(tokenContracts.get("GMX")!.address);
            await expect(wrappedLoan.stakeGmxBeefy(1)).to.be.revertedWith("Vault token not supported");

            await tokenManager.activateToken(tokenContracts.get("MOO_GMX")!.address);
        });

        it("should stake GMX on Beefy", async () => {
            let initialGmxBalance = await tokenContracts.get('GMX')!.balanceOf(wrappedLoan.address);
            let initialStakedBalance = await tokenContracts.get('MOO_GMX')!.balanceOf(wrappedLoan.address);

            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = await wrappedLoan.getHealthRatio();
            let initialTWV = await wrappedLoan.getThresholdWeightedValue();
            totalValueBeforeStaking = initialTotalValue;

            expect(initialGmxBalance).to.be.gt(0);
            expect(initialStakedBalance).to.be.eq(0);

            await wrappedLoan.stakeGmxBeefy(initialGmxBalance.mul(2));

            let endGmxBalance = await tokenContracts.get('GMX')!.balanceOf(wrappedLoan.address);
            let endStakedBalance = await tokenContracts.get('MOO_GMX')!.balanceOf(wrappedLoan.address);

            expect(endGmxBalance).to.be.eq(0);
            expect(endStakedBalance).to.be.gt(0);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 20);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(fromWei(initialHR), 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(fromWei(initialTWV), 50);
        });

        it("should fail to unstake GMX from Beefy", async () => {
            await expect(wrappedLoan.unstakeGmxBeefy(0)).to.be.revertedWith("Cannot unstake 0 tokens");
        });

        it("should unstake GMX from Beefy", async () => {
            const initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialHR = await wrappedLoan.getHealthRatio();
            let initialTWV = await wrappedLoan.getThresholdWeightedValue();

            let initialStakedBalance = await tokenContracts.get('MOO_GMX')!.balanceOf(wrappedLoan.address);
            let initialGmxBalance = await tokenContracts.get('GMX')!.balanceOf(wrappedLoan.address);

            expect(initialGmxBalance).to.be.eq(0);
            expect(initialStakedBalance).to.be.gt(0);

            await wrappedLoan.unstakeGmxBeefy(initialStakedBalance);

            let endGmxBalance = await tokenContracts.get('GMX')!.balanceOf(wrappedLoan.address);
            let endStakedBalance = await tokenContracts.get('MOO_GMX')!.balanceOf(wrappedLoan.address);

            expect(endGmxBalance).to.be.gt(0);
            expect(endStakedBalance).to.be.eq(0);

            const withdrawalFee = 0.001;    // 0.1 %
            const expectedDelta = initialTotalValue * withdrawalFee

            const currentTotalValue = fromWei(await wrappedLoan.getTotalValue());

            await expect(initialTotalValue - currentTotalValue).to.be.closeTo(0, expectedDelta);
            expect(currentTotalValue).to.be.closeTo(fromWei(totalValueBeforeStaking), 5);

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(fromWei(initialHR), 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(fromWei(initialTWV), 10);
        });
    });
});
