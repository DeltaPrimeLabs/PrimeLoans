import {fromWei} from "../_helpers";

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RtknToPrimeConverter Contract", function () {
    let owner, addr1, addr2, addr3, addr4, addrs;
    let rtknToPrimeConverter;
    let rtkn;
    const rRTKNMaxCap = ethers.utils.parseEther("1000"); // Max cap in rTKNs

    beforeEach(async function () {
        // Get signers
        [owner, addr1, addr2, addr3, addr4, ...addrs] = await ethers.getSigners();

        // Deploy a mock ERC20 token to act as rTKN
        const RTKNFactory = await ethers.getContractFactory("ERC20Mock");
        rtkn = await RTKNFactory.deploy("Reward Token", "rTKN", owner.address, ethers.utils.parseEther("100000"));
        await rtkn.deployed();

        // Deploy the RtknToPrimeConverter contract
        const RtknToPrimeConverterFactory = await ethers.getContractFactory("RtknToPrimeConverter");
        rtknToPrimeConverter = await RtknToPrimeConverterFactory.deploy();
        await rtknToPrimeConverter.deployed();
        await rtknToPrimeConverter.initialize(rtkn.address, rRTKNMaxCap, owner.address);

        // Retrieve the CONVERSION_RATIO from the contract
        const CONVERSION_RATIO = await rtknToPrimeConverter.CONVERSION_RATIO();

        // Distribute rTKN to test accounts
        const distributeAmount = ethers.utils.parseEther("20000");
        await rtkn.transfer(addr1.address, distributeAmount);
        await rtkn.transfer(addr2.address, distributeAmount);
        await rtkn.transfer(addr3.address, distributeAmount);
        await rtkn.transfer(addr4.address, distributeAmount);
    });

    describe("Deployment", function () {
        it("Should set the correct initial values", async function () {
            expect(await rtknToPrimeConverter.rTKN()).to.equal(rtkn.address);
            expect(await rtknToPrimeConverter.rRTKNMaxCap()).to.equal(rRTKNMaxCap);
            expect(await rtknToPrimeConverter.currentPhase()).to.equal(0); // Phase1

            // Check that CONVERSION_RATIO is set correctly (assuming it's set within the contract)
            const CONVERSION_RATIO = await rtknToPrimeConverter.CONVERSION_RATIO();
            expect(ethers.BigNumber.isBigNumber(CONVERSION_RATIO)).to.be.true;
        });
    });

    describe("Max Cap Management", function () {
        it("Should allow setting max cap initially", async function () {
            const newMaxCap = ethers.utils.parseEther("2000");
            await expect(rtknToPrimeConverter.connect(owner).setRTKNMaxCap(newMaxCap))
                .to.emit(rtknToPrimeConverter, "MaxCapSet")
                .withArgs(rRTKNMaxCap, newMaxCap);

            expect(await rtknToPrimeConverter.rRTKNMaxCap()).to.equal(newMaxCap);
        });

        it("Should allow setting max cap after pledges in Phase 1", async function () {
            // Make some pledges first
            const pledgeAmount = ethers.utils.parseEther("500");
            await rtkn.connect(addr1).approve(rtknToPrimeConverter.address, pledgeAmount);
            await rtknToPrimeConverter.connect(addr1).pledgerTKN(pledgeAmount);

            expect(await rtknToPrimeConverter.totalrTKNPledged()).to.be.gt(0);

            // Should still be able to change max cap
            const newMaxCap = ethers.utils.parseEther("2000");
            await expect(rtknToPrimeConverter.connect(owner).setRTKNMaxCap(newMaxCap))
                .to.emit(rtknToPrimeConverter, "MaxCapSet")
                .withArgs(rRTKNMaxCap, newMaxCap);

            expect(await rtknToPrimeConverter.rRTKNMaxCap()).to.equal(newMaxCap);
        });

        it("Should not allow setting max cap to zero", async function () {
            await expect(rtknToPrimeConverter.connect(owner).setRTKNMaxCap(0))
                .to.be.revertedWith("Max cap must be greater than zero");
        });

        it("Should not allow setting max cap in Phase 2", async function () {
            // Start with some pledges
            const pledgeAmount = ethers.utils.parseEther("500");
            await rtkn.connect(addr1).approve(rtknToPrimeConverter.address, pledgeAmount);
            await rtknToPrimeConverter.connect(addr1).pledgerTKN(pledgeAmount);

            // Move to Phase 2
            await rtknToPrimeConverter.connect(owner).startPhase2();

            // Try to change max cap
            const newMaxCap = ethers.utils.parseEther("2000");
            await expect(rtknToPrimeConverter.connect(owner).setRTKNMaxCap(newMaxCap))
                .to.be.revertedWith("Can only change cap in Phase 1");
        });

        it("Should not allow non-owner to set max cap", async function () {
            const newMaxCap = ethers.utils.parseEther("2000");
            await expect(rtknToPrimeConverter.connect(addr1).setRTKNMaxCap(newMaxCap))
                .to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should allow multiple max cap changes in Phase 1", async function () {
            // First pledge
            const pledgeAmount = ethers.utils.parseEther("500");
            await rtkn.connect(addr1).approve(rtknToPrimeConverter.address, pledgeAmount);
            await rtknToPrimeConverter.connect(addr1).pledgerTKN(pledgeAmount);

            // First cap change
            const firstNewCap = ethers.utils.parseEther("2000");
            await rtknToPrimeConverter.connect(owner).setRTKNMaxCap(firstNewCap);
            expect(await rtknToPrimeConverter.rRTKNMaxCap()).to.equal(firstNewCap);

            // Second pledge
            await rtkn.connect(addr2).approve(rtknToPrimeConverter.address, pledgeAmount);
            await rtknToPrimeConverter.connect(addr2).pledgerTKN(pledgeAmount);

            // Second cap change
            const secondNewCap = ethers.utils.parseEther("3000");
            await rtknToPrimeConverter.connect(owner).setRTKNMaxCap(secondNewCap);
            expect(await rtknToPrimeConverter.rRTKNMaxCap()).to.equal(secondNewCap);
        });

        it("Should calculate correct scaling factor when pledged exceeds max cap", async function () {
            // Make pledges that exceed max cap
            const pledgeAmount1 = ethers.utils.parseEther("800");
            const pledgeAmount2 = ethers.utils.parseEther("700");
            // Total pledged will be 1500 ETH

            await rtkn.connect(addr1).approve(rtknToPrimeConverter.address, pledgeAmount1);
            await rtkn.connect(addr2).approve(rtknToPrimeConverter.address, pledgeAmount2);

            await rtknToPrimeConverter.connect(addr1).pledgerTKN(pledgeAmount1);
            await rtknToPrimeConverter.connect(addr2).pledgerTKN(pledgeAmount2);

            // Set max cap to be lower than total pledged (1500 ETH)
            const newMaxCap = ethers.utils.parseEther("1000");
            await rtknToPrimeConverter.connect(owner).setRTKNMaxCap(newMaxCap);

            // Move to Phase 2
            await rtknToPrimeConverter.connect(owner).startPhase2();

            // Calculate expected scaling factor
            // scalingFactor should be maxCap/totalPledged = 1000/1500 = 0.666...
            const totalPledged = pledgeAmount1.add(pledgeAmount2);
            const expectedScalingFactor = newMaxCap.mul(ethers.utils.parseEther("1")).div(totalPledged);

            expect(await rtknToPrimeConverter.scalingFactor()).to.equal(expectedScalingFactor);

            // Verify the scaling factor is less than 1
            expect(expectedScalingFactor).to.be.lt(ethers.utils.parseEther("1"));

            // Additional verification through user processing
            await rtknToPrimeConverter.processUsers(2);

            // Verify adjusted amounts
            const adjustedAmount1 = pledgeAmount1.mul(expectedScalingFactor).div(ethers.utils.parseEther("1"));
            const adjustedAmount2 = pledgeAmount2.mul(expectedScalingFactor).div(ethers.utils.parseEther("1"));

            expect(await rtknToPrimeConverter.userrTKNPledged(addr1.address)).to.equal(adjustedAmount1);
            expect(await rtknToPrimeConverter.userrTKNPledged(addr2.address)).to.equal(adjustedAmount2);

            // Verify total adjusted amount is very close to max cap (allowing for rounding)
            const totalAdjusted = await rtknToPrimeConverter.totalAdjustedrTKNPledged();
            // Allow for 1 wei difference per operation due to integer division rounding
            const tolerance = ethers.utils.parseEther("0.000000001"); // Very small tolerance
            expect(totalAdjusted.sub(newMaxCap).abs()).to.be.lt(tolerance);
        });
    });

    describe("Phase 1: Pledging", function () {
        it("Should allow users to pledge rTKN", async function () {
            const pledgeAmount = ethers.utils.parseEther("100");
            await rtkn.connect(addr1).approve(rtknToPrimeConverter.address, pledgeAmount);

            expect(await rtknToPrimeConverter.previewFuturePrimeAmountBasedOnPledgedAmountForUser(addr1.address)).to.equal(0);

            await expect(rtknToPrimeConverter.connect(addr1).pledgerTKN(pledgeAmount))
                .to.emit(rtknToPrimeConverter, "Pledged")
                .withArgs(addr1.address, pledgeAmount);

            expect(fromWei(await rtknToPrimeConverter.previewFuturePrimeAmountBasedOnPledgedAmountForUser(addr1.address))).to.be.closeTo(fromWei(pledgeAmount) / 0.884 / 1.4, 1e-10);
            expect(await rtknToPrimeConverter.userrTKNPledged(addr1.address)).to.equal(pledgeAmount);
            expect(await rtknToPrimeConverter.totalrTKNPledged()).to.equal(pledgeAmount);
        });

        it("Should not allow pledging zero amount", async function () {
            await expect(rtknToPrimeConverter.connect(addr1).pledgerTKN(0)).to.be.revertedWith("Amount must be greater than zero");
        });

        it("Should not allow pledging without approval", async function () {
            const pledgeAmount = ethers.utils.parseEther("100");
            await expect(rtknToPrimeConverter.connect(addr1).pledgerTKN(pledgeAmount)).to.be.reverted;
        });

        it("Should accumulate pledges from multiple users", async function () {
            const pledgeAmount = ethers.utils.parseEther("100");
            await rtkn.connect(addr1).approve(rtknToPrimeConverter.address, pledgeAmount);
            await rtkn.connect(addr2).approve(rtknToPrimeConverter.address, pledgeAmount);

            await rtknToPrimeConverter.connect(addr1).pledgerTKN(pledgeAmount);
            await rtknToPrimeConverter.connect(addr2).pledgerTKN(pledgeAmount);

            expect(await rtknToPrimeConverter.totalrTKNPledged()).to.equal(ethers.utils.parseEther("200"));
        });

        it("Should not allow pledging in Phase 2", async function () {
            await rtknToPrimeConverter.connect(owner).startPhase2();
            const pledgeAmount = ethers.utils.parseEther("100");
            await expect(rtknToPrimeConverter.connect(addr1).pledgerTKN(pledgeAmount)).to.be.revertedWith("Pledging not allowed in current phase");
        });

        describe("Pledge Cancellation", function () {
            it("Should allow users to fully cancel their pledge", async function () {
                const pledgeAmount = ethers.utils.parseEther("100");
                await rtkn.connect(addr1).approve(rtknToPrimeConverter.address, pledgeAmount);
                await rtknToPrimeConverter.connect(addr1).pledgerTKN(pledgeAmount);

                const balanceBefore = await rtkn.balanceOf(addr1.address);
                const userListBefore = await rtknToPrimeConverter.getTotalUsers();

                await expect(rtknToPrimeConverter.connect(addr1).cancelPledge(pledgeAmount))
                    .to.emit(rtknToPrimeConverter, "PledgeCancelled")
                    .withArgs(addr1.address, pledgeAmount);

                const balanceAfter = await rtkn.balanceOf(addr1.address);
                const userListAfter = await rtknToPrimeConverter.getTotalUsers();

                expect(await rtknToPrimeConverter.userrTKNPledged(addr1.address)).to.equal(0);
                expect(await rtknToPrimeConverter.totalrTKNPledged()).to.equal(0);
                expect(balanceAfter.sub(balanceBefore)).to.equal(pledgeAmount);
                expect(userListAfter).to.equal(userListBefore - 1);
            });

            it("Should allow partial pledge cancellation", async function () {
                const pledgeAmount = ethers.utils.parseEther("100");
                const cancelAmount = ethers.utils.parseEther("40");

                await rtkn.connect(addr1).approve(rtknToPrimeConverter.address, pledgeAmount);
                await rtknToPrimeConverter.connect(addr1).pledgerTKN(pledgeAmount);

                const balanceBefore = await rtkn.balanceOf(addr1.address);
                const userListBefore = await rtknToPrimeConverter.getTotalUsers();

                await expect(rtknToPrimeConverter.connect(addr1).cancelPledge(cancelAmount))
                    .to.emit(rtknToPrimeConverter, "PledgeCancelled")
                    .withArgs(addr1.address, cancelAmount);

                const balanceAfter = await rtkn.balanceOf(addr1.address);
                const userListAfter = await rtknToPrimeConverter.getTotalUsers();

                expect(await rtknToPrimeConverter.userrTKNPledged(addr1.address))
                    .to.equal(pledgeAmount.sub(cancelAmount));
                expect(await rtknToPrimeConverter.totalrTKNPledged())
                    .to.equal(pledgeAmount.sub(cancelAmount));
                expect(balanceAfter.sub(balanceBefore)).to.equal(cancelAmount);
                // User should still be in the list for partial cancellation
                expect(userListAfter).to.equal(userListBefore);
            });

            it("Should allow multiple partial cancellations", async function () {
                const pledgeAmount = ethers.utils.parseEther("100");
                const firstCancel = ethers.utils.parseEther("30");
                const secondCancel = ethers.utils.parseEther("20");

                await rtkn.connect(addr1).approve(rtknToPrimeConverter.address, pledgeAmount);
                await rtknToPrimeConverter.connect(addr1).pledgerTKN(pledgeAmount);

                await rtknToPrimeConverter.connect(addr1).cancelPledge(firstCancel);
                await rtknToPrimeConverter.connect(addr1).cancelPledge(secondCancel);

                expect(await rtknToPrimeConverter.userrTKNPledged(addr1.address))
                    .to.equal(pledgeAmount.sub(firstCancel).sub(secondCancel));
                expect(await rtknToPrimeConverter.getTotalUsers()).to.equal(1);
            });

            it("Should handle mix of full and partial cancellations from multiple users", async function () {
                const pledge1 = ethers.utils.parseEther("100");
                const pledge2 = ethers.utils.parseEther("200");
                const pledge3 = ethers.utils.parseEther("300");

                // Setup pledges
                await rtkn.connect(addr1).approve(rtknToPrimeConverter.address, pledge1);
                await rtkn.connect(addr2).approve(rtknToPrimeConverter.address, pledge2);
                await rtkn.connect(addr3).approve(rtknToPrimeConverter.address, pledge3);

                await rtknToPrimeConverter.connect(addr1).pledgerTKN(pledge1);
                await rtknToPrimeConverter.connect(addr2).pledgerTKN(pledge2);
                await rtknToPrimeConverter.connect(addr3).pledgerTKN(pledge3);

                expect(await rtknToPrimeConverter.getTotalUsers()).to.equal(3);

                // Addr1 cancels partially
                const partialCancel = ethers.utils.parseEther("40");
                await rtknToPrimeConverter.connect(addr1).cancelPledge(partialCancel);

                // Addr2 cancels fully
                await rtknToPrimeConverter.connect(addr2).cancelPledge(pledge2);

                // Verify states
                expect(await rtknToPrimeConverter.userrTKNPledged(addr1.address))
                    .to.equal(pledge1.sub(partialCancel));
                expect(await rtknToPrimeConverter.userrTKNPledged(addr2.address))
                    .to.equal(0);
                expect(await rtknToPrimeConverter.userrTKNPledged(addr3.address))
                    .to.equal(pledge3);
                expect(await rtknToPrimeConverter.getTotalUsers()).to.equal(2);
                expect(await rtknToPrimeConverter.totalrTKNPledged())
                    .to.equal(pledge1.sub(partialCancel).add(pledge3));
            });

            it("Should not allow cancelling more than pledged amount", async function () {
                const pledgeAmount = ethers.utils.parseEther("100");
                const cancelAmount = ethers.utils.parseEther("101");

                await rtkn.connect(addr1).approve(rtknToPrimeConverter.address, pledgeAmount);
                await rtknToPrimeConverter.connect(addr1).pledgerTKN(pledgeAmount);

                await expect(rtknToPrimeConverter.connect(addr1).cancelPledge(cancelAmount))
                    .to.be.revertedWith("Cannot cancel more than pledged");
            });

            it("Should not allow cancelling zero amount", async function () {
                const pledgeAmount = ethers.utils.parseEther("100");
                await rtkn.connect(addr1).approve(rtknToPrimeConverter.address, pledgeAmount);
                await rtknToPrimeConverter.connect(addr1).pledgerTKN(pledgeAmount);

                await expect(rtknToPrimeConverter.connect(addr1).cancelPledge(0))
                    .to.be.revertedWith("Amount must be greater than zero");
            });

            it("Should not allow cancellation if user has no pledge", async function () {
                const cancelAmount = ethers.utils.parseEther("1");
                await expect(rtknToPrimeConverter.connect(addr1).cancelPledge(cancelAmount))
                    .to.be.revertedWith("No pledge to cancel");
            });

            it("Should not allow cancellation in Phase 2", async function () {
                const pledgeAmount = ethers.utils.parseEther("100");
                const cancelAmount = ethers.utils.parseEther("40");

                await rtkn.connect(addr1).approve(rtknToPrimeConverter.address, pledgeAmount);
                await rtknToPrimeConverter.connect(addr1).pledgerTKN(pledgeAmount);

                await rtknToPrimeConverter.connect(owner).startPhase2();

                await expect(rtknToPrimeConverter.connect(addr1).cancelPledge(cancelAmount))
                    .to.be.revertedWith("Can only cancel pledge in Phase 1");
            });

            it("Should allow pledge after partial cancellation", async function () {
                const initialPledge = ethers.utils.parseEther("100");
                const cancelAmount = ethers.utils.parseEther("40");
                const additionalPledge = ethers.utils.parseEther("50");

                // Initial pledge
                await rtkn.connect(addr1).approve(rtknToPrimeConverter.address, initialPledge.add(additionalPledge));
                await rtknToPrimeConverter.connect(addr1).pledgerTKN(initialPledge);

                // Partial cancel
                await rtknToPrimeConverter.connect(addr1).cancelPledge(cancelAmount);

                // Additional pledge
                await rtknToPrimeConverter.connect(addr1).pledgerTKN(additionalPledge);

                expect(await rtknToPrimeConverter.userrTKNPledged(addr1.address))
                    .to.equal(initialPledge.sub(cancelAmount).add(additionalPledge));
                expect(await rtknToPrimeConverter.getTotalUsers()).to.equal(1);
            });

            it("Should handle large number of users with mixed cancellations", async function () {
                // Add 12 users with varying pledges
                const baseAmount = ethers.utils.parseEther("1");
                const users = 12;

                for(let i = 0; i < users; i++) {
                    const signer = addrs[i];
                    const pledgeAmount = baseAmount.mul(i + 1); // Different amount for each user
                    await rtkn.transfer(signer.address, pledgeAmount);
                    await rtkn.connect(signer).approve(rtknToPrimeConverter.address, pledgeAmount);
                    await rtknToPrimeConverter.connect(signer).pledgerTKN(pledgeAmount);
                }

                expect(await rtknToPrimeConverter.getTotalUsers()).to.equal(users);

                // Mix of full and partial cancellations
                for(let i = 0; i < users; i += 2) {
                    const signer = addrs[i];
                    const pledged = baseAmount.mul(i + 1);
                    if (i % 4 === 0) {
                        // Full cancellation for every 4th user
                        await rtknToPrimeConverter.connect(signer).cancelPledge(pledged);
                    } else {
                        // Partial cancellation for others
                        await rtknToPrimeConverter.connect(signer).cancelPledge(pledged.div(2));
                    }
                }

                // Verify final state
                const expectedRemainingUsers = users - Math.floor(users/4);
                expect(await rtknToPrimeConverter.getTotalUsers()).to.equal(expectedRemainingUsers);
            });
        });
    });

    describe("Phase Transition", function () {
        beforeEach(async function () {
            const pledgeAmount = ethers.utils.parseEther("1000");
            await rtkn.connect(addr1).approve(rtknToPrimeConverter.address, pledgeAmount);
            await rtknToPrimeConverter.connect(addr1).pledgerTKN(pledgeAmount);
        });

        it("Should only allow owner to start Phase 2", async function () {
            await expect(rtknToPrimeConverter.connect(addr1).startPhase2()).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should transition to Phase 2 correctly", async function () {
            await rtknToPrimeConverter.connect(owner).startPhase2();
            expect(await rtknToPrimeConverter.currentPhase()).to.equal(1); // Phase2
        });

        it("Should calculate scaling factor correctly when demand is within cap", async function () {
            await rtknToPrimeConverter.connect(owner).startPhase2();
            expect(await rtknToPrimeConverter.scalingFactor()).to.equal(ethers.utils.parseEther("1"));
        });

        it("Should calculate scaling factor correctly when demand exceeds cap", async function () {
            const extraPledgeAmount = ethers.utils.parseEther("5000");
            await rtkn.connect(addr2).approve(rtknToPrimeConverter.address, extraPledgeAmount);
            await rtknToPrimeConverter.connect(addr2).pledgerTKN(extraPledgeAmount);

            await rtknToPrimeConverter.connect(owner).startPhase2();

            const totalDemand = fromWei(await rtknToPrimeConverter.totalrTKNPledged());

            let rTKNMaxCapNormalized = fromWei(rRTKNMaxCap)
            const expectedScalingFactor = rTKNMaxCapNormalized /totalDemand;

            expect(fromWei(await rtknToPrimeConverter.scalingFactor())).to.equal(expectedScalingFactor);
        });
    });

    describe("Phase 2: Processing Users", function () {
        it("Should process users in batches and adjust pledged amounts", async function () {
            const pledgeAmount1 = ethers.utils.parseEther("1000");
            const pledgeAmount2 = ethers.utils.parseEther("500");
            const pledgeAmount3 = ethers.utils.parseEther("2000");

            await rtkn.connect(addr1).approve(rtknToPrimeConverter.address, pledgeAmount1);
            await rtkn.connect(addr2).approve(rtknToPrimeConverter.address, pledgeAmount2);
            await rtkn.connect(addr3).approve(rtknToPrimeConverter.address, pledgeAmount3);

            expect(fromWei(await rtknToPrimeConverter.previewFuturePrimeAmountBasedOnPledgedAmountForUser(addr1.address))).to.be.equal(0);
            await rtknToPrimeConverter.connect(addr1).pledgerTKN(pledgeAmount1);
            expect(fromWei(await rtknToPrimeConverter.previewFuturePrimeAmountBasedOnPledgedAmountForUser(addr1.address))).to.be.closeTo(fromWei(pledgeAmount1) / 0.884 / 1.4, 1e-10);

            await rtknToPrimeConverter.connect(addr2).pledgerTKN(pledgeAmount2);
            await rtknToPrimeConverter.connect(addr3).pledgerTKN(pledgeAmount3);

            await rtknToPrimeConverter.connect(owner).startPhase2();

            const batchSize = 2;
            await rtknToPrimeConverter.connect(addr1).processUsers(batchSize);

            expect(await rtknToPrimeConverter.userProcessed(addr1.address)).to.be.true;
            expect(await rtknToPrimeConverter.userProcessed(addr2.address)).to.be.true;
            expect(await rtknToPrimeConverter.userProcessed(addr3.address)).to.be.false;

            // Process remaining users
            await rtknToPrimeConverter.connect(addr1).processUsers(batchSize);
            expect(await rtknToPrimeConverter.userProcessed(addr3.address)).to.be.true;

            const scalingFactor = fromWei(await rtknToPrimeConverter.scalingFactor());
            expect(fromWei(await rtknToPrimeConverter.previewFuturePrimeAmountBasedOnPledgedAmountForUser(addr1.address))).to.be.closeTo(fromWei(pledgeAmount1) * scalingFactor / 0.884 / 1.4, 1e-10);
        });

        it("Should refund excess rTKN when demand exceeds cap", async function () {
            const pledgeAmount1 = ethers.utils.parseEther("1000");
            const pledgeAmount2 = ethers.utils.parseEther("500");
            const pledgeAmount3 = ethers.utils.parseEther("2000");

            await rtkn.connect(addr1).approve(rtknToPrimeConverter.address, pledgeAmount1);
            await rtkn.connect(addr2).approve(rtknToPrimeConverter.address, pledgeAmount2);
            await rtkn.connect(addr3).approve(rtknToPrimeConverter.address, pledgeAmount3);

            await rtknToPrimeConverter.connect(addr1).pledgerTKN(pledgeAmount1);

            await rtknToPrimeConverter.connect(addr2).pledgerTKN(pledgeAmount2);
            await rtknToPrimeConverter.connect(addr3).pledgerTKN(pledgeAmount3);

            await rtknToPrimeConverter.connect(owner).startPhase2();

            const CONVERSION_RATIO = await rtknToPrimeConverter.CONVERSION_RATIO();
            const totalDemand = (await rtknToPrimeConverter.totalrTKNPledged()).mul(CONVERSION_RATIO);
            const scalingFactor = await rtknToPrimeConverter.scalingFactor();

            // If scaling factor is less than 1, there should be refunds
            if (scalingFactor.lt(ethers.utils.parseEther("1"))) {
                const addr1InitialBalance = await rtkn.balanceOf(addr1.address);

                const batchSize = 3;
                await rtknToPrimeConverter.connect(addr1).processUsers(batchSize);

                const pledgedAmount = ethers.utils.parseEther("1000");
                const adjustedPledged = pledgedAmount.mul(scalingFactor).div(ethers.utils.parseEther("1"));
                const excess = pledgedAmount.sub(adjustedPledged);

                const addr1FinalBalance = await rtkn.balanceOf(addr1.address);
                expect(addr1FinalBalance).to.equal(addr1InitialBalance.add(excess));
            }
        });

        it("Should not refund when scaling factor is 1", async function () {
            const pledgeAmount1 = ethers.utils.parseEther("100");
            const pledgeAmount2 = ethers.utils.parseEther("500");
            const pledgeAmount3 = ethers.utils.parseEther("200");

            await rtkn.connect(addr1).approve(rtknToPrimeConverter.address, pledgeAmount1);
            await rtkn.connect(addr2).approve(rtknToPrimeConverter.address, pledgeAmount2);
            await rtkn.connect(addr3).approve(rtknToPrimeConverter.address, pledgeAmount3);

            await rtknToPrimeConverter.connect(addr1).pledgerTKN(pledgeAmount1);

            await rtknToPrimeConverter.connect(addr2).pledgerTKN(pledgeAmount2);
            await rtknToPrimeConverter.connect(addr3).pledgerTKN(pledgeAmount3);

            await expect(rtknToPrimeConverter.connect(addr1).processUsers(1)).to.be.revertedWith("Must be in Phase 2");
            await rtknToPrimeConverter.connect(owner).startPhase2();

            const addr1InitialBalance = await rtkn.balanceOf(addr1.address);

            const batchSize = 3;
            await rtknToPrimeConverter.connect(addr1).processUsers(batchSize);

            const addr1Balance = await rtkn.balanceOf(addr1.address);
            expect(addr1Balance).to.equal(addr1InitialBalance);
        });
    });

    describe("Withdrawal", function () {
        beforeEach(async function () {
            const pledgeAmount1 = ethers.utils.parseEther("1000");
            const pledgeAmount2 = ethers.utils.parseEther("500");
            const pledgeAmount3 = ethers.utils.parseEther("2000");

            await rtkn.connect(addr1).approve(rtknToPrimeConverter.address, pledgeAmount1);
            await rtkn.connect(addr2).approve(rtknToPrimeConverter.address, pledgeAmount2);
            await rtkn.connect(addr3).approve(rtknToPrimeConverter.address, pledgeAmount3);

            await rtknToPrimeConverter.connect(addr1).pledgerTKN(pledgeAmount1);
            await rtknToPrimeConverter.connect(addr2).pledgerTKN(pledgeAmount2);
            await rtknToPrimeConverter.connect(addr3).pledgerTKN(pledgeAmount3);

            await rtknToPrimeConverter.connect(owner).startPhase2();
            const batchSize = 2;
            await rtknToPrimeConverter.connect(addr1).processUsers(batchSize);
        });

        it("Should allow owner to withdraw remaining rTKN after processing", async function () {
            await rtknToPrimeConverter.connect(addr1).processUsers(1);
            const contractBalanceBefore = await rtkn.balanceOf(rtknToPrimeConverter.address);
            const ownerBalanceBefore = await rtkn.balanceOf(owner.address);

            await rtknToPrimeConverter.connect(owner).withdrawrTKN();

            const contractBalanceAfter = await rtkn.balanceOf(rtknToPrimeConverter.address);
            const ownerBalanceAfter = await rtkn.balanceOf(owner.address);

            expect(contractBalanceAfter).to.equal(0);
            expect(ownerBalanceAfter.sub(ownerBalanceBefore)).to.equal(contractBalanceBefore);
        });

        it("Should not allow withdrawal before processing all users", async function () {
            await expect(rtknToPrimeConverter.connect(owner).withdrawrTKN()).to.be.revertedWith("Processing not complete");
        });

        it("Should not allow non-owner to withdraw", async function () {
            await expect(rtknToPrimeConverter.connect(addr1).withdrawrTKN()).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    describe("Edge Cases", function () {
        it("Should handle no pledges gracefully", async function () {
            await rtknToPrimeConverter.connect(owner).startPhase2();
            const batchSize = 1;
            await rtknToPrimeConverter.connect(owner).processUsers(batchSize);
            expect(await rtknToPrimeConverter.getTotalUsers()).to.equal(0);
        });

        it("Should not allow starting Phase 2 multiple times", async function () {
            await rtknToPrimeConverter.connect(owner).startPhase2();
            await expect(rtknToPrimeConverter.connect(owner).startPhase2()).to.be.revertedWith("Already in Phase 2");
        });

        it("Should not allow pledging after Phase 2 starts", async function () {
            await rtknToPrimeConverter.connect(owner).startPhase2();
            const pledgeAmount = ethers.utils.parseEther("100");
            await rtkn.connect(addr1).approve(rtknToPrimeConverter.address, pledgeAmount);
            await expect(rtknToPrimeConverter.connect(addr1).pledgerTKN(pledgeAmount)).to.be.revertedWith("Pledging not allowed in current phase");
        });
    });
});
