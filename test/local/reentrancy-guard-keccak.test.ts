import {waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {syncTime} from "../_syncTime"
import {AntiReentrantDiamondStorage, ReentrantAttack} from "../../typechain";
import AntiReentrantDiamondStorageArtifact
    from '../../artifacts/contracts/mock/AntiReentrantDiamondStorage.sol/AntiReentrantDiamondStorage.json';
import ReentrantAttackArtifact from '../../artifacts/contracts/mock/ReentrantAttack.sol/ReentrantAttack.json';
import {getFixedGasSigners, toWei,} from "../_helpers";

chai.use(solidity);

const {deployContract, provider} = waffle;


describe('Reentrancy Guard Keccak Test', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('Attack contract, antireentrant keccak contract', () => {
        let anitReentranctContract: AntiReentrantDiamondStorage,
            reentrantAttackContract: ReentrantAttack,
            owner: SignerWithAddress;

        before("deploy attack & antireentrant contract", async () => {
            [owner] = await getFixedGasSigners(10000000);
            anitReentranctContract = await deployContract(owner, AntiReentrantDiamondStorageArtifact) as AntiReentrantDiamondStorage;
            reentrantAttackContract = await deployContract(owner, ReentrantAttackArtifact) as ReentrantAttack;

            await owner.sendTransaction({to: anitReentranctContract.address, value: toWei("21.37")});
        });

        it("should call antiReentrant method only once and receive 100 wei", async () => {
            let initialAVAXBalance = await provider.getBalance(reentrantAttackContract.address);

            await reentrantAttackContract.callAntiReentrant(anitReentranctContract.address);

            let currentAVAXBalance = await provider.getBalance(reentrantAttackContract.address);
            expect(currentAVAXBalance).to.be.equal(initialAVAXBalance.add(100));
        });

        it("should fail on calling antiReentrant method more than once", async () => {
            let initialAVAXBalance = await provider.getBalance(reentrantAttackContract.address);

            await reentrantAttackContract.changeTargetCallCount(2);
            await expect(reentrantAttackContract.callAntiReentrant(anitReentranctContract.address)).to.be.revertedWith("TransferHelper::safeTransferETH: ETH transfer failed");

            let currentAVAXBalance = await provider.getBalance(reentrantAttackContract.address);
            expect(currentAVAXBalance).to.be.equal(initialAVAXBalance);
        });
    });

});