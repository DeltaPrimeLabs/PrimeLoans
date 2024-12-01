const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AddressBlacklist", function () {
    let AddressBlacklist;
    let blacklist;
    let owner;
    let addr1;
    let addr2;
    let addrs;

    beforeEach(async function () {
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
        AddressBlacklist = await ethers.getContractFactory("AddressBlacklist");
        blacklist = await AddressBlacklist.deploy();
        await blacklist.deployed();
    });

    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            expect(await blacklist.owner()).to.equal(owner.address);
        });

        it("Should start with empty blacklist", async function () {
            expect(await blacklist.getBlacklistCount()).to.equal(0);
            const addresses = await blacklist.getAllBlacklistedAddresses();
            expect(addresses.length).to.equal(0);
        });
    });

    describe("Ownership", function () {
        it("Should allow owner to transfer ownership", async function () {
            await blacklist.transferOwnership(addr1.address);
            expect(await blacklist.owner()).to.equal(addr1.address);
        });

        it("Should emit OwnershipTransferred event", async function () {
            await expect(blacklist.transferOwnership(addr1.address))
                .to.emit(blacklist, "OwnershipTransferred")
                .withArgs(owner.address, addr1.address);
        });

        it("Should prevent non-owner from transferring ownership", async function () {
            await expect(
                blacklist.connect(addr1).transferOwnership(addr2.address)
            ).to.be.revertedWith("AddressBlacklist: caller is not the owner");
        });

        it("Should prevent transferring ownership to zero address", async function () {
            await expect(
                blacklist.transferOwnership(ethers.constants.AddressZero)
            ).to.be.revertedWith("AddressBlacklist: new owner is the zero address");
        });
    });

    describe("Single Address Blacklisting", function () {
        it("Should allow owner to blacklist an address", async function () {
            await blacklist.blacklistAddress(addr1.address);
            expect(await blacklist.isBlacklisted(addr1.address)).to.be.true;
        });

        it("Should emit AddressBlacklisted event", async function () {
            await expect(blacklist.blacklistAddress(addr1.address))
                .to.emit(blacklist, "AddressBlacklisted")
                .withArgs(addr1.address);
        });

        it("Should prevent non-owner from blacklisting", async function () {
            await expect(
                blacklist.connect(addr1).blacklistAddress(addr2.address)
            ).to.be.revertedWith("AddressBlacklist: caller is not the owner");
        });

        it("Should prevent blacklisting zero address", async function () {
            await expect(
                blacklist.blacklistAddress(ethers.constants.AddressZero)
            ).to.be.revertedWith("AddressBlacklist: cannot blacklist zero address");
        });

        it("Should prevent blacklisting already blacklisted address", async function () {
            await blacklist.blacklistAddress(addr1.address);
            await expect(
                blacklist.blacklistAddress(addr1.address)
            ).to.be.revertedWith("AddressBlacklist: address already blacklisted");
        });
    });

    describe("Batch Blacklisting", function () {
        it("Should allow owner to blacklist multiple addresses", async function () {
            const addresses = [addr1.address, addr2.address, addrs[0].address];
            await blacklist.blacklistAddresses(addresses);

            for (const addr of addresses) {
                expect(await blacklist.isBlacklisted(addr)).to.be.true;
            }
            expect(await blacklist.getBlacklistCount()).to.equal(3);
        });

        it("Should emit individual and batch events", async function () {
            const addresses = [addr1.address, addr2.address];
            const tx = await blacklist.blacklistAddresses(addresses);
            const receipt = await tx.wait();

            // Check for individual events
            const blacklistedEvents = receipt.events.filter(e => e.event === 'AddressBlacklisted');
            expect(blacklistedEvents.length).to.equal(2);
            expect(blacklistedEvents[0].args.account).to.equal(addr1.address);
            expect(blacklistedEvents[1].args.account).to.equal(addr2.address);

            // Check for batch event
            const batchEvent = receipt.events.find(e => e.event === 'BatchBlacklisted');
            expect(batchEvent.args.count).to.equal(2);
        });

        it("Should skip zero addresses in batch", async function () {
            const addresses = [addr1.address, ethers.constants.AddressZero, addr2.address];
            await blacklist.blacklistAddresses(addresses);

            expect(await blacklist.isBlacklisted(addr1.address)).to.be.true;
            expect(await blacklist.isBlacklisted(addr2.address)).to.be.true;
            expect(await blacklist.getBlacklistCount()).to.equal(2);
        });

        it("Should skip already blacklisted addresses in batch", async function () {
            // First blacklist one address
            await blacklist.blacklistAddress(addr1.address);

            // Try to blacklist it again in a batch
            const addresses = [addr1.address, addr2.address];
            await blacklist.blacklistAddresses(addresses);

            expect(await blacklist.getBlacklistCount()).to.equal(2);
        });

        it("Should prevent non-owner from batch blacklisting", async function () {
            const addresses = [addr1.address, addr2.address];
            await expect(
                blacklist.connect(addr1).blacklistAddresses(addresses)
            ).to.be.revertedWith("AddressBlacklist: caller is not the owner");
        });

        it("Should revert on empty array", async function () {
            await expect(
                blacklist.blacklistAddresses([])
            ).to.be.revertedWith("AddressBlacklist: empty array");
        });
    });

    describe("Batch Removal from Blacklist", function () {
        beforeEach(async function () {
            // Setup: blacklist multiple addresses
            const addresses = [addr1.address, addr2.address, addrs[0].address];
            await blacklist.blacklistAddresses(addresses);
        });

        it("Should allow owner to remove multiple addresses", async function () {
            const addresses = [addr1.address, addr2.address];
            await blacklist.removeFromBlacklistBatch(addresses);

            for (const addr of addresses) {
                expect(await blacklist.isBlacklisted(addr)).to.be.false;
            }
            expect(await blacklist.getBlacklistCount()).to.equal(1);
        });

        it("Should emit individual and batch removal events", async function () {
            const addresses = [addr1.address, addr2.address];
            const tx = await blacklist.removeFromBlacklistBatch(addresses);
            const receipt = await tx.wait();

            // Check for individual events
            const removedEvents = receipt.events.filter(e => e.event === 'AddressRemovedFromBlacklist');
            expect(removedEvents.length).to.equal(2);
            expect(removedEvents[0].args.account).to.equal(addr1.address);
            expect(removedEvents[1].args.account).to.equal(addr2.address);

            // Check for batch event
            const batchEvent = receipt.events.find(e => e.event === 'BatchRemovedFromBlacklist');
            expect(batchEvent.args.count).to.equal(2);
        });

        it("Should skip zero addresses in batch removal", async function () {
            const addresses = [addr1.address, ethers.constants.AddressZero, addr2.address];
            await blacklist.removeFromBlacklistBatch(addresses);

            expect(await blacklist.isBlacklisted(addr1.address)).to.be.false;
            expect(await blacklist.isBlacklisted(addr2.address)).to.be.false;
            expect(await blacklist.getBlacklistCount()).to.equal(1);
        });

        it("Should skip non-blacklisted addresses in batch removal", async function () {
            // First remove one address
            await blacklist.removeFromBlacklist(addr1.address);

            // Try to remove it again in a batch
            const addresses = [addr1.address, addr2.address];
            await blacklist.removeFromBlacklistBatch(addresses);

            expect(await blacklist.getBlacklistCount()).to.equal(1);
        });

        it("Should prevent non-owner from batch removal", async function () {
            const addresses = [addr1.address, addr2.address];
            await expect(
                blacklist.connect(addr1).removeFromBlacklistBatch(addresses)
            ).to.be.revertedWith("AddressBlacklist: caller is not the owner");
        });

        it("Should revert on empty array for removal", async function () {
            await expect(
                blacklist.removeFromBlacklistBatch([])
            ).to.be.revertedWith("AddressBlacklist: empty array");
        });

        it("Should maintain correct indices after batch operations", async function () {
            // Initial setup already added 3 addresses in beforeEach

            // Add 2 more addresses (total: 5)
            await blacklist.blacklistAddresses([addrs[1].address, addrs[2].address]);
            expect(await blacklist.getBlacklistCount()).to.equal(5);

            // Remove 2 addresses (total: 3)
            await blacklist.removeFromBlacklistBatch([addr1.address, addrs[0].address]);
            expect(await blacklist.getBlacklistCount()).to.equal(3);

            // Add 2 new addresses (total: 5)
            await blacklist.blacklistAddresses([addrs[3].address, addrs[4].address]);

            // Verify final state
            const finalAddresses = await blacklist.getAllBlacklistedAddresses();
            expect(finalAddresses.length).to.equal(5);

            // Verify specific addresses are removed/added correctly
            expect(await blacklist.isBlacklisted(addr1.address)).to.be.false;
            expect(await blacklist.isBlacklisted(addrs[0].address)).to.be.false;
            expect(await blacklist.isBlacklisted(addr2.address)).to.be.true;
            expect(await blacklist.isBlacklisted(addrs[1].address)).to.be.true;
            expect(await blacklist.isBlacklisted(addrs[2].address)).to.be.true;
            expect(await blacklist.isBlacklisted(addrs[3].address)).to.be.true;
            expect(await blacklist.isBlacklisted(addrs[4].address)).to.be.true;
        });
    });
});