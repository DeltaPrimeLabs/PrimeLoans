import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
let chaiDeepCloseTo = require("chai-deep-closeto");
import VariableUtilisationRatesCalculatorArtifact
    from '../../artifacts/contracts/mock/MockVariableUtilisationRatesCalculator.sol/MockVariableUtilisationRatesCalculator.json';
import OpenBorrowersRegistryArtifact
    from '../../artifacts/contracts/mock/OpenBorrowersRegistry.sol/OpenBorrowersRegistry.json';
import MockTokenManagerArtifact from '../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import LinearIndexArtifact from '../../artifacts/contracts/LinearIndex.sol/LinearIndex.json';
import VPrimeArtifact from '../../artifacts/contracts/tokens/vPrime.sol/vPrime.json';
import VPrimeControllerArtifact from '../../artifacts/contracts/tokens/mock/vPrimeControllerAvalancheMock.sol/vPrimeControllerAvalancheMock.json';
import sPrimeMockArtifact from '../../artifacts/contracts/tokens/mock/sPrimeMock.sol/SPrimeMock.json';
import SmartLoansFactoryArtifact from '../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import MockTokenArtifact from "../../artifacts/contracts/mock/MockToken.sol/MockToken.json";
import PoolArtifact from '../../artifacts/contracts/Pool.sol/Pool.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
    Asset,
    convertTokenPricesMapToMockPrices,
    customError,
    fromWei,
    getFixedGasSigners, pool, PoolAsset,
    time, toBytes32,
    toWei
} from "../_helpers";
import {deployMockContract} from '@ethereum-waffle/mock-contract';
import {
    LinearIndex,
    MockToken,
    MockTokenManager,
    OpenBorrowersRegistry,
    Pool,
    SmartLoansFactory
} from "../../typechain";
import {Bignumber, Contract} from "ethers";
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import {toBytes} from "viem";
import {token} from "@redstone-finance/evm-connector/dist/typechain-types/@openzeppelin/contracts";

chai.use(chaiDeepCloseTo);
chai.use(solidity);
const ZERO = ethers.constants.AddressZero;

const {deployContract} = waffle;

