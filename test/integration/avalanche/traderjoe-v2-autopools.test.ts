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
    erc20ABI,
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
import {
    AddressProvider,
    MockTokenManager,
    PangolinIntermediary,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
} from "../../../typechain";
import {Contract} from "ethers";
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';

chai.use(solidity);

const {deployContract, provider} = waffle;

const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';

const TraderJoeV2AvaxUsdcAutopool = '0x32833a12ed3fd5120429fb01564c98ce3c60fc1d';

describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('A loan with TraderJoe V2 Autopool staking operations', () => {
        let smartLoansFactory: SmartLoansFactory,
            traderJoeV2AvaxUsdcAutopoolToken: Contract,
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
            let assetsList = ['AVAX', 'USDC', 'TJ_AVAX_USDC_AUTO'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]}
            ];

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor, 2000);

            tokensPrices = await getTokensPricesMap(
                assetsList.filter(el => el !== 'TJ_AVAX_USDC_AUTO'),
                "avalanche",
                getRedstonePrices,
                [{symbol: 'TJ_AVAX_USDC_AUTO', value: 0.7921586398264056}]
            );
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList);
            addMissingTokenContracts(tokenContracts, assetsList.filter(asset => !Array.from(tokenContracts.keys()).includes(asset)));

            traderJoeV2AvaxUsdcAutopoolToken = await new ethers.Contract(TraderJoeV2AvaxUsdcAutopool, erc20ABI, provider);

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

            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("300")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("300"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("300"));

            await wrappedLoan.swapPangolin(toBytes32("AVAX"), toBytes32("USDC"), toWei("50"), 0);

            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("300"));
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(600 * tokensPrices.get('AVAX')!, 80);
        });

        it("should fail to stake as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.stakeTraderJoeV2AutopoolAVAXUSDC(toWei("9999"), toWei("9999"), 0, 0)).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.stakeTraderJoeV2AutopoolAVAXUSDC(toWei("9999"), toWei("9999"), 0, 0)).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.stakeTraderJoeV2AutopoolAVAXUSDC(toWei("9999"), toWei("9999"), 0, 0)).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to unstake as a non-owner", async () => {
            await expect(nonOwnerWrappedLoan.unstakeTraderJoeV2AutopoolAVAXUSDC(toWei("9999"), 0, 0)).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.unstakeTraderJoeV2AutopoolAVAXUSDC(toWei("9999"), 0, 0)).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(nonOwnerWrappedLoan.unstakeTraderJoeV2AutopoolAVAXUSDC(toWei("9999"), 0, 0)).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should stake AVAX/USDC", async () => {
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let initialStakedBalance = await traderJoeV2AvaxUsdcAutopoolToken.balanceOf(wrappedLoan.address);
            expect(initialStakedBalance).to.be.equal(0);

            await expect(wrappedLoan.stakeTraderJoeV2AutopoolAVAXUSDC(0, 0, 0, 0)).to.be.revertedWith("Cannot stake 0 tokens");

            await wrappedLoan.swapPangolin(
                toBytes32('AVAX'),
                toBytes32('USDC'),
                toWei('20'),
                0,
            );
            expect(await wrappedLoan.getBalance(toBytes32('USDC'))).to.be.gt(0);

            // Should stake max if amount > balance
            await wrappedLoan.stakeTraderJoeV2AutopoolAVAXUSDC(toWei("99999999"), toWei("99999999"), 0, 0);

            expect(await traderJoeV2AvaxUsdcAutopoolToken.balanceOf(wrappedLoan.address)).to.be.gt(0);

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 5);
        });

        it("should unstake AVAX/USDC", async () => {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            await wrappedLoan.unstakeTraderJoeV2AutopoolAVAXUSDC(toWei("99999999"), 0, 0);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 5);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 5);
        });
    });
});
