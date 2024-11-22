import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import MockTokenArtifact from '../../../artifacts/contracts/mock/MockToken.sol/MockToken.json';
import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import AddressProviderArtifact from '../../../artifacts/contracts/AddressProvider.sol/AddressProvider.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import {
    addMissingTokenContracts,
    Asset,
    convertAssetsListToSupportedAssets,
    convertTokenPricesMapToMockPrices,
    customError,
    deployAllFacets,
    deployPools,
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
import {
    AddressProvider,
    MockToken,
    MockTokenManager,
    SmartLoanGigaChadInterface,
    SmartLoansFactory
} from "../../../typechain";
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';
import {Contract} from "ethers";

chai.use(solidity);

const {deployContract} = waffle;

describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('A loan with debt and repayment', () => {
        let smartLoansFactory: SmartLoansFactory,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            tokenManager: MockTokenManager,
            admin: SignerWithAddress,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            MOCK_PRICES: any,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            mockToken: MockToken,
            tokensPrices: Map<string, number>;

        before("deploy factory, wrapped native token pool and USD pool", async () => {
            [admin, depositor, owner] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'ETH'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]},
            ];

            let diamondAddress = await deployDiamond();

            mockToken = await deployContract(admin, MockTokenArtifact, [[owner.address]]) as MockToken;
            smartLoansFactory = await deployContract(admin, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, admin, depositor);
            tokensPrices = await getTokensPricesMap(assetsList, "avalanche", getRedstonePrices);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList);
            addMissingTokenContracts(tokenContracts, assetsList);

            tokenManager = await deployContract(
                admin,
                MockTokenManagerArtifact,
                []
            ) as MockTokenManager;

            await tokenManager.connect(admin).initialize(supportedAssets, lendingPools);
            await tokenManager.connect(admin).setFactoryAddress(smartLoansFactory.address);

            await smartLoansFactory.initialize(diamondAddress, tokenManager.address);

            let addressProvider = await deployContract(
                admin,
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
            await deployAllFacets(diamondAddress)
        });

        it("should deploy a smart loan", async () => {
            await smartLoansFactory.connect(owner).createLoan();

            const loan_proxy_address = await smartLoansFactory.getLoanForOwner(owner.address);
            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, owner);

            wrappedLoan =  WrapperBuilder
                // @ts-ignore
                .wrap(loan)
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES
                });
        });

        it("should fund a loan, transfer unsupported token to the loan", async () => {
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.equal(1.157920892373162e+59);

            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("200")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("200"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("200"));

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(200 * tokensPrices.get("AVAX")!, 1);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.equal(1.157920892373162e+59);

            mockToken.connect(owner).transfer(wrappedLoan.address, toWei("100"));
        });

        it("should fail to withdraw as a non-owner account", async () => {
            let nonOwnerWrappedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan.connect(depositor))
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });

            await expect(nonOwnerWrappedLoan.withdrawUnsupportedToken(mockToken.address)).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to withdraw supported tokens", async () => {
            await expect(wrappedLoan.withdrawUnsupportedToken(tokenContracts.get('AVAX')!.address)).to.be.revertedWith("token supported");
        });

        it("should fail to withdraw unsupported tokens with debt coverage", async () => {
            await tokenManager.setDebtCoverage(mockToken.address, toWei("0.8333333333333333"));

            await expect(wrappedLoan.withdrawUnsupportedToken(mockToken.address)).to.be.revertedWith("token debt coverage != 0");

            await tokenManager.setDebtCoverage(mockToken.address, toWei("0"));
        });

        it("should withdraw unsupported tokens", async () => {
            const beforeBalance = fromWei(await mockToken.balanceOf(owner.address));

            await wrappedLoan.withdrawUnsupportedToken(mockToken.address);

            const afterBalance = fromWei(await mockToken.balanceOf(owner.address));
            
            expect(afterBalance).to.be.equal(beforeBalance + 100);
        });
    });
});

