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
        // Get signers
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

        // Deploy contract
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

    describe("Blacklisting", function () {
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

    describe("Removing from blacklist", function () {
        beforeEach(async function () {
            await blacklist.blacklistAddress(addr1.address);
        });

        it("Should allow owner to remove address from blacklist", async function () {
            await blacklist.removeFromBlacklist(addr1.address);
            expect(await blacklist.isBlacklisted(addr1.address)).to.be.false;
        });

        it("Should emit AddressRemovedFromBlacklist event", async function () {
            await expect(blacklist.removeFromBlacklist(addr1.address))
                .to.emit(blacklist, "AddressRemovedFromBlacklist")
                .withArgs(addr1.address);
        });

        it("Should prevent non-owner from removing from blacklist", async function () {
            await expect(
                blacklist.connect(addr1).removeFromBlacklist(addr2.address)
            ).to.be.revertedWith("AddressBlacklist: caller is not the owner");
        });

        it("Should prevent removing non-blacklisted address", async function () {
            await expect(
                blacklist.removeFromBlacklist(addr2.address)
            ).to.be.revertedWith("AddressBlacklist: address not blacklisted");
        });

        it("Should prevent removing zero address", async function () {
            await expect(
                blacklist.removeFromBlacklist(ethers.constants.AddressZero)
            ).to.be.revertedWith("AddressBlacklist: cannot remove zero address");
        });
    });

    describe("Blacklist management", function () {
        it("Should correctly maintain list of blacklisted addresses", async function () {
            // Add multiple addresses
            await blacklist.blacklistAddress(addr1.address);
            await blacklist.blacklistAddress(addr2.address);

            // Check count
            expect(await blacklist.getBlacklistCount()).to.equal(2);

            // Check list
            const addresses = await blacklist.getAllBlacklistedAddresses();
            expect(addresses).to.have.members([addr1.address, addr2.address]);
        });

        it("Should correctly handle removal from middle of list", async function () {
            // Add three addresses
            await blacklist.blacklistAddress(addr1.address);
            await blacklist.blacklistAddress(addr2.address);
            const addr3 = addrs[0];
            await blacklist.blacklistAddress(addr3.address);

            // Remove middle address
            await blacklist.removeFromBlacklist(addr2.address);

            // Check count
            expect(await blacklist.getBlacklistCount()).to.equal(2);

            // Check list
            const addresses = await blacklist.getAllBlacklistedAddresses();
            expect(addresses).to.have.members([addr1.address, addr3.address]);
            expect(await blacklist.isBlacklisted(addr2.address)).to.be.false;
        });

        it("Should maintain correct indices after multiple operations", async function () {
            // Add multiple addresses
            await blacklist.blacklistAddress(addr1.address);
            await blacklist.blacklistAddress(addr2.address);
            const addr3 = addrs[0];
            await blacklist.blacklistAddress(addr3.address);

            // Remove first address
            await blacklist.removeFromBlacklist(addr1.address);

            // Add it back
            await blacklist.blacklistAddress(addr1.address);

            // Verify final state
            expect(await blacklist.getBlacklistCount()).to.equal(3);
            const addresses = await blacklist.getAllBlacklistedAddresses();
            expect(addresses).to.have.members([addr2.address, addr3.address, addr1.address]);
        });
    });
});