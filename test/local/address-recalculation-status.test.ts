const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AddressRecalculationStatus", function () {
    let AddressRecalculationStatus;
    let recalcStatus;
    let owner;
    let addr1;
    let addr2;
    let addrs;

    beforeEach(async function () {
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
        AddressRecalculationStatus = await ethers.getContractFactory("AddressRecalculationStatus");
        recalcStatus = await AddressRecalculationStatus.deploy();
        await recalcStatus.deployed();
    });

    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            expect(await recalcStatus.owner()).to.equal(owner.address);
        });

        it("Should start with empty recalculation list", async function () {
            expect(await recalcStatus.getRecalculationCount()).to.equal(0);
            const addresses = await recalcStatus.getAllAddressesNeedingRecalculation();
            expect(addresses.length).to.equal(0);
        });
    });

    describe("Ownership", function () {
        it("Should allow owner to transfer ownership", async function () {
            await recalcStatus.transferOwnership(addr1.address);
            expect(await recalcStatus.owner()).to.equal(addr1.address);
        });

        it("Should emit OwnershipTransferred event", async function () {
            await expect(recalcStatus.transferOwnership(addr1.address))
                .to.emit(recalcStatus, "OwnershipTransferred")
                .withArgs(owner.address, addr1.address);
        });

        it("Should prevent non-owner from transferring ownership", async function () {
            await expect(
                recalcStatus.connect(addr1).transferOwnership(addr2.address)
            ).to.be.revertedWith("AddressRecalculationStatus: caller is not the owner");
        });

        it("Should prevent transferring ownership to zero address", async function () {
            await expect(
                recalcStatus.transferOwnership(ethers.constants.AddressZero)
            ).to.be.revertedWith("AddressRecalculationStatus: new owner is the zero address");
        });
    });

    describe("Single Address Recalculation Marking", function () {
        it("Should allow owner to mark an address for recalculation", async function () {
            await recalcStatus.markAddressForRecalculation(addr1.address);
            expect(await recalcStatus.needsRecalculationCheck(addr1.address)).to.be.true;
        });

        it("Should emit AddressNeedsRecalculation event", async function () {
            await expect(recalcStatus.markAddressForRecalculation(addr1.address))
                .to.emit(recalcStatus, "AddressNeedsRecalculation")
                .withArgs(addr1.address);
        });

        it("Should prevent non-owner from marking for recalculation", async function () {
            await expect(
                recalcStatus.connect(addr1).markAddressForRecalculation(addr2.address)
            ).to.be.revertedWith("AddressRecalculationStatus: caller is not the owner");
        });

        it("Should prevent marking zero address", async function () {
            await expect(
                recalcStatus.markAddressForRecalculation(ethers.constants.AddressZero)
            ).to.be.revertedWith("AddressRecalculationStatus: cannot mark zero address");
        });

        it("Should prevent marking already marked address", async function () {
            await recalcStatus.markAddressForRecalculation(addr1.address);
            await expect(
                recalcStatus.markAddressForRecalculation(addr1.address)
            ).to.be.revertedWith("AddressRecalculationStatus: address already marked for recalculation");
        });
    });

    describe("Batch Recalculation Marking", function () {
        it("Should allow owner to mark multiple addresses", async function () {
            const addresses = [addr1.address, addr2.address, addrs[0].address];
            await recalcStatus.markForRecalculation(addresses);

            for (const addr of addresses) {
                expect(await recalcStatus.needsRecalculationCheck(addr)).to.be.true;
            }
            expect(await recalcStatus.getRecalculationCount()).to.equal(3);
        });

        it("Should emit individual and batch events", async function () {
            const addresses = [addr1.address, addr2.address];
            const tx = await recalcStatus.markForRecalculation(addresses);
            const receipt = await tx.wait();

            // Check for individual events
            const markedEvents = receipt.events.filter(e => e.event === 'AddressNeedsRecalculation');
            expect(markedEvents.length).to.equal(2);
            expect(markedEvents[0].args.account).to.equal(addr1.address);
            expect(markedEvents[1].args.account).to.equal(addr2.address);

            // Check for batch event
            const batchEvent = receipt.events.find(e => e.event === 'BatchMarkedForRecalculation');
            expect(batchEvent.args.count).to.equal(2);
        });

        it("Should skip zero addresses in batch", async function () {
            const addresses = [addr1.address, ethers.constants.AddressZero, addr2.address];
            await recalcStatus.markForRecalculation(addresses);

            expect(await recalcStatus.needsRecalculationCheck(addr1.address)).to.be.true;
            expect(await recalcStatus.needsRecalculationCheck(addr2.address)).to.be.true;
            expect(await recalcStatus.getRecalculationCount()).to.equal(2);
        });

        it("Should skip already marked addresses in batch", async function () {
            // First mark one address
            await recalcStatus.markAddressForRecalculation(addr1.address);

            // Try to mark it again in a batch
            const addresses = [addr1.address, addr2.address];
            await recalcStatus.markForRecalculation(addresses);

            expect(await recalcStatus.getRecalculationCount()).to.equal(2);
        });

        it("Should prevent non-owner from batch marking", async function () {
            const addresses = [addr1.address, addr2.address];
            await expect(
                recalcStatus.connect(addr1).markForRecalculation(addresses)
            ).to.be.revertedWith("AddressRecalculationStatus: caller is not the owner");
        });

        it("Should revert on empty array", async function () {
            await expect(
                recalcStatus.markForRecalculation([])
            ).to.be.revertedWith("AddressRecalculationStatus: empty array");
        });
    });

    describe("Batch Completion of Recalculation", function () {
        beforeEach(async function () {
            // Setup: mark multiple addresses for recalculation
            const addresses = [addr1.address, addr2.address, addrs[0].address];
            await recalcStatus.markForRecalculation(addresses);
        });

        it("Should allow owner to mark multiple addresses as complete", async function () {
            const addresses = [addr1.address, addr2.address];
            await recalcStatus.markRecalculationCompleteBatch(addresses);

            for (const addr of addresses) {
                expect(await recalcStatus.needsRecalculationCheck(addr)).to.be.false;
            }
            expect(await recalcStatus.getRecalculationCount()).to.equal(1);
        });

        it("Should emit individual and batch completion events", async function () {
            const addresses = [addr1.address, addr2.address];
            const tx = await recalcStatus.markRecalculationCompleteBatch(addresses);
            const receipt = await tx.wait();

            // Check for individual events
            const completedEvents = receipt.events.filter(e => e.event === 'AddressRecalculationComplete');
            expect(completedEvents.length).to.equal(2);
            expect(completedEvents[0].args.account).to.equal(addr1.address);
            expect(completedEvents[1].args.account).to.equal(addr2.address);

            // Check for batch event
            const batchEvent = receipt.events.find(e => e.event === 'BatchRecalculationComplete');
            expect(batchEvent.args.count).to.equal(2);
        });

        it("Should skip zero addresses in batch completion", async function () {
            const addresses = [addr1.address, ethers.constants.AddressZero, addr2.address];
            await recalcStatus.markRecalculationCompleteBatch(addresses);

            expect(await recalcStatus.needsRecalculationCheck(addr1.address)).to.be.false;
            expect(await recalcStatus.needsRecalculationCheck(addr2.address)).to.be.false;
            expect(await recalcStatus.getRecalculationCount()).to.equal(1);
        });

        it("Should skip addresses not marked for recalculation in batch completion", async function () {
            // First complete one address
            await recalcStatus.markRecalculationComplete(addr1.address);

            // Try to complete it again in a batch
            const addresses = [addr1.address, addr2.address];
            await recalcStatus.markRecalculationCompleteBatch(addresses);

            expect(await recalcStatus.getRecalculationCount()).to.equal(1);
        });

        it("Should prevent non-owner from batch completion", async function () {
            const addresses = [addr1.address, addr2.address];
            await expect(
                recalcStatus.connect(addr1).markRecalculationCompleteBatch(addresses)
            ).to.be.revertedWith("AddressRecalculationStatus: caller is not the owner");
        });

        it("Should revert on empty array for completion", async function () {
            await expect(
                recalcStatus.markRecalculationCompleteBatch([])
            ).to.be.revertedWith("AddressRecalculationStatus: empty array");
        });

        it("Should maintain correct indices after batch operations", async function () {
            // Initial setup already added 3 addresses in beforeEach

            // Add 2 more addresses (total: 5)
            await recalcStatus.markForRecalculation([addrs[1].address, addrs[2].address]);
            expect(await recalcStatus.getRecalculationCount()).to.equal(5);

            // Complete 2 addresses (total: 3)
            await recalcStatus.markRecalculationCompleteBatch([addr1.address, addrs[0].address]);
            expect(await recalcStatus.getRecalculationCount()).to.equal(3);

            // Add 2 new addresses (total: 5)
            await recalcStatus.markForRecalculation([addrs[3].address, addrs[4].address]);

            // Verify final state
            const finalAddresses = await recalcStatus.getAllAddressesNeedingRecalculation();
            expect(finalAddresses.length).to.equal(5);

            // Verify specific addresses are completed/added correctly
            expect(await recalcStatus.needsRecalculationCheck(addr1.address)).to.be.false;
            expect(await recalcStatus.needsRecalculationCheck(addrs[0].address)).to.be.false;
            expect(await recalcStatus.needsRecalculationCheck(addr2.address)).to.be.true;
            expect(await recalcStatus.needsRecalculationCheck(addrs[1].address)).to.be.true;
            expect(await recalcStatus.needsRecalculationCheck(addrs[2].address)).to.be.true;
            expect(await recalcStatus.needsRecalculationCheck(addrs[3].address)).to.be.true;
            expect(await recalcStatus.needsRecalculationCheck(addrs[4].address)).to.be.true;
        });
    });
});