describe('Pool with variable utilisation interest rates', () => {
    let poolContract: Pool,
        vPrimeContract: Contract,
        vPrimeControllerContract: Contract,
        sPrimeContract: Contract,
        smartLoansFactory: SmartLoansFactory,
        owner: SignerWithAddress,
        depositor: SignerWithAddress,
        depositor2: SignerWithAddress,
        depositor3: SignerWithAddress,
        mockToken: Contract,
        MOCK_PRICES: any,
        mockVariableUtilisationRatesCalculator;

    before(async () => {
        [owner, depositor, depositor2, depositor3] = await getFixedGasSigners(100000000);
        mockVariableUtilisationRatesCalculator = await deployMockContract(owner, VariableUtilisationRatesCalculatorArtifact.abi);
        mockToken = (await deployContract(owner, MockTokenArtifact, [[depositor.address, depositor2.address, depositor3.address]])) as MockToken;
        let supportedAssets = [new Asset(toBytes32("MOCK_TOKEN"), mockToken.address)];
        await mockVariableUtilisationRatesCalculator.mock.calculateDepositRate.returns(toWei("0.05"));
        await mockVariableUtilisationRatesCalculator.mock.calculateBorrowingRate.returns(toWei("0.05"));

        poolContract = (await deployContract(owner, PoolArtifact)) as Pool;
        let lendingPools = [new PoolAsset(toBytes32("MOCK_TOKEN"), poolContract.address)];

        const borrowersRegistry = (await deployContract(owner, OpenBorrowersRegistryArtifact)) as OpenBorrowersRegistry;
        const depositIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
        await depositIndex.initialize(poolContract.address);
        const borrowingIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
        await borrowingIndex.initialize(poolContract.address);

        await poolContract.initialize(
            mockVariableUtilisationRatesCalculator.address,
            borrowersRegistry.address,
            depositIndex.address,
            borrowingIndex.address,
            mockToken.address,
            ZERO,
            0
        );

        smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

        let tokenManager = await deployContract(
            owner,
            MockTokenManagerArtifact,
            []
        ) as MockTokenManager;

        await tokenManager.connect(owner).initialize(supportedAssets, lendingPools);
        await tokenManager.connect(owner).setFactoryAddress(smartLoansFactory.address);

        await smartLoansFactory.initialize(ethers.constants.AddressZero, tokenManager.address);

        let tokensMap = new Map();
        tokensMap.set("MOCK_TOKEN", 1.0);
        MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensMap);

        sPrimeContract = await deployContract(
            owner,
            sPrimeMockArtifact,
            ["MOCK_S_PRIME", "S_PRIME", 2]
        ) as Contract;

        sPrimeContract = WrapperBuilder.wrap(
            sPrimeContract.connect(owner)
        ).usingSimpleNumericMock({
            mockSignersCount: 3,
            dataPoints: MOCK_PRICES,
        });

        vPrimeContract = await deployContract(
            owner,
            VPrimeArtifact,
            []
        ) as Contract;
        await vPrimeContract.initialize(smartLoansFactory.address);

        vPrimeControllerContract = await deployContract(
            owner,
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
        await vPrimeContract.setVPrimeControllerAddress(vPrimeControllerContract.address);
        await sPrimeContract.setVPrimeControllerContract(vPrimeControllerContract.address);
        await vPrimeControllerContract.updateBorrowersRegistry(smartLoansFactory.address);
        await poolContract.setTokenManager(tokenManager.address);
    });

    it("should check initial pool, vPrime, sPrime balances and vPrimePairsCount", async () => {
        expect(await poolContract.balanceOf(depositor.address)).to.equal(0);
        expect(await poolContract.balanceOf(depositor2.address)).to.equal(0);
        expect(await poolContract.balanceOf(depositor3.address)).to.equal(0);

        expect(await vPrimeContract.balanceOf(depositor.address)).to.equal(0);
        expect(await vPrimeContract.balanceOf(depositor2.address)).to.equal(0);
        expect(await vPrimeContract.balanceOf(depositor3.address)).to.equal(0);

        expect(await sPrimeContract.balanceOf(depositor.address)).to.equal(0);
        expect(await sPrimeContract.balanceOf(depositor2.address)).to.equal(0);
        expect(await sPrimeContract.balanceOf(depositor3.address)).to.equal(0);

        expect((await vPrimeControllerContract.getDepositorVPrimePairsCount(depositor.address)).map(bn => bn.toString())).to.deep.equal(["0" ,"0"]);
        expect((await vPrimeControllerContract.getDepositorVPrimePairsCount(depositor2.address)).map(bn => bn.toString())).to.deep.equal(["0" ,"0"])
        expect((await vPrimeControllerContract.getDepositorVPrimePairsCount(depositor3.address)).map(bn => bn.toString())).to.deep.equal(["0" ,"0"])

        expect((await vPrimeControllerContract.getUserDepositDollarValueAcrossWhiteListedPoolsVestedAndNonVested(depositor.address)).map(bn => bn.toString())).to.deep.equal(["0" ,"0"]);
        expect((await vPrimeControllerContract.getUserDepositDollarValueAcrossWhiteListedPoolsVestedAndNonVested(depositor2.address)).map(bn => bn.toString())).to.deep.equal(["0" ,"0"]);
        expect((await vPrimeControllerContract.getUserDepositDollarValueAcrossWhiteListedPoolsVestedAndNonVested(depositor3.address)).map(bn => bn.toString())).to.deep.equal(["0" ,"0"]);

        // TODO: Add dollar value check based on the getUserValueInTokenY

        expect((await vPrimeControllerContract.getDepositorVPrimeRateAndMaxCap(depositor.address)).map(bn => bn.toString())).to.deep.equal(["0", "0", "0"]);
        expect((await vPrimeControllerContract.getDepositorVPrimeRateAndMaxCap(depositor2.address)).map(bn => bn.toString())).to.deep.equal(["0" ,"0", "0"]);
        expect((await vPrimeControllerContract.getDepositorVPrimeRateAndMaxCap(depositor3.address)).map(bn => bn.toString())).to.deep.equal(["0" ,"0", "0"]);
    });

    async function checkDepositorPairsCount(depositor: SignerWithAddress, fullyVestedCount, nonVestedCount) {
        expect((await vPrimeControllerContract.getDepositorVPrimePairsCount(depositor.address)).map(bn => bn.toString())).to.deep.equal([fullyVestedCount.toString() , nonVestedCount.toString()]);
    }

    async function checkDepositsDollarValue(depositor: SignerWithAddress, fullyVestedDollarValue: number, nonVestedDollarValue: number) {
        expect((await vPrimeControllerContract.getUserDepositDollarValueAcrossWhiteListedPoolsVestedAndNonVested(depositor.address)).map(bn => fromWei(bn))).to.deep.closeTo([fullyVestedDollarValue , nonVestedDollarValue], 1e-6);
    }

    async function checkSPrimeDollarValue(depositor: SignerWithAddress, sPrimeDollarValue: number) {
        // TODO: Add dollar value check based on the getUserValueInTokenY
    }

    async function checkDepositorSPrimeDollarValue(depositor: SignerWithAddress, sPrimeDollarValue: number) {
        expect(fromWei(await vPrimeControllerContract.getUserSPrimeDollarValue(depositor.address))).to.equal(sPrimeDollarValue);
    }

    async function compareVPrimeBalanceAfterSomeTime(depositor: SignerWithAddress, timeInSeconds: number, expectedBalanceDelta: number) {
        let vPrimeBalanceBefore = await vPrimeContract.balanceOf(depositor.address);
        await time.increase(timeInSeconds);
        let vPrimeBalanceAfter = await vPrimeContract.balanceOf(depositor.address);
        expect(fromWei(vPrimeBalanceAfter.sub(vPrimeBalanceBefore))).to.be.closeTo(expectedBalanceDelta, 1e-6);
    }


    async function increaseSPrimeBalanceAndPerformChecks(depositor: SignerWithAddress, amount: Bignumber) {
        let sPrimeBalanceBefore = fromWei(await sPrimeContract.balanceOf(depositor.address));
        let vPrimeBalanceBefore = fromWei(await vPrimeContract.balanceOf(depositor.address));


        await sPrimeContract.increaseBalance(depositor.address, amount);

        let sPrimeBalanceAfter = fromWei(await sPrimeContract.balanceOf(depositor.address));
        let vPrimeBalanceAfter = fromWei(await vPrimeContract.balanceOf(depositor.address));

        expect(sPrimeBalanceAfter - sPrimeBalanceBefore).to.equal(fromWei(amount));
        expect(vPrimeBalanceAfter - vPrimeBalanceBefore).to.equal(vPrimeBalanceBefore);

    }

    async function withdrawFromPool(depositor: SignerWithAddress, amount: Bignumber) {
        let depositBalanceBefore = await poolContract.balanceOf(depositor.address);
        let vPrimeBalanceBefore = await vPrimeContract.balanceOf(depositor.address);
        let sPrimeBalanceBefore = await sPrimeContract.balanceOf(depositor.address);
        let mockTokenPoolBalanceBefore = await mockToken.balanceOf(poolContract.address);

        let wrappedPool = WrapperBuilder
            // @ts-ignore
            .wrap(poolContract.connect(depositor))
            .usingSimpleNumericMock({
                mockSignersCount: 3,
                dataPoints: MOCK_PRICES,
            });
        await wrappedPool.withdraw(amount);

        let mockTokenPoolBalanceAfter = await mockToken.balanceOf(poolContract.address);
        let depositBalanceAfter = await poolContract.balanceOf(depositor.address);
        let vPrimeBalanceAfter = await vPrimeContract.balanceOf(depositor.address);
        let sPrimeBalanceAfter = await sPrimeContract.balanceOf(depositor.address);

        expect(mockTokenPoolBalanceBefore.sub(mockTokenPoolBalanceAfter)).to.equal(amount);
        expect(fromWei(depositBalanceBefore.sub(depositBalanceAfter))).to.closeTo(fromWei(amount), 1e-6);
        expect(fromWei(vPrimeBalanceBefore.sub(vPrimeBalanceAfter))).to.closeTo(0, 1e-6);
        expect(sPrimeBalanceBefore.sub(sPrimeBalanceAfter)).to.equal(0);
    }

    async function depositToPool(depositor: SignerWithAddress, amount: Bignumber) {
        let depositBalanceBefore = await poolContract.balanceOf(depositor.address);
        let vPrimeBalanceBefore = await vPrimeContract.balanceOf(depositor.address);
        let sPrimeBalanceBefore = await sPrimeContract.balanceOf(depositor.address);
        let mockTokenPoolBalanceBefore = await mockToken.balanceOf(poolContract.address);

        let wrappedPool = WrapperBuilder
            // @ts-ignore
            .wrap(poolContract.connect(depositor))
            .usingSimpleNumericMock({
                mockSignersCount: 3,
                dataPoints: MOCK_PRICES,
            });
        await mockToken.connect(depositor).approve(poolContract.address, amount);
        await wrappedPool.deposit(amount);

        let mockTokenPoolBalanceAfter = await mockToken.balanceOf(poolContract.address);
        let depositBalanceAfter = await poolContract.balanceOf(depositor.address);
        let vPrimeBalanceAfter = await vPrimeContract.balanceOf(depositor.address);
        let sPrimeBalanceAfter = await sPrimeContract.balanceOf(depositor.address);

        expect(mockTokenPoolBalanceAfter.sub(mockTokenPoolBalanceBefore)).to.equal(amount);
        expect(fromWei(depositBalanceAfter.sub(depositBalanceBefore))).to.closeTo(fromWei(amount), 1e-6);
        expect(fromWei(vPrimeBalanceAfter.sub(vPrimeBalanceBefore))).to.closeTo(0, 1e-6);
        expect(sPrimeBalanceAfter.sub(sPrimeBalanceBefore)).to.equal(0);
    }

    async function lockSPrimeAndPerformChecks(depositor: SignerWithAddress, amount: Bignumber, duration: number) {
        let sPrimeBalanceBefore = await sPrimeContract.balanceOf(depositor.address);
        let sPrimeLockedBalanceBefore = await sPrimeContract.getLockedBalance(depositor.address);
        let wrappedSPrime = WrapperBuilder.wrap(sPrimeContract.connect(depositor)).usingSimpleNumericMock({
            mockSignersCount: 3,
            dataPoints: MOCK_PRICES,
        });

        await wrappedSPrime.lockBalance(amount, duration);

        let sPrimeBalanceAfter = await sPrimeContract.balanceOf(depositor.address);
        let sPrimeLockedBalanceAfter = await sPrimeContract.getLockedBalance(depositor.address);

        expect(fromWei(sPrimeBalanceBefore)).to.be.closeTo(fromWei(sPrimeBalanceAfter), 1e-6);
        expect(fromWei(sPrimeLockedBalanceAfter.sub(sPrimeLockedBalanceBefore))).to.be.closeTo(fromWei(amount), 1e-6);
    }

    async function lockDepositAndPerformChecks(depositor: SignerWithAddress, amount: Bignumber, duration: number) {
        let depositBalanceBefore = await poolContract.balanceOf(depositor.address);
        let lockedBalanceBefore = await poolContract.getLockedBalance(depositor.address);

        let wrappedPool = WrapperBuilder
            // @ts-ignore
            .wrap(poolContract.connect(depositor))
            .usingSimpleNumericMock({
                mockSignersCount: 3,
                dataPoints: MOCK_PRICES,
            });
        await wrappedPool.lockDeposit(amount, duration);

        let depositBalanceAfter = await poolContract.balanceOf(depositor.address);
        let lockedBalanceAfter = await poolContract.getLockedBalance(depositor.address);

        expect(fromWei(depositBalanceBefore)).to.be.closeTo(fromWei(depositBalanceAfter), 0.0001);
        expect(fromWei(lockedBalanceAfter.sub(lockedBalanceBefore))).to.be.closeTo(fromWei(amount), 1e-6);
    }


    it("depositor should deposit 10 MOCK_TOKENs", async () => {
        await depositToPool(depositor, toWei("10"));

        await checkDepositorPairsCount(depositor, 0, 0);
        await checkDepositsDollarValue(depositor, 0, 10);
        expect((await vPrimeControllerContract.getDepositorVPrimeRateAndMaxCap(depositor.address)).map(bn => bn.toString())).to.deep.equal(["0" ,"0", "0"]);
        await checkDepositorSPrimeDollarValue(depositor, 0);
    });

    it("depositor should deposit $2 worth of sPRIME", async () => {
        await increaseSPrimeBalanceAndPerformChecks(depositor, toWei("1"));
        await checkDepositorPairsCount(depositor, 0, 1);
        await checkDepositsDollarValue(depositor, 0, 10);
        await checkSPrimeDollarValue(depositor, 2);

        const [rate, maxCap] = await vPrimeControllerContract.getDepositorVPrimeRateAndMaxCap(depositor.address);
        const newRate = (15-0) * 1e18 / 365 / 24 / 60 / 60 / 3;
        expect(fromWei(maxCap)).to.be.closeTo(15, 1e-6);
        expect(rate).to.be.closeTo(newRate.toFixed(0), 1000);
    });

    // check vPrime balance after 1 year
    it("should check vPrime balance after 1 year", async () => {
        const oneYear = 365 * 24 * 60 * 60;
        await compareVPrimeBalanceAfterSomeTime(depositor, oneYear, 5);
    });

    // should deposit another 10 MOCK_TOKENs
    it("depositor should deposit another 10 MOCK_TOKENs", async () => {
        await depositToPool(depositor, toWei("10"));
        await checkDepositorPairsCount(depositor, 0, 2);
        await checkDepositsDollarValue(depositor, 0, 20.5);

        await checkDepositorSPrimeDollarValue(depositor, 2);
        const [rate, maxCap] = await vPrimeControllerContract.getDepositorVPrimeRateAndMaxCap(depositor.address);
        expect(fromWei(maxCap)).to.be.closeTo(30, 1e-6);
        const newRate = (30 - 5) * 1e18 / 365 / 24 / 60 / 60 / 3;
        expect(rate).to.be.closeTo(newRate.toFixed(0), 100000);
    });

    // Should check vPrime balance after next 2 years
    it("should check vPrime balance after next 2 years", async () => {
        const twoYears = 2 * 365 * 24 * 60 * 60;
        await compareVPrimeBalanceAfterSomeTime(depositor, twoYears, 25 / 3 * 2);
    });

    // Should withdraw 10 MOCK_TOKENs and the vPrime balance should decrease to 15 over 14 days
    it("should withdraw 10 MOCK_TOKENs and the vPrime balance should decrease to 15 over 14 days", async () => {
        await withdrawFromPool(depositor, toWei("10"));
        let vPrimeBalanceBefore = fromWei(await vPrimeContract.balanceOf(depositor.address));

        expect((await vPrimeControllerContract.getDepositorVPrimePairsCount(depositor.address)).map(bn => bn.toString())).to.deep.equal(["0" ,"1"]);
        const [rate, maxCap] = await vPrimeControllerContract.getDepositorVPrimeRateAndMaxCap(depositor.address);
        expect(fromWei(maxCap)).to.be.closeTo(15, 1e-6);
        let votesDiff = (15 - 21.666667);
        let secondsIn14Days = 14 * 24 * 60 * 60;
        const newRate =  toWei((votesDiff).toString()).div(secondsIn14Days);
        expect(rate).to.be.closeTo(newRate, 300000);

        const oneDay = 24 * 60 * 60;
        await compareVPrimeBalanceAfterSomeTime(depositor, oneDay * 14, 15 - vPrimeBalanceBefore);

    });

    // should withdraw 2 sPrime and the vPrime balance should decrease to 7.5 over 7 days
    it("should withdraw $2 sPrime and the vPrime balance should decrease to 7.5 over 7 days", async () => {
        expect(fromWei(await vPrimeContract.balanceOf(depositor.address))).to.be.closeTo(15, 1e-6);
        await sPrimeContract.decreaseBalance(depositor.address, toWei("1"));
        expect(fromWei(await sPrimeContract.balanceOf(depositor.address))).to.equal(0);
        expect(fromWei(await vPrimeContract.balanceOf(depositor.address))).to.be.closeTo(15, 1e-6);

        expect((await vPrimeControllerContract.getDepositorVPrimePairsCount(depositor.address)).map(bn => bn.toString())).to.deep.equal(["0" ,"0"]);
        expect((await vPrimeControllerContract.getUserDepositDollarValueAcrossWhiteListedPoolsVestedAndNonVested(depositor.address)).map(bn => fromWei(bn))).to.deep.closeTo([0 , 12.574], 1e-4);
        expect(fromWei(await vPrimeControllerContract.getUserSPrimeDollarValue(depositor.address))).to.equal(0);
        const [rate, maxCap] = await vPrimeControllerContract.getDepositorVPrimeRateAndMaxCap(depositor.address);
        expect(fromWei(maxCap)).to.be.closeTo(0, 1e-6);
        let votesDiff = (0 - 15);
        let secondsIn14Days = 14 * 24 * 60 * 60;
        const newRate =  toWei((votesDiff).toString()).div(secondsIn14Days);

        expect(rate).to.be.closeTo(newRate, 100000);

        const oneDay = 24 * 60 * 60;
        await time.increase(oneDay * 7);
        expect(fromWei(await vPrimeContract.balanceOf(depositor.address))).to.be.closeTo(7.5, 1e-4);
    });

    // vPrimeBalance should go down to 0 over next 7 days
    it("vPrimeBalance should go down to 0 over next 7 days", async () => {
        expect(fromWei(await vPrimeContract.balanceOf(depositor.address))).to.be.closeTo(7.5, 1e-4);
        const oneDay = 24 * 60 * 60;
        await time.increase(oneDay * 7 + 100); // 100 seconds to make sure it's more than 7 days
        expect(fromWei(await vPrimeContract.balanceOf(depositor.address))).to.be.equal(0);
    });

    // should increase sPrime balance to 1, lock 10 MCK tokens and 1 sPrime for 3 years and vPrime balance should immediately be equal to 15
    it("should increase sPrime balance to 1, lock 10 MCK tokens and 1 sPrime for 3 years and vPrime balance should immediately be equal to 15", async () => {
        // increase sPrime balance to 1
        await increaseSPrimeBalanceAndPerformChecks(depositor, toWei("1"));

        await lockDepositAndPerformChecks(depositor, toWei("10"), 3 * 365 * 24 * 60 * 60);
        await checkDepositsDollarValue(depositor, 10, 2.598139120933559);

        await lockSPrimeAndPerformChecks(depositor, toWei("1"), 3 * 365 * 24 * 60 * 60);
        await checkDepositorPairsCount(depositor, 1, 0);

        expect(fromWei(await vPrimeContract.balanceOf(depositor.address))).to.be.closeTo(15, 1e-6);
    });

});