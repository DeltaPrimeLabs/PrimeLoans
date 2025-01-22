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