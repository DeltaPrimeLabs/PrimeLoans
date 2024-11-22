import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import SmartLoanGigaChadInterfaceArtifact
    from '../../../artifacts/contracts/interfaces/SmartLoanGigaChadInterface.sol/SmartLoanGigaChadInterface.json';
import AddressProviderArtifact from '../../../artifacts/contracts/AddressProvider.sol/AddressProvider.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
    Asset,
    convertAssetsListToSupportedAssets,
    deployAllFacets,
    deployPools,
    getFixedGasSigners,
    PoolAsset,
    PoolInitializationObject,
    recompileConstantsFile,
    toBytes32,
    toWei,
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {AddressProvider, MockTokenManager, SmartLoansFactory} from "../../../typechain";
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';
import {Contract} from "ethers";

chai.use(solidity);

const {deployContract, provider} = waffle;

const ZERO = ethers.constants.AddressZero;

describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('Test ownership transfer flow', () => {
        let smartLoansFactory: SmartLoansFactory,
            loan: Contract,
            owner1: SignerWithAddress,
            owner2: SignerWithAddress,
            owner3: SignerWithAddress,
            owner4: SignerWithAddress,
            owner5: SignerWithAddress,
            owner6: SignerWithAddress,
            badGuy: SignerWithAddress,
            depositor: SignerWithAddress,
            diamondAddress: any,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>;

        before("deploy factory and pool", async () => {
            [owner1, owner2, owner3, owner4, owner5, owner6, badGuy, depositor] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]},
            ];

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner1, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner1, depositor);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList);

            let tokenManager = await deployContract(
                owner1,
                MockTokenManagerArtifact,
                []
            ) as MockTokenManager;

            await tokenManager.connect(owner1).initialize(supportedAssets, lendingPools);
            await tokenManager.connect(owner1).setFactoryAddress(smartLoansFactory.address);

            await smartLoansFactory.initialize(diamondAddress, tokenManager.address);

            let addressProvider = await deployContract(
                owner1,
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
        });

        it("should deploy a smart loan and check ownership", async () => {
            await smartLoansFactory.connect(owner1).createLoan();
            const loanProxyAddress = await smartLoansFactory.getLoanForOwner(owner1.address);
            loan = new ethers.Contract(loanProxyAddress, SmartLoanGigaChadInterfaceArtifact.abi, provider);

            expect(await loan.owner()).to.equal(owner1.address);
            expect(await loan.proposedOwner()).to.equal(ZERO);
            await expect(loan.connect(badGuy).borrow(toBytes32("AVAX"), toWei("1"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");

            expect(await smartLoansFactory.ownersToLoans(owner1.address)).to.equal(loan.address);
            expect(await smartLoansFactory.loansToOwners(loan.address)).to.equal(owner1.address);
        });

        it("Propose ownership transfer", async () => {
            await expect(loan.connect(badGuy).proposeOwnershipTransfer(owner2.address)).to.be.revertedWith("DiamondStorageLib: Must be contract owner");

            await loan.connect(owner1).proposeOwnershipTransfer(owner2.address);

            expect(await loan.owner()).to.equal(owner1.address);
            expect(await loan.proposedOwner()).to.equal(owner2.address);
            await expect(loan.connect(badGuy).borrow(toBytes32("AVAX"), toWei("1"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(loan.connect(owner1).borrow(toBytes32("AVAX"), toWei("1"))).to.be.revertedWith("CalldataMustHaveValidPayload()");
            await expect(loan.connect(owner2).borrow(toBytes32("AVAX"), toWei("1"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");

            expect(await smartLoansFactory.ownersToLoans(owner1.address)).to.equal(loan.address);
            expect(await smartLoansFactory.loansToOwners(loan.address)).to.equal(owner1.address);
        });

        it("Accept ownership", async () => {
            await expect(loan.connect(badGuy).acceptOwnership()).to.be.revertedWith("Only a proposed user can accept ownership");

            await loan.connect(owner2).acceptOwnership();

            expect(await loan.owner()).to.equal(owner2.address);
            expect(await loan.proposedOwner()).to.equal(ZERO);

            await expect(loan.connect(badGuy).borrow(toBytes32("AVAX"), toWei("1"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(loan.connect(owner1).borrow(toBytes32("AVAX"), toWei("1"))).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
            await expect(loan.connect(owner2).borrow(toBytes32("AVAX"), toWei("1"))).to.be.revertedWith("CalldataMustHaveValidPayload()");

            expect(await smartLoansFactory.ownersToLoans(owner2.address)).to.equal(loan.address);
            expect(await smartLoansFactory.loansToOwners(loan.address)).to.equal(owner2.address);

            expect(await smartLoansFactory.ownersToLoans(owner1.address)).to.equal(ZERO);
        });

        it("Change proposed ownership two times", async () => {
            await loan.connect(owner2).proposeOwnershipTransfer(owner3.address);

            expect(await loan.owner()).to.equal(owner2.address);
            expect(await loan.proposedOwner()).to.equal(owner3.address);

            await loan.connect(owner2).proposeOwnershipTransfer(owner4.address);

            expect(await loan.owner()).to.equal(owner2.address);
            expect(await loan.proposedOwner()).to.equal(owner4.address);

            await expect(loan.connect(owner3).acceptOwnership()).to.be.revertedWith("Only a proposed user can accept ownership");
            await loan.connect(owner4).acceptOwnership();

            expect(await loan.owner()).to.equal(owner4.address);
        });

        it("Propose zero address (remove proposal)", async () => {
            await loan.connect(owner4).proposeOwnershipTransfer(owner5.address);
            await loan.connect(owner4).proposeOwnershipTransfer(ZERO);

            await expect(loan.connect(owner5).acceptOwnership()).to.be.revertedWith("Only a proposed user can accept ownership");


            expect(await loan.owner()).to.equal(owner4.address);
            expect(await loan.proposedOwner()).to.equal(ZERO);
        });

        it("Propose zero address (remove proposal)", async () => {
            await loan.connect(owner4).proposeOwnershipTransfer(owner5.address);
            await loan.connect(owner4).proposeOwnershipTransfer(ZERO);

            await expect(loan.connect(owner5).acceptOwnership()).to.be.revertedWith("Only a proposed user can accept ownership");


            expect(await loan.owner()).to.equal(owner4.address);
            expect(await loan.proposedOwner()).to.equal(ZERO);
        });

        it("Revert proposal of an address that has a loan", async () => {
            await smartLoansFactory.connect(owner5).createLoan();

            await expect(loan.connect(owner4).proposeOwnershipTransfer(owner5.address)).to.be.revertedWith("Can't propose an address that already has a loan");
        });

        it("Revert acceptance of ownership transfer to an address that created a loan in the meantime", async () => {
            await loan.connect(owner4).proposeOwnershipTransfer(owner6.address)

            await smartLoansFactory.connect(owner6).createLoan();

            await expect(loan.connect(owner6).acceptOwnership()).to.be.revertedWith("New owner already has a loan");
        });
    });
});

