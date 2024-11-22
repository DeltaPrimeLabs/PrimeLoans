import chai from 'chai'
import {solidity} from "ethereum-waffle";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {deployAllFacets, getFixedGasSigners} from "../_helpers";
import {DiamondCutFacet, OwnershipFacet, SmartLoanDiamondBeacon} from "../../typechain";

const {replaceFacet} = require('../../tools/diamond/deploy-diamond.js');
const {ethers} = require("hardhat");
const { getSelectors, FacetCutAction } = require('../../tools/diamond/selectors.js')

chai.use(solidity);

const {expect} = chai;

describe('SmartLoanDiamondBeacon transfer ownership', () => {

    describe('Test - transfer ownership', () => {
        let diamondBeacon: SmartLoanDiamondBeacon,
        diamondCut: DiamondCutFacet,
        diamondCut1: DiamondCutFacet,
        diamondCutInterface: DiamondCutFacet,
        ownershipFacet: OwnershipFacet,
        owner: SignerWithAddress,
        newOwner: SignerWithAddress,
        pauseAdmin: SignerWithAddress,
        other: SignerWithAddress;

        before("deploy the diamond beacon and facets", async () => {
            [owner, newOwner, pauseAdmin, other] = await getFixedGasSigners(10000000);

            const diamondCutFacetFactory = await ethers.getContractFactory('DiamondCutFacet');
            const diamondBeaconFactory = await ethers.getContractFactory('SmartLoanDiamondBeacon');

            diamondCut = await diamondCutFacetFactory.deploy()
            await diamondCut.deployed();

            diamondCut1 = await diamondCutFacetFactory.deploy()
            await diamondCut1.deployed();

            diamondBeacon = await diamondBeaconFactory.deploy(owner.address, diamondCut.address);
            await diamondBeacon.deployed();

            diamondCutInterface = await ethers.getContractAt('IDiamondCut', diamondBeacon.address, owner);
            await diamondCutInterface.unpause();

            ownershipFacet = await ethers.getContractAt("IOwnershipFacet", diamondBeacon.address, owner);

            await deployAllFacets(diamondBeacon.address);
        });

        it("should check current owner and pauseAdmin", async () => {
            expect(await ownershipFacet.owner()).to.be.equal(owner.address);
            expect(await ownershipFacet.pauseAdmin()).to.be.equal(owner.address);
        });

        it("should fail to propose a new pauseAdmin as the non-pauseAdmin", async () => {
            // At this point the pauseOwner == `owner`
            await expect(diamondBeacon.connect(pauseAdmin).proposeBeaconPauseAdminOwnershipTransfer(pauseAdmin.address)).to.be.revertedWith("DiamondStorageLib: Must be contract pauseAdmin");
        });

        it("should fail to accept a non-existing proposal", async () => {
            await expect(diamondBeacon.connect(pauseAdmin).acceptBeaconPauseAdminOwnership()).to.be.revertedWith("Only a proposed user can accept ownership");
        });

        it("should propose a new pauseAdmin as pauseAdmin", async () => {
            expect(await ownershipFacet.pauseAdmin()).to.be.equal(owner.address);
            expect(await ownershipFacet.proposedPauseAdmin()).to.be.equal(ethers.constants.AddressZero);

            await diamondBeacon.connect(owner).proposeBeaconPauseAdminOwnershipTransfer(pauseAdmin.address);

            expect(await ownershipFacet.owner()).to.be.equal(owner.address);
            expect(await ownershipFacet.proposedPauseAdmin()).to.be.equal(pauseAdmin.address);
        });

        it("should fail to accept an existing proposal as not the pauseAdmin user", async () => {
            await expect(diamondBeacon.connect(other).acceptBeaconPauseAdminOwnership()).to.be.revertedWith("Only a proposed user can accept ownership");
        });

        it("should fail to perform diamondCut as the pending pauseAdmin", async () => {
            await diamondCutInterface.pause();
            await expect(diamondCutInterface.connect(pauseAdmin).diamondCut(
                [{
                    facetAddress: diamondCut.address,
                    action: FacetCutAction.Replace,
                    functionSelectors: getSelectors(diamondCut).get(['diamondCut'])
                }],
                ethers.constants.AddressZero,
                []
            )).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await diamondCutInterface.unpause();
        });

        it("should fail to perform pause/unpause as the pending pauseAdmin", async () => {
            await expect(diamondCutInterface.connect(pauseAdmin).pause()).to.be.revertedWith("DiamondStorageLib: Must be contract pauseAdmin");
            await expect(diamondCutInterface.connect(pauseAdmin).unpause()).to.be.revertedWith("DiamondStorageLib: Must be contract pauseAdmin");
        });

        it("should accept an existing proposal as the pauseAdmin", async () => {
            expect(await ownershipFacet.pauseAdmin()).to.be.equal(owner.address);
            expect(await ownershipFacet.proposedPauseAdmin()).to.be.equal(pauseAdmin.address);

            await diamondBeacon.connect(pauseAdmin).acceptBeaconPauseAdminOwnership();

            expect(await ownershipFacet.pauseAdmin()).to.be.equal(pauseAdmin.address);
            expect(await ownershipFacet.proposedPauseAdmin()).to.be.equal(ethers.constants.AddressZero);
        });

        it("should perform pause/unpause as the pauseAdmin", async () => {
            await diamondCutInterface.connect(pauseAdmin).pause();
            await diamondCutInterface.connect(pauseAdmin).unpause();
        });

        it("should fail to perform diamondCut as the pauseAdmin", async () => {
            await diamondCutInterface.connect(pauseAdmin).pause();
            await expect(diamondCutInterface.connect(pauseAdmin).diamondCut(
                [{
                    facetAddress: diamondCut.address,
                    action: FacetCutAction.Replace,
                    functionSelectors: getSelectors(diamondCut).get(['diamondCut'])
                }],
                ethers.constants.AddressZero,
                []
            )).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await diamondCutInterface.connect(pauseAdmin).unpause();
        });

        it("should check current owner and pauseAdmin", async () => {
            expect(await ownershipFacet.owner()).to.be.equal(owner.address);
            expect(await ownershipFacet.proposedOwner()).to.be.equal(ethers.constants.AddressZero);
            expect(await ownershipFacet.pauseAdmin()).to.be.equal(pauseAdmin.address);
            expect(await ownershipFacet.proposedPauseAdmin()).to.be.equal(ethers.constants.AddressZero);
        });

        it("should perform diamondCut as the owner", async () => {
            await diamondCutInterface.connect(pauseAdmin).pause();
            await diamondCutInterface.diamondCut(
                [{
                    facetAddress: diamondCut1.address,
                    action: FacetCutAction.Replace,
                    functionSelectors: getSelectors(diamondCut).get(['diamondCut'])
                }],
                ethers.constants.AddressZero,
                []
            );
            await diamondCutInterface.connect(pauseAdmin).unpause();
        });

        it("should fail to pause as the non-owner", async () => {
            await expect(diamondCutInterface.connect(newOwner).pause()).to.be.revertedWith("DiamondStorageLib: Must be contract pauseAdmin");
        });

        it("should fail to perform diamondCut as the non-owner", async () => {
            await diamondCutInterface.connect(pauseAdmin).pause();
            await expect(diamondCutInterface.connect(newOwner).diamondCut(
                [{
                    facetAddress: diamondCut.address,
                    action: FacetCutAction.Replace,
                    functionSelectors: getSelectors(diamondCut).get(['diamondCut'])
                }],
                ethers.constants.AddressZero,
                []
            )).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await diamondCutInterface.connect(pauseAdmin).unpause();
        });

        it("should fail to propose a new owner as the non-owner", async () => {
            await expect(diamondBeacon.connect(newOwner).proposeBeaconOwnershipTransfer(newOwner.address)).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to accept a non-existing proposal", async () => {
            await expect(diamondBeacon.connect(newOwner).acceptBeaconOwnership()).to.be.revertedWith("Only a proposed user can accept ownership");
        });

        it("should propose a new owner as owner", async () => {
            expect(await ownershipFacet.owner()).to.be.equal(owner.address);
            expect(await ownershipFacet.proposedOwner()).to.be.equal(ethers.constants.AddressZero);

            await diamondBeacon.proposeBeaconOwnershipTransfer(newOwner.address);

            expect(await ownershipFacet.owner()).to.be.equal(owner.address);
            expect(await ownershipFacet.proposedOwner()).to.be.equal(newOwner.address);
        });

        it("should fail to accept an existing proposal as not the newOwner user", async () => {
            await expect(diamondBeacon.connect(other).acceptBeaconOwnership()).to.be.revertedWith("Only a proposed user can accept ownership");
        });

        it("should fail to perform diamondCut as the pending newOwner", async () => {
            await diamondCutInterface.connect(pauseAdmin).pause();
            await expect(diamondCutInterface.connect(newOwner).diamondCut(
                [{
                    facetAddress: diamondCut.address,
                    action: FacetCutAction.Replace,
                    functionSelectors: getSelectors(diamondCut).get(['diamondCut'])
                }],
                ethers.constants.AddressZero,
                []
            )).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await diamondCutInterface.connect(pauseAdmin).unpause();
        });

        it("should accept an existing proposal as the newOwner", async () => {
            expect(await ownershipFacet.owner()).to.be.equal(owner.address);
            expect(await ownershipFacet.proposedOwner()).to.be.equal(newOwner.address);

            await diamondBeacon.connect(newOwner).acceptBeaconOwnership();

            expect(await ownershipFacet.owner()).to.be.equal(newOwner.address);
            expect(await ownershipFacet.proposedOwner()).to.be.equal(ethers.constants.AddressZero);
        });

        it("should fail to pause as the old owner", async () => {
            await expect(diamondCutInterface.connect(owner).pause()).to.be.revertedWith("DiamondStorageLib: Must be contract pauseAdmin");
        });

        it("should fail to perform diamondCut as the old owner", async () => {
            await diamondCutInterface.connect(pauseAdmin).pause();
            await expect(diamondCutInterface.connect(owner).diamondCut(
                [{
                    facetAddress: diamondCut.address,
                    action: FacetCutAction.Replace,
                    functionSelectors: getSelectors(diamondCut).get(['diamondCut'])
                }],
                ethers.constants.AddressZero,
                []
            )).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await diamondCutInterface.connect(pauseAdmin).unpause();
        });

        it("should perform diamondCut as the new owner", async () => {
            await diamondCutInterface.connect(pauseAdmin).pause();
            await diamondCutInterface.connect(newOwner).diamondCut(
                [{
                    facetAddress: diamondCut.address,
                    action: FacetCutAction.Replace,
                    functionSelectors: getSelectors(diamondCut).get(['diamondCut'])
                }],
                ethers.constants.AddressZero,
                []
            );
            await diamondCutInterface.connect(pauseAdmin).unpause();
        });
    });
});

