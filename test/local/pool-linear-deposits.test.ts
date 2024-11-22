import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import VariableUtilisationRatesCalculatorArtifact
    from '../../artifacts/contracts/mock/MockVariableUtilisationRatesCalculator.sol/MockVariableUtilisationRatesCalculator.json';
import OpenBorrowersRegistryArtifact
    from '../../artifacts/contracts/mock/OpenBorrowersRegistry.sol/OpenBorrowersRegistry.json';
import LinearIndexArtifact from '../../artifacts/contracts/LinearIndex.sol/LinearIndex.json';
import MockTokenArtifact from "../../artifacts/contracts/mock/MockToken.sol/MockToken.json";
import PoolArtifact from '../../artifacts/contracts/Pool.sol/Pool.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {customError, fromWei, getFixedGasSigners, time, toWei} from "../_helpers";
import {deployMockContract} from '@ethereum-waffle/mock-contract';
import {LinearIndex, MockToken, OpenBorrowersRegistry, Pool} from "../../typechain";
import {Contract} from "ethers";

chai.use(solidity);
const ZERO = ethers.constants.AddressZero;

const {deployContract} = waffle;

describe('Pool with variable utilisation interest rates', () => {
    let sut: Pool,
        owner: SignerWithAddress,
        depositor: SignerWithAddress,
        depositor2: SignerWithAddress,
        depositor3: SignerWithAddress,
        mockToken: Contract,
        mockVariableUtilisationRatesCalculator;

    beforeEach(async () => {
        [owner, depositor, depositor2, depositor3] = await getFixedGasSigners(10000000);
        mockVariableUtilisationRatesCalculator = await deployMockContract(owner, VariableUtilisationRatesCalculatorArtifact.abi);
        await mockVariableUtilisationRatesCalculator.mock.calculateDepositRate.returns(toWei("0.05"));
        await mockVariableUtilisationRatesCalculator.mock.calculateBorrowingRate.returns(toWei("0.05"));

        sut = (await deployContract(owner, PoolArtifact)) as Pool;

        mockToken = (await deployContract(owner, MockTokenArtifact, [[depositor.address, depositor2.address, depositor3.address]])) as MockToken;

        const borrowersRegistry = (await deployContract(owner, OpenBorrowersRegistryArtifact)) as OpenBorrowersRegistry;
        const depositIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
        await depositIndex.initialize(sut.address);
        const borrowingIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
        await borrowingIndex.initialize(sut.address);

        await sut.initialize(
            mockVariableUtilisationRatesCalculator.address,
            borrowersRegistry.address,
            depositIndex.address,
            borrowingIndex.address,
            mockToken.address,
            ZERO,
            0
        );
    });

    it("should deposit requested value", async () => {
        await mockToken.connect(depositor).approve(sut.address, toWei("1.0"));
        await sut.connect(depositor).deposit(toWei("1.0"));
        expect(await mockToken.balanceOf(sut.address)).to.equal(toWei("1"));

        const currentDeposits = await sut.balanceOf(depositor.address);
        expect(fromWei(currentDeposits)).to.equal(1);
    });

    it("should deposit on proper address", async () => {
        await mockToken.connect(depositor).approve(sut.address, toWei("3.0"));
        await sut.connect(depositor).deposit(toWei("3.0"));

        await mockToken.connect(depositor2).approve(sut.address, toWei("5.0"));
        await sut.connect(depositor2).deposit(toWei("5.0"));

        await mockToken.connect(depositor3).approve(sut.address, toWei("7.0"));
        await sut.connect(depositor3).deposit(toWei("7.0"));

        expect(fromWei(await sut.balanceOf(depositor.address))).to.be.closeTo(3.00000, 0.00001);
        expect(fromWei(await sut.balanceOf(depositor2.address))).to.be.closeTo(5.00000, 0.00001);
        expect(fromWei(await sut.balanceOf(depositor3.address))).to.be.closeTo(7.00000, 0.00001);
    });

    describe("should increase deposit value as time goes", () => {

        it("should hold for one year", async function () {
            await mockToken.connect(depositor).approve(sut.address, toWei("1.0"));
            await sut.connect(depositor).deposit(toWei("1.0"));

            await time.increase(time.duration.years(1));

            const oneYearDeposit = await sut.balanceOf(depositor.address);
            expect(fromWei(oneYearDeposit)).to.be.closeTo(1.05, 0.000001);
        });

        it("should hold for two years", async function () {
            await mockToken.connect(depositor).approve(sut.address, toWei("1.0"));
            await sut.connect(depositor).deposit(toWei("1.0"));

            await time.increase(time.duration.years(2));

            const twoYearsDeposit = await sut.balanceOf(depositor.address);
            expect(fromWei(twoYearsDeposit)).to.be.closeTo(1.10, 0.000001);
        });

        it("should hold for three years", async function () {
            await mockToken.connect(depositor).approve(sut.address, toWei("1.0"));
            await sut.connect(depositor).deposit(toWei("1.0"));

            await time.increase(time.duration.years(3));

            const threeYearsDeposit = await sut.balanceOf(depositor.address);
            expect(fromWei(threeYearsDeposit)).to.be.closeTo(1.15, 0.000001);
        });

        it("should hold for five years", async function () {
            await mockToken.connect(depositor).approve(sut.address, toWei("1.0"));
            await sut.connect(depositor).deposit(toWei("1.0"));

            await time.increase(time.duration.years(5));

            const fiveYearsDeposit = await sut.balanceOf(depositor.address);
            expect(fromWei(fiveYearsDeposit)).to.be.closeTo(1.25, 0.000001);
        });

        it("should hold for ten years", async function () {
            await mockToken.connect(depositor).approve(sut.address, toWei("1.0"));
            await sut.connect(depositor).deposit(toWei("1.0"));

            await time.increase(time.duration.years(10));
            const tenYearsDeposit = await sut.balanceOf(depositor.address);
            expect(fromWei(tenYearsDeposit)).to.be.closeTo(1.50, 0.000001);
        });

        describe("after half year delay", () => {
            it("should increase deposit after half year", async function () {
                await mockToken.connect(depositor).approve(sut.address, toWei("1.0"));
                await sut.connect(depositor).deposit(toWei("1.0"));

                expect(await mockToken.balanceOf(sut.address)).to.equal(toWei("1"));

                await time.increase(time.duration.years(0.5));
                const halfYearDeposit = await sut.balanceOf(depositor.address);
                expect(fromWei(halfYearDeposit)).to.be.closeTo(1.025, 0.000001);
            });
        });

        describe("after 1 year delay", () => {
            beforeEach(async () => {
                await time.increase(time.duration.years(1));
            });

            it("should not change deposit value", async function () {
                const oneYearDeposit = await sut.balanceOf(depositor.address);
                expect(fromWei(oneYearDeposit)).to.be.closeTo(0, 0.000001);
            });

            it("should increase deposit after another year", async function () {
                await mockToken.connect(depositor).approve(sut.address, toWei("1.0"));
                await sut.connect(depositor).deposit(toWei("1.0"));

                expect(await mockToken.balanceOf(sut.address)).to.equal(toWei("1"));

                await time.increase(time.duration.years(1));
                const oneYearDeposit = await sut.balanceOf(depositor.address);
                expect(fromWei(oneYearDeposit)).to.be.closeTo(1.05, 0.000001);
            });
        });

    });

    describe('should properly make multiple deposits', () => {
        beforeEach(async () => {
            await mockToken.connect(depositor).approve(sut.address, toWei("1.0"));
            await sut.connect(depositor).deposit(toWei("1.0"));

            await time.increase(time.duration.years(1));
            expect(fromWei(await sut.balanceOf(depositor.address))).to.be.closeTo(1.05, 0.000001);
        });

        it("should properly make another deposits", async () => {
            await mockToken.connect(depositor).approve(sut.address, toWei("1.0"));
            await sut.connect(depositor).deposit(toWei("1.0"));

            expect(fromWei(await sut.balanceOf(depositor.address))).to.be.closeTo(2.05, 0.000001);

            await mockToken.connect(depositor).approve(sut.address, toWei("2.0"));
            await sut.connect(depositor).deposit(toWei("2.0"));

            expect(fromWei(await sut.balanceOf(depositor.address))).to.be.closeTo(4.05, 0.000001);

            await mockToken.connect(depositor).approve(sut.address, toWei("5.7"));
            await sut.connect(depositor).deposit(toWei("5.7"));
            expect(fromWei(await sut.balanceOf(depositor.address))).to.be.closeTo(9.75, 0.000001);

            await mockToken.connect(depositor).approve(sut.address, toWei("3.00083"));
            await sut.connect(depositor).deposit(toWei("3.00083"));

            expect(fromWei(await sut.balanceOf(depositor.address))).to.be.closeTo(12.75083, 0.000001);
        });

        it("should properly make another deposits with different time gaps", async () => {
            await mockToken.connect(depositor).approve(sut.address, toWei("1.0"));
            await sut.connect(depositor).deposit(toWei("1.0"));

            await time.increase(time.duration.years(0.5));
            expect(fromWei(await sut.balanceOf(depositor.address))).to.be.closeTo(2.10125, 0.000001);

            await mockToken.connect(depositor).approve(sut.address, toWei("2.0"));
            await sut.connect(depositor).deposit(toWei("2.0"));

            await time.increase(time.duration.years(3));
            //2.10125 * 1.15(5% * 3 years)
            expect(fromWei(await sut.balanceOf(depositor.address))).to.be.closeTo(4.7164375, 0.000001);

            await mockToken.connect(depositor).approve(sut.address, toWei("5.7"));
            await sut.connect(depositor).deposit(toWei("5.7"));

            await time.increase(time.duration.months(3));
            //(4.7164375 + 5.7) * 1.25890410958 (90/365 * 5%)
            expect(fromWei(await sut.balanceOf(depositor.address))).to.be.closeTo(10.5448593322, 0.000001);

            await mockToken.connect(depositor).approve(sut.address, toWei("3.00083"));
            await sut.connect(depositor).deposit(toWei("3.00083"));

            await time.increase(time.duration.years(1));
            //(10.5448593322 + 3.00083) * 1.05
            expect(fromWei(await sut.balanceOf(depositor.address))).to.be.closeTo(14.2229737988, 0.000001);
        });

    });

    describe("withdraw function", () => {
        it("should not allow to withdraw when depositor2 has no deposit", async () => {
            await mockToken.connect(depositor2).approve(sut.address, toWei("0.5"));
            await sut.connect(depositor2).deposit(toWei("0.5"));

            await expect(sut.connect(depositor3).withdraw(toWei("0.5")))
                .to.be.revertedWith(customError("BurnAmountExceedsBalance"));
            await expect(sut.connect(depositor3).withdraw(toWei("0.000000001")))
                .to.be.revertedWith(customError("BurnAmountExceedsBalance"));
        });

        it("should not allow to withdraw more than already on deposit", async () => {
            await mockToken.connect(depositor2).approve(sut.address, toWei("1.0"));
            await sut.connect(depositor2).deposit(toWei("1.0"));

            await mockToken.connect(depositor3).approve(sut.address, toWei("1.0"));
            await sut.connect(depositor3).deposit(toWei("1.0"));

            await expect(sut.connect(depositor2).withdraw(toWei("1.0001")))
                .to.be.revertedWith(customError("BurnAmountExceedsBalance"));
        });

        it("should not allow to withdraw more than already on deposit after accumulating interest", async () => {
            await mockToken.connect(depositor2).approve(sut.address, toWei("1.0"));
            await sut.connect(depositor2).deposit(toWei("1.0"));

            await mockToken.connect(depositor3).approve(sut.address, toWei("1.0"));
            await sut.connect(depositor3).deposit(toWei("1.0"));
            await time.increase(time.duration.years(1));

            expect(fromWei(await sut.connect(depositor2).balanceOf(depositor2.address))).to.be.closeTo(1.05, 0.00001);
            await expect(sut.connect(depositor2).withdraw(toWei("1.0513")))
                .to.be.revertedWith(customError("BurnAmountExceedsBalance"));
        });

        it("should allow to withdraw all deposit", async () => {
            await mockToken.connect(depositor).approve(sut.address, toWei("1.0"));
            await sut.connect(depositor).deposit(toWei("1.0"));

            await sut.connect(depositor).withdraw(toWei("1.0"))

            expect(fromWei(await sut.balanceOf(depositor.address))).to.be.closeTo(0, 0.000001);
        });

        it("should allow to withdraw all deposit after multiple deposits", async () => {
            await mockToken.connect(depositor).approve(sut.address, toWei("1.0"));
            await sut.connect(depositor).deposit(toWei("1.0"));

            await mockToken.connect(depositor).approve(sut.address, toWei("3.5"));
            await sut.connect(depositor).deposit(toWei("2.5"));

            await mockToken.connect(depositor).approve(sut.address, toWei("3.7"));
            await sut.connect(depositor).deposit(toWei("3.7"));

            expect(fromWei(await sut.balanceOf(depositor.address))).to.be.closeTo(7.2000, 0.000001);

            await sut.connect(depositor).withdraw(toWei("7.2000"));
            expect(fromWei(await sut.balanceOf(depositor.address))).to.be.closeTo(0, 0.000001);
        });

        it("should allow to withdraw part of the deposit", async () => {
            await mockToken.connect(depositor).approve(sut.address, toWei("1.0"));
            await sut.connect(depositor).deposit(toWei("1.0"));

            await time.increase(time.duration.years(1));
            await sut.connect(depositor).withdraw(toWei("0.2000"));
            expect(fromWei(await sut.balanceOf(depositor.address))).to.be.closeTo(0.85, 0.00001);

            await mockToken.connect(depositor).approve(sut.address, toWei("2.5"));
            await sut.connect(depositor).deposit(toWei("2.5"));

            await time.increase(time.duration.years(3));
            await sut.connect(depositor).withdraw(toWei("1.3000"));
            expect(fromWei(await sut.balanceOf(depositor.address))).to.be.closeTo(2.5525, 0.00001);

            await mockToken.connect(depositor).approve(sut.address, toWei("3.7"));
            await sut.connect(depositor).deposit(toWei("3.7"));
            await time.increase(time.duration.years(3));
            await sut.connect(depositor).withdraw(toWei("2.1400"));
            expect(fromWei(await sut.balanceOf(depositor.address))).to.be.closeTo(5.050375, 0.000001);
        });

        it("should withdraw deposit from proper address", async () => {
            await mockToken.connect(depositor).approve(sut.address, toWei("3.0"));
            await sut.connect(depositor).deposit(toWei("3.0"));

            await mockToken.connect(depositor2).approve(sut.address, toWei("5.0"));
            await sut.connect(depositor2).deposit(toWei("5.0"));

            expect(fromWei(await sut.balanceOf(depositor.address))).to.be.closeTo(3.00000, 0.00001);
            expect(fromWei(await sut.balanceOf(depositor2.address))).to.be.closeTo(5.00000, 0.00001);

            await sut.connect(depositor).withdraw(toWei("1.000"));
            expect(fromWei(await sut.balanceOf(depositor.address))).to.be.closeTo(2.00000, 0.00001);

            await sut.connect(depositor2).withdraw(toWei("2.000"));
            expect(fromWei(await sut.balanceOf(depositor2.address))).to.be.closeTo(3.00000, 0.00001);
        });
    });
});

