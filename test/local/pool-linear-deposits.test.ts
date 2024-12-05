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

        expect(fromWei(await sut.balanceOf(depositor.address))).to.be.closeTo(3.00000, 0.001);
        expect(fromWei(await sut.balanceOf(depositor2.address))).to.be.closeTo(5.00000, 0.001);
        expect(fromWei(await sut.balanceOf(depositor3.address))).to.be.closeTo(7.00000, 0.001);
    });

    // describe("should increase deposit value as time goes", () => {
    //     it("should hold for one year", async function () {
    //         await mockToken.connect(depositor).approve(sut.address, toWei("1.0"));
    //         await sut.connect(depositor).deposit(toWei("1.0"));
    //
    //         await time.increase(time.duration.years(1));
    //
    //         const oneYearDeposit = await sut.balanceOf(depositor.address);
    //         expect(fromWei(oneYearDeposit)).to.be.closeTo(1.05, 0.000001);
    //     });
    //
    //     it("should hold for two years", async function () {
    //         await mockToken.connect(depositor).approve(sut.address, toWei("1.0"));
    //         await sut.connect(depositor).deposit(toWei("1.0"));
    //
    //         await time.increase(time.duration.years(2));
    //
    //         const twoYearsDeposit = await sut.balanceOf(depositor.address);
    //         expect(fromWei(twoYearsDeposit)).to.be.closeTo(1.10, 0.000001);
    //     });
    //
    //     it("should hold for three years", async function () {
    //         await mockToken.connect(depositor).approve(sut.address, toWei("1.0"));
    //         await sut.connect(depositor).deposit(toWei("1.0"));
    //
    //         await time.increase(time.duration.years(3));
    //
    //         const threeYearsDeposit = await sut.balanceOf(depositor.address);
    //         expect(fromWei(threeYearsDeposit)).to.be.closeTo(1.15, 0.000001);
    //     });
    //
    //     it("should hold for five years", async function () {
    //         await mockToken.connect(depositor).approve(sut.address, toWei("1.0"));
    //         await sut.connect(depositor).deposit(toWei("1.0"));
    //
    //         await time.increase(time.duration.years(5));
    //
    //         const fiveYearsDeposit = await sut.balanceOf(depositor.address);
    //         expect(fromWei(fiveYearsDeposit)).to.be.closeTo(1.25, 0.000001);
    //     });
    //
    //     it("should hold for ten years", async function () {
    //         await mockToken.connect(depositor).approve(sut.address, toWei("1.0"));
    //         await sut.connect(depositor).deposit(toWei("1.0"));
    //
    //         await time.increase(time.duration.years(10));
    //         const tenYearsDeposit = await sut.balanceOf(depositor.address);
    //         expect(fromWei(tenYearsDeposit)).to.be.closeTo(1.50, 0.000001);
    //     });
    //
    //     describe("after half year delay", () => {
    //         it("should increase deposit after half year", async function () {
    //             await mockToken.connect(depositor).approve(sut.address, toWei("1.0"));
    //             await sut.connect(depositor).deposit(toWei("1.0"));
    //
    //             expect(await mockToken.balanceOf(sut.address)).to.equal(toWei("1"));
    //
    //             await time.increase(time.duration.years(0.5));
    //             const halfYearDeposit = await sut.balanceOf(depositor.address);
    //             expect(fromWei(halfYearDeposit)).to.be.closeTo(1.025, 0.000001);
    //         });
    //     });
    //
    //     describe("after 1 year delay", () => {
    //         beforeEach(async () => {
    //             await time.increase(time.duration.years(1));
    //         });
    //
    //         it("should not change deposit value", async function () {
    //             const oneYearDeposit = await sut.balanceOf(depositor.address);
    //             expect(fromWei(oneYearDeposit)).to.be.closeTo(0, 0.000001);
    //         });
    //
    //         it("should increase deposit after another year", async function () {
    //             await mockToken.connect(depositor).approve(sut.address, toWei("1.0"));
    //             await sut.connect(depositor).deposit(toWei("1.0"));
    //
    //             expect(await mockToken.balanceOf(sut.address)).to.equal(toWei("1"));
    //
    //             await time.increase(time.duration.years(1));
    //             const oneYearDeposit = await sut.balanceOf(depositor.address);
    //             expect(fromWei(oneYearDeposit)).to.be.closeTo(1.05, 0.000001);
    //         });
    //     });
    // });
    //
    // describe('should properly make multiple deposits', () => {
    //     beforeEach(async () => {
    //         await mockToken.connect(depositor).approve(sut.address, toWei("1.0"));
    //         await sut.connect(depositor).deposit(toWei("1.0"));
    //
    //         await time.increase(time.duration.years(1));
    //         expect(fromWei(await sut.balanceOf(depositor.address))).to.be.closeTo(1.05, 0.000001);
    //     });
    //
    //     it("should properly make another deposits", async () => {
    //         await mockToken.connect(depositor).approve(sut.address, toWei("1.0"));
    //         await sut.connect(depositor).deposit(toWei("1.0"));
    //
    //         expect(fromWei(await sut.balanceOf(depositor.address))).to.be.closeTo(2.05, 0.000001);
    //
    //         await mockToken.connect(depositor).approve(sut.address, toWei("2.0"));
    //         await sut.connect(depositor).deposit(toWei("2.0"));
    //
    //         expect(fromWei(await sut.balanceOf(depositor.address))).to.be.closeTo(4.05, 0.000001);
    //
    //         await mockToken.connect(depositor).approve(sut.address, toWei("5.7"));
    //         await sut.connect(depositor).deposit(toWei("5.7"));
    //         expect(fromWei(await sut.balanceOf(depositor.address))).to.be.closeTo(9.75, 0.000001);
    //
    //         await mockToken.connect(depositor).approve(sut.address, toWei("3.00083"));
    //         await sut.connect(depositor).deposit(toWei("3.00083"));
    //
    //         expect(fromWei(await sut.balanceOf(depositor.address))).to.be.closeTo(12.75083, 0.000001);
    //     });
    //
    //     it("should properly make another deposits with different time gaps", async () => {
    //         await mockToken.connect(depositor).approve(sut.address, toWei("1.0"));
    //         await sut.connect(depositor).deposit(toWei("1.0"));
    //
    //         await time.increase(time.duration.years(0.5));
    //         expect(fromWei(await sut.balanceOf(depositor.address))).to.be.closeTo(2.10125, 0.000001);
    //
    //         await mockToken.connect(depositor).approve(sut.address, toWei("2.0"));
    //         await sut.connect(depositor).deposit(toWei("2.0"));
    //
    //         await time.increase(time.duration.years(3));
    //         //2.10125 * 1.15(5% * 3 years)
    //         expect(fromWei(await sut.balanceOf(depositor.address))).to.be.closeTo(4.7164375, 0.000001);
    //
    //         await mockToken.connect(depositor).approve(sut.address, toWei("5.7"));
    //         await sut.connect(depositor).deposit(toWei("5.7"));
    //
    //         await time.increase(time.duration.months(3));
    //         //(4.7164375 + 5.7) * 1.25890410958 (90/365 * 5%)
    //         expect(fromWei(await sut.balanceOf(depositor.address))).to.be.closeTo(10.5448593322, 0.000001);
    //
    //         await mockToken.connect(depositor).approve(sut.address, toWei("3.00083"));
    //         await sut.connect(depositor).deposit(toWei("3.00083"));
    //
    //         await time.increase(time.duration.years(1));
    //         //(10.5448593322 + 3.00083) * 1.05
    //         expect(fromWei(await sut.balanceOf(depositor.address))).to.be.closeTo(14.2229737988, 0.000001);
    //     });
    // });
    //
    // describe("withdrawal intents and withdrawals", () => {
    //     beforeEach(async () => {
    //         // Setup initial deposits for testing
    //         await mockToken.connect(depositor).approve(sut.address, toWei("3.0"));
    //         await sut.connect(depositor).deposit(toWei("3.0"));
    //
    //         await mockToken.connect(depositor2).approve(sut.address, toWei("5.0"));
    //         await sut.connect(depositor2).deposit(toWei("5.0"));
    //     });
    //
    //     describe("createWithdrawalIntent", () => {
    //         it("should create withdrawal intent successfully", async () => {
    //             await sut.connect(depositor).createWithdrawalIntent(toWei("1.0"));
    //
    //             const intents = await sut.getUserIntents(depositor.address);
    //             expect(intents.length).to.equal(1);
    //             expect(intents[0].amount).to.equal(toWei("1.0"));
    //             expect(intents[0].isPending).to.be.true;
    //             expect(intents[0].isActionable).to.be.false;
    //             expect(intents[0].isExpired).to.be.false;
    //         });
    //
    //         it("should not allow creating intent for more than available balance", async () => {
    //             await expect(
    //                 sut.connect(depositor).createWithdrawalIntent(toWei("3.1"))
    //             ).to.be.revertedWith("InsufficientAvailableBalance");
    //         });
    //
    //         it("should not allow creating intent for zero amount", async () => {
    //             await expect(
    //                 sut.connect(depositor).createWithdrawalIntent(toWei("0"))
    //             ).to.be.revertedWith("Amount must be greater than zero");
    //         });
    //
    //         it("should not allow unauthorized address to create intent", async () => {
    //             await expect(
    //                 sut.connect(depositor3).createWithdrawalIntent(toWei("1.0"))
    //             ).to.be.revertedWith("InsufficientAvailableBalance");
    //         });
    //     });
    //
    //     describe("withdraw with intents", () => {
    //         it("should withdraw using a single intent after waiting period", async () => {
    //             // Create intent
    //             await sut.connect(depositor).createWithdrawalIntent(toWei("1.0"));
    //
    //             // Wait for 24 hours
    //             await time.increase(time.duration.hours(24));
    //
    //             // Withdraw using the intent
    //             await sut.connect(depositor).withdraw(toWei("1.0"), [0]);
    //
    //             expect(fromWei(await sut.balanceOf(depositor.address))).to.be.closeTo(2.0, 0.001);
    //
    //             // Verify intent was consumed
    //             const intents = await sut.getUserIntents(depositor.address);
    //             expect(intents.length).to.equal(0);
    //         });
    //
    //         it("should fail to withdraw before intent is actionable", async () => {
    //             await sut.connect(depositor).createWithdrawalIntent(toWei("1.0"));
    //
    //             // Try to withdraw immediately
    //             await expect(
    //                 sut.connect(depositor).withdraw(toWei("1.0"), [0])
    //             ).to.be.revertedWith("Withdrawal intent not matured");
    //         });
    //
    //         it("should fail to withdraw after intent expires", async () => {
    //             await sut.connect(depositor).createWithdrawalIntent(toWei("1.0"));
    //
    //             // Wait for 49 hours (24 + 24 + 1)
    //             await time.increase(time.duration.hours(49));
    //
    //             await expect(
    //                 sut.connect(depositor).withdraw(toWei("1.0"), [0])
    //             ).to.be.revertedWith("Withdrawal intent expired");
    //         });
    //
    //         it("should handle multiple intents in single withdrawal", async () => {
    //             // Create two intents
    //             await sut.connect(depositor).createWithdrawalIntent(toWei("1.0"));
    //             await sut.connect(depositor).createWithdrawalIntent(toWei("0.5"));
    //
    //             // Wait for 24 hours
    //             await time.increase(time.duration.hours(24));
    //
    //             // Withdraw using both intents
    //             await sut.connect(depositor).withdraw(toWei("1.5"), [0, 1]);
    //
    //             expect(fromWei(await sut.balanceOf(depositor.address))).to.be.closeTo(1.5, 0.001);
    //
    //             // Verify both intents were consumed
    //             const intents = await sut.getUserIntents(depositor.address);
    //             expect(intents.length).to.equal(0);
    //         });
    //
    //         it("should fail when total intent amount doesn't match withdrawal amount", async () => {
    //             await sut.connect(depositor).createWithdrawalIntent(toWei("1.0"));
    //             await sut.connect(depositor).createWithdrawalIntent(toWei("0.5"));
    //
    //             await time.increase(time.duration.hours(24));
    //
    //             await expect(
    //                 sut.connect(depositor).withdraw(toWei("2.0"), [0, 1])
    //             ).to.be.revertedWith("Requested amount exceeds intent amount by more than 1%");
    //         });
    //     });
    //
    //     describe("withdrawal intent cancellation", () => {
    //         it("should allow cancelling a pending intent", async () => {
    //             await sut.connect(depositor).createWithdrawalIntent(toWei("1.0"));
    //             await sut.connect(depositor).cancelWithdrawalIntent(0);
    //
    //             const intents = await sut.getUserIntents(depositor.address);
    //             expect(intents.length).to.equal(0);
    //         });
    //
    //         it("should allow cancelling an actionable intent", async () => {
    //             await sut.connect(depositor).createWithdrawalIntent(toWei("1.0"));
    //
    //             await time.increase(time.duration.hours(24));
    //
    //             await sut.connect(depositor).cancelWithdrawalIntent(0);
    //
    //             const intents = await sut.getUserIntents(depositor.address);
    //             expect(intents.length).to.equal(0);
    //         });
    //
    //         it("should fail to cancel non-existent intent", async () => {
    //             await expect(
    //                 sut.connect(depositor).cancelWithdrawalIntent(0)
    //             ).to.be.revertedWith("Invalid intent index");
    //         });
    //
    //         it("should fail to cancel another user's intent", async () => {
    //             await sut.connect(depositor).createWithdrawalIntent(toWei("1.0"));
    //
    //             await expect(
    //                 sut.connect(depositor2).cancelWithdrawalIntent(0)
    //             ).to.be.revertedWith("Invalid intent index");
    //         });
    //     });
    //
    //     describe("intent management", () => {
    //         it("should clear expired intents automatically on new intent creation", async () => {
    //             // Create first intent
    //             await sut.connect(depositor).createWithdrawalIntent(toWei("1.0"));
    //
    //             // Wait for intent to expire
    //             await time.increase(time.duration.hours(49));
    //
    //             // Create new intent
    //             await sut.connect(depositor).createWithdrawalIntent(toWei("0.5"));
    //
    //             const intents = await sut.getUserIntents(depositor.address);
    //             expect(intents.length).to.equal(1);
    //             expect(fromWei(intents[0].amount)).to.equal(0.5);
    //         });
    //
    //         it("should allow manual clearing of expired intents", async () => {
    //             await sut.connect(depositor).createWithdrawalIntent(toWei("1.0"));
    //
    //             // Wait for intent to expire
    //             await time.increase(time.duration.hours(49));
    //
    //             await sut.connect(depositor).clearExpiredIntents();
    //
    //             const intents = await sut.getUserIntents(depositor.address);
    //             expect(intents.length).to.equal(0);
    //         });
    //
    //         it("should handle multiple expired and valid intents correctly", async () => {
    //             // Create three intents
    //             await sut.connect(depositor).createWithdrawalIntent(toWei("1.0")); // Will expire
    //             await time.increase(time.duration.hours(47));
    //
    //             await sut.connect(depositor).createWithdrawalIntent(toWei("0.5")); // Will be valid but not actionable
    //             await time.increase(time.duration.hours(1));
    //
    //             let intents = await sut.getUserIntents(depositor.address);
    //             expect(intents.length).to.equal(2);
    //             expect(intents[0].isExpired).to.be.true;
    //             expect(intents[0].isActionable).to.be.false;
    //             expect(intents[1].isExpired).to.be.false;
    //             expect(intents[1].isActionable).to.be.false;
    //
    //             await time.increase(time.duration.hours(23));
    //             intents = await sut.getUserIntents(depositor.address);
    //             expect(intents.length).to.equal(2);
    //             expect(intents[0].isExpired).to.be.true;
    //             expect(intents[0].isActionable).to.be.false;
    //             expect(intents[1].isExpired).to.be.false;
    //             expect(intents[1].isActionable).to.be.true;
    //         });
    //     });
    //
    //     describe("interest accrual with intents", () => {
    //         it("should accrue interest correctly while having pending intents", async () => {
    //             await sut.connect(depositor).createWithdrawalIntent(toWei("1.0"));
    //
    //             // Wait for a year
    //             await time.increase(time.duration.years(1));
    //
    //             // Total balance should still accrue interest
    //             expect(fromWei(await sut.balanceOf(depositor.address))).to.be.closeTo(3.15, 0.001);
    //         });
    //
    //         it("should handle interest accrual during intent waiting period", async () => {
    //             await sut.connect(depositor).createWithdrawalIntent(toWei("1.0"));
    //
    //             // Wait for 24 hours
    //             await time.increase(time.duration.hours(24));
    //
    //             // Small amount of interest should have accrued
    //             const balance = fromWei(await sut.balanceOf(depositor.address));
    //             expect(balance).to.be.gt(3.0);
    //
    //             // Withdraw should still work with original intent amount
    //             await sut.connect(depositor).withdraw(toWei("1.0"), [0]);
    //
    //             // Remaining balance should be original + interest - withdrawal
    //             expect(fromWei(await sut.balanceOf(depositor.address))).to.be.gt(2.0);
    //         });
    //     });
    // });

    describe("withdrawal intents and validation", () => {
        beforeEach(async () => {
            // Setup initial deposits for testing
            await mockToken.connect(depositor).approve(sut.address, toWei("3.0"));
            await sut.connect(depositor).deposit(toWei("3.0"));

            // Create multiple intents to test with
            await sut.connect(depositor).createWithdrawalIntent(toWei("0.5")); // index 0
            await sut.connect(depositor).createWithdrawalIntent(toWei("0.5")); // index 1
            await sut.connect(depositor).createWithdrawalIntent(toWei("0.5")); // index 2
            await sut.connect(depositor).createWithdrawalIntent(toWei("0.5")); // index 3

            // Wait for intents to mature
            await time.increase(time.duration.hours(24));
        });

        describe("monotonically increasing index validation", () => {
            it("should succeed with monotonically increasing indices", async () => {
                // Should work with sequential indices
                await sut.connect(depositor).withdraw(toWei("1.0"), [0, 1]);

                // Create new intents for next test
                await sut.connect(depositor).createWithdrawalIntent(toWei("0.5"));
                await sut.connect(depositor).createWithdrawalIntent(toWei("0.4"));
                await sut.connect(depositor).createWithdrawalIntent(toWei("0.1"));
                await time.increase(time.duration.hours(24));

                // Should work with non-sequential but increasing indices
                await sut.connect(depositor).withdraw(toWei("0.6"), [2, 4]);
            });

            it("should fail with decreasing indices", async () => {
                await expect(
                    sut.connect(depositor).withdraw(toWei("1.0"), [1, 0])
                ).to.be.revertedWith("Intent indices must be strictly increasing");
            });

            it("should fail with equal indices", async () => {
                await expect(
                    sut.connect(depositor).withdraw(toWei("1.0"), [1, 1])
                ).to.be.revertedWith("Intent indices must be strictly increasing");
            });

            it("should fail with non-monotonic indices", async () => {
                await expect(
                    sut.connect(depositor).withdraw(toWei("1.5"), [0, 2, 1])
                ).to.be.revertedWith("Intent indices must be strictly increasing");
            });

            it("should handle multiple increasing indices correctly", async () => {
                // Withdraw using four intents with increasing indices
                await sut.connect(depositor).withdraw(toWei("2.0"), [0, 1, 2, 3]);

                // Verify all intents were consumed
                const intents = await sut.getUserIntents(depositor.address);
                expect(intents.length).to.equal(0);
            });

            it("should handle non-sequential but increasing indices", async () => {
                // Use indices with gaps
                await sut.connect(depositor).withdraw(toWei("1.5"), [0, 2, 3]);

                // Verify correct intents remain
                const intents = await sut.getUserIntents(depositor.address);
                expect(intents.length).to.equal(1);
                // Intent at index 1 should be the only one remaining
                expect(fromWei(intents[0].amount)).to.equal(0.5);
            });

            it("should allow withdrawing entire balance including accrued interest", async () => {
                // Initial deposit
                await mockToken.connect(depositor2).approve(sut.address, toWei("10.0"));
                await sut.connect(depositor2).deposit(toWei("10.0"));

                await sut.connect(depositor2).createWithdrawalIntent(toWei("5.0"));
                await sut.connect(depositor2).createWithdrawalIntent(toWei("5.0"));

                await time.increase(time.duration.days(1)); // 1 day for intents to mature

                // Try to withdraw 1% more than intents sum to capture all interest
                const intentSum = toWei("10.0");
                const withdrawAmount = intentSum.mul(101).div(100); // 10.1 ETH

                // Withdraw should succeed and empty the account
                await sut.connect(depositor2).withdraw(withdrawAmount, [0, 1]);

                // Verify balance is now 0
                expect(await sut.balanceOf(depositor2.address)).to.equal(0);
            });

            describe("edge cases", () => {
                it("should handle single intent withdrawal", async () => {
                    // Single intent should always work (no monotonic check needed)
                    await sut.connect(depositor).withdraw(toWei("0.5"), [0]);

                    const intents = await sut.getUserIntents(depositor.address);
                    expect(intents.length).to.equal(3);
                });

                it("should validate array bounds even with valid monotonic indices", async () => {
                    // Try to use an index beyond array bounds
                    await expect(
                        sut.connect(depositor).withdraw(toWei("1.0"), [2, 5])
                    ).to.be.revertedWith("Invalid intent index");
                });

                it("should fail when mixing valid monotonic indices with expired intents", async () => {
                    // Wait for intents to expire
                    await time.increase(time.duration.hours(25));

                    await expect(
                        sut.connect(depositor).withdraw(toWei("1.0"), [0, 1])
                    ).to.be.revertedWith("Withdrawal intent expired");
                });

                it("should maintain correct state after failed monotonic validation", async () => {
                    // Try invalid withdrawal
                    await expect(
                        sut.connect(depositor).withdraw(toWei("1.0"), [1, 0])
                    ).to.be.revertedWith("Intent indices must be strictly increasing");

                    // Verify all intents still exist
                    const intents = await sut.getUserIntents(depositor.address);
                    expect(intents.length).to.equal(4);

                    // Verify can still withdraw with valid indices
                    await sut.connect(depositor).withdraw(toWei("1.0"), [0, 1]);

                    const remainingIntents = await sut.getUserIntents(depositor.address);
                    expect(remainingIntents.length).to.equal(2);
                });
            });
        });
    });
});