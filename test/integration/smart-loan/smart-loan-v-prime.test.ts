import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import DoubleMethodTxArtifact
    from '../../../artifacts/contracts/mock/DoubleBorrowExecInSingleTx.sol/DoubleBorrowExecInSingleTx.json';
import VPrimeArtifact from '../../../artifacts/contracts/token/vPrime.sol/vPrime.json';
import VPrimeControllerArtifact from '../../../artifacts/contracts/token/mock/vPrimeControllerAvalancheMock.sol/vPrimeControllerAvalancheMock.json';
import sPrimeMockArtifact from '../../../artifacts/contracts/token/mock/sPrimeMock.sol/SPrimeMock.json';
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
    DoubleBorrowExecInSingleTx,
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
            vPrimeContract: Contract,
            vPrimeControllerContract: Contract,
            sPrimeContract: Contract,
            admin: SignerWithAddress,
            borrower: SignerWithAddress,
            depositor: SignerWithAddress,
            MOCK_PRICES: any,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            tokensPrices: Map<string, number>;

        before("deploy factory, wrapped native token pool and USD pool", async () => {
            [admin, depositor, borrower] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'ETH', 'MCKUSD'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]},
                {name: 'MCKUSD', airdropList: [borrower, depositor]}
            ];

            let diamondAddress = await deployDiamond();
            smartLoansFactory = await deployContract(admin, SmartLoansFactoryArtifact) as SmartLoansFactory;

            let tokenManager = await deployContract(
                admin,
                MockTokenManagerArtifact,
                []
            ) as MockTokenManager;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, admin, depositor, 1000, 'AVAX', [], tokenManager.address);

            tokensPrices = await getTokensPricesMap(
                assetsList.filter(el => el !== 'MCKUSD'),
                "avalanche",
                getRedstonePrices,
                [{symbol: 'MCKUSD', value: 1}, {symbol: 'AVAX', value: 50}]
            );
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList, {MCKUSD: tokenContracts.get('MCKUSD')!.address});
            addMissingTokenContracts(tokenContracts, assetsList);

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
            sPrimeContract = await deployContract(
                admin,
                sPrimeMockArtifact,
                ["MOCK_S_PRIME", "S_PRIME", 2]
            ) as Contract;
            sPrimeContract = WrapperBuilder.wrap(
                sPrimeContract.connect(admin)
            ).usingSimpleNumericMock({
                mockSignersCount: 3,
                dataPoints: MOCK_PRICES,
            });
            vPrimeContract = await deployContract(
                admin,
                VPrimeArtifact,
                []
            ) as Contract;
            await vPrimeContract.initialize(smartLoansFactory.address);
            vPrimeControllerContract = await deployContract(
                admin,
                VPrimeControllerArtifact,
                []
            ) as Contract;
            await vPrimeControllerContract.initialize([sPrimeContract.address], tokenManager.address, vPrimeContract.address);
            vPrimeControllerContract = WrapperBuilder.wrap(
                vPrimeControllerContract
            ).usingSimpleNumericMock({
                mockSignersCount: 3,
                dataPoints: MOCK_PRICES,
            });

            await tokenManager.setVPrimeControllerAddress(vPrimeControllerContract.address);
            await poolContracts.get('AVAX')!.setTokenManager(tokenManager.address);
            await poolContracts.get('MCKUSD')!.setTokenManager(tokenManager.address);
            await vPrimeContract.setVPrimeControllerAddress(vPrimeControllerContract.address);
            await sPrimeContract.setVPrimeControllerContract(vPrimeControllerContract.address);
            await vPrimeControllerContract.updateBorrowersRegistry(smartLoansFactory.address);
        });


        it("should deploy a smart loan", async () => {
            await smartLoansFactory.connect(borrower).createLoan();

            const loan_proxy_address = await smartLoansFactory.getLoanForOwner(borrower.address);
            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, borrower);

            wrappedLoan =  WrapperBuilder
                // @ts-ignore
                .wrap(loan)
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES
                });
        });

        it("should fail to borrow funds without a collateral in place", async () => {
            await expect(wrappedLoan.borrow(toBytes32("MCKUSD"), 1)).to.be.revertedWith("The action may cause an account to become insolvent");
        });


        it("should fund a loan", async () => {
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.equal(1.157920892373162e+59);

            await tokenContracts.get('MCKUSD')!.connect(borrower).approve(wrappedLoan.address, toWei("1000"));
            await wrappedLoan.fund(toBytes32("MCKUSD"), toWei("300"));

            expect(fromWei(await tokenContracts.get('MCKUSD')!.connect(borrower).balanceOf(wrappedLoan.address))).to.be.equal(300);
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(300, 0.5);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(250, 0.1);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.equal(1.157920892373162e+59);
        });


        it("should borrow 300 MCKUSD", async () => {
            await wrappedLoan.borrow(toBytes32("MCKUSD"), toWei("300"));
            expect(fromWei(await tokenContracts.get('MCKUSD')!.connect(borrower).balanceOf(wrappedLoan.address))).to.be.equal(600);
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(300 + 300, 1);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.closeTo(300, 0.5);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(500, 0.1);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(1.66666666666, 0.001);
        });

        it("should borrow funds in a different token than funded", async () => {
            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("2"));

            expect(fromWei(await tokenContracts.get('AVAX')!.connect(borrower).balanceOf(wrappedLoan.address))).to.be.equal(2);
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(600 + tokensPrices.get('AVAX')! * 2, 1);

            let debt = 300 + tokensPrices.get('AVAX')! * 2;
            let maxDebt = 0.833333 * (600 + tokensPrices.get('AVAX')! * 2);

            expect(fromWei(await wrappedLoan.getDebt())).to.be.closeTo(debt, 0.1);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(maxDebt, 0.1);

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(maxDebt / debt, 0.1)
        });

        // increase sPrime balance to 10 PRIME
        it("borrower should deposit $20 worth of sPRIME", async () => {
            await sPrimeContract.increaseBalance(wrappedLoan.address, toWei("10"));

            expect(await vPrimeContract.balanceOf(wrappedLoan.address)).to.equal(0);
            expect(fromWei(await sPrimeContract.balanceOf(wrappedLoan.address))).to.equal(10);
            expect(await vPrimeControllerContract.getBorrowerVPrimePairsCount(wrappedLoan.address)).to.equal(20);
            // TODO: Add dollar value check based on the getUserValueInTokenY
            const [rate, maxCap] = await vPrimeControllerContract.getBorrowerVPrimeRateAndMaxCap(wrappedLoan.address);
            const newRate = (60-0) * 1e18 / 365 / 24 / 60 / 60 / 3;
            expect(fromWei(maxCap)).to.be.closeTo(60, 1e-6);
            expect(rate).to.be.closeTo(newRate.toFixed(0), 1000);
        });

        // should check vPrime balance after 1 year
        it("should check vPrime balance after 1st year", async () => {
            await ethers.provider.send("evm_increaseTime", [365 * 24 * 60 * 60]);
            await ethers.provider.send("evm_mine", []);

            expect(fromWei(await vPrimeContract.balanceOf(wrappedLoan.address))).to.be.closeTo(20, 1e-6);
            expect(fromWei(await vPrimeContract.balanceOf(borrower.address))).to.be.closeTo(20, 1e-6);
            expect(fromWei(await sPrimeContract.balanceOf(wrappedLoan.address))).to.be.closeTo(10, 1e-6);
            expect(fromWei(await sPrimeContract.balanceOf(borrower.address))).to.be.closeTo(0, 1e-6);
        });

        // should check vPrime balance after 1 year
        it("should check vPrime balance after 2nd year", async () => {
            await ethers.provider.send("evm_increaseTime", [365 * 24 * 60 * 60]);
            await ethers.provider.send("evm_mine", []);

            expect(fromWei(await vPrimeContract.balanceOf(wrappedLoan.address))).to.be.closeTo(40, 1e-6);
            expect(fromWei(await vPrimeContract.balanceOf(borrower.address))).to.be.closeTo(40, 1e-6);
            expect(fromWei(await sPrimeContract.balanceOf(wrappedLoan.address))).to.be.closeTo(10, 1e-6);
            expect(fromWei(await sPrimeContract.balanceOf(borrower.address))).to.be.closeTo(0, 1e-6);
        });

        // should decrease sPrime balance by 5 and the vPrimeBalance after 14 days should be equal to 30
        it("should decrease sPrime balance by 5 and the vPrimeBalance after 14 days should be equal to 30", async () => {
            await sPrimeContract.decreaseBalance(wrappedLoan.address, toWei("5"));

            const [rate, maxCap] = await vPrimeControllerContract.getBorrowerVPrimeRateAndMaxCap(wrappedLoan.address);
            const newRate = (0-10) * 1e18 / 14 / 24 / 60 / 60;
            expect(fromWei(maxCap)).to.be.closeTo(30, 1e-6);
            expect(rate).to.be.closeTo(newRate.toFixed(0), 10000000);

            await ethers.provider.send("evm_increaseTime", [14 * 24 * 60 * 60]);
            await ethers.provider.send("evm_mine", []);
            expect(fromWei(await vPrimeContract.balanceOf(wrappedLoan.address))).to.be.closeTo(30, 1e-6);
            expect(fromWei(await vPrimeContract.balanceOf(borrower.address))).to.be.closeTo(30, 1e-6);
            expect(fromWei(await sPrimeContract.balanceOf(wrappedLoan.address))).to.be.closeTo(5, 1e-6);
            expect(fromWei(await sPrimeContract.balanceOf(borrower.address))).to.be.closeTo(0, 1e-6);
        });

        it("should repay funds", async () => {
            await wrappedLoan.fund(toBytes32("MCKUSD"), toWei("20")); // fund to repay borrowed + interest
            await wrappedLoan.repay(toBytes32("MCKUSD"), toWei("320")); // repay all MCKUSD debt
            await wrappedLoan.repay(toBytes32("AVAX"), toWei("2"));

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(301, 1);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.lt(10);

            expect(await vPrimeControllerContract.getBorrowerVPrimePairsCount(wrappedLoan.address)).to.equal(0);
            expect(fromWei(await vPrimeContract.balanceOf(wrappedLoan.address))).to.be.closeTo(30, 1e-6);
            expect(fromWei(await vPrimeContract.balanceOf(borrower.address))).to.be.closeTo(30, 1e-6);

            const [rate, maxCap] = await vPrimeControllerContract.getBorrowerVPrimeRateAndMaxCap(wrappedLoan.address);
            const newRate = (0-30) * 1e18 / 14 / 24 / 60 / 60;
            expect(fromWei(maxCap)).to.be.closeTo(0, 1e-6);
            expect(rate).to.be.closeTo(newRate.toFixed(0), 1000);
        });

        it("should check vPrime balance after 14 days which should be 0", async () => {
            await ethers.provider.send("evm_increaseTime", [14 * 24 * 60 * 60]);
            await ethers.provider.send("evm_mine", []);

            expect(fromWei(await vPrimeContract.balanceOf(wrappedLoan.address))).to.be.closeTo(0, 1e-6);
            expect(fromWei(await vPrimeContract.balanceOf(borrower.address))).to.be.closeTo(0, 1e-6);
            expect(fromWei(await sPrimeContract.balanceOf(wrappedLoan.address))).to.be.closeTo(5, 1e-6);
            expect(fromWei(await sPrimeContract.balanceOf(borrower.address))).to.be.closeTo(0, 1e-6);
        });

    });
});

