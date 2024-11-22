import { ethers, waffle } from "hardhat"
import chai, { expect } from "chai"
import { solidity } from "ethereum-waffle";

import MockTokenArtifact from "../../artifacts/contracts/mock/MockToken.sol/MockToken.json";
import PrimeVestingArtifact from "../../artifacts/contracts/PrimeVesting.sol/PrimeVesting.json";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { fromWei, getFixedGasSigners, time, toWei } from "../_helpers";
import {
    MockToken,
    PrimeVesting
} from "../../typechain";
import { Contract } from "ethers";

chai.use(solidity);

const { deployContract } = waffle;
const ZERO = ethers.constants.AddressZero;

describe("Prime Vesting", () => {
    let owner: SignerWithAddress,
        user1: SignerWithAddress,
        user2: SignerWithAddress,
        user3: SignerWithAddress,
        keeper: SignerWithAddress,
        mockToken: Contract,
        vesting: Contract,
        startTime: number;

    before("Deploy Vesting contract", async () => {
        [owner, user1, user2, user3, keeper] = await getFixedGasSigners(10000000);

        mockToken = (await deployContract(owner, MockTokenArtifact, [[owner.address]])) as MockToken;

        startTime = Math.floor(Date.now() / 1000) + 20;

        vesting = (await deployContract(
            owner,
            PrimeVestingArtifact,
            [
                mockToken.address,
                startTime,
            ]
        )) as PrimeVesting;
    });

    it("should initialize the vesting contract", async () => {
        await vesting.initializeVesting(
            [
                user1.address,
                user2.address
            ],
            [
                {
                    cliffPeriod: time.duration.days(10),
                    vestingPeriod: time.duration.days(10),
                    grantClaimRightTo: ZERO,
                    totalAmount: toWei("1000"),
                },
                {
                    cliffPeriod: time.duration.days(10),
                    vestingPeriod: time.duration.days(20),
                    grantClaimRightTo: ZERO,
                    totalAmount: toWei("1500"),
                }
            ],
            false
        );

        expect(await vesting.totalAmount()).to.be.eq(toWei("2500"));
        expect(await vesting.vestingInitialized()).to.be.eq(false);
        await expect(vesting.connect(owner).sendTokensToVesting()).to.be.revertedWith("NotInitialized");

        await vesting.initializeVesting(
            [
                user3.address
            ],
            [
                {
                    cliffPeriod: time.duration.days(15),
                    vestingPeriod: time.duration.days(10),
                    grantClaimRightTo: user1.address,
                    totalAmount: toWei("2000"),
                }
            ],
            true
        );

        expect(await vesting.totalAmount()).to.be.eq(toWei("4500"));
        expect(await vesting.vestingInitialized()).to.be.eq(true);

        await expect(vesting.initializeVesting(
            [user3.address], [{cliffPeriod: time.duration.days(15), vestingPeriod: time.duration.days(10), grantClaimRightTo: user1.address,totalAmount: toWei("2000"),}],true
        )).to.be.revertedWith("AlreadyInitialized");

        await expect(vesting.connect(owner).sendTokensToVesting()).to.be.revertedWith("InsufficientAllowance");

        await mockToken.connect(owner).approve(vesting.address, toWei("10000"));
        await vesting.connect(owner).sendTokensToVesting();
        expect(await vesting.totalAmount()).to.be.eq(toWei("4500"));
        expect(await mockToken.balanceOf(vesting.address)).to.be.eq(toWei("4500"));
    });

    it("should not be able to claim during cliff period", async () => {
        const [claimable1, claimable2, claimable3] = await Promise.all([
            vesting.claimable(user1.address),
            vesting.claimable(user2.address),
            vesting.claimable(user3.address),
        ]);

        expect(fromWei(claimable1)).to.be.eq(0);
        expect(fromWei(claimable2)).to.be.eq(0);
        expect(fromWei(claimable3)).to.be.eq(0);

        await expect(vesting.connect(user1).claimWithAmount(toWei("9999"))).to.be.revertedWith("NothingToClaim");
    });

    it("should be able to claim after cliff period", async () => {
        await time.increase(time.duration.days(12));

        const [claimable1, claimable2, claimable3] = await Promise.all([
            vesting.claimable(user1.address),
            vesting.claimable(user2.address),
            vesting.claimable(user3.address),
        ]);

        expect(fromWei(claimable1)).to.be.closeTo(200, 1);
        expect(fromWei(claimable2)).to.be.closeTo(150, 1);
        expect(fromWei(claimable3)).to.be.eq(0);

        const beforeBalance1 = await mockToken.balanceOf(user1.address);
        const beforeBalance2 = await mockToken.balanceOf(user2.address);

        await vesting.connect(user1).claimWithAmount(claimable1.div(2));
        await vesting.connect(user2).claimWithAmount(toWei("9999"));

        const afterBalance1 = await mockToken.balanceOf(user1.address);
        const afterBalance2 = await mockToken.balanceOf(user2.address);

        expect(fromWei(afterBalance1) - fromWei(beforeBalance1)).to.be.closeTo(fromWei(claimable1.div(2)), 0.1);
        expect(fromWei(afterBalance2) - fromWei(beforeBalance2)).to.be.closeTo(fromWei(claimable2), 0.1);
    });

    it("should be able to claim on behalf of other user", async () => {
        await time.increase(time.duration.days(5));

        const [claimable1, claimable2, claimable3] = await Promise.all([
            vesting.claimable(user1.address),
            vesting.claimable(user2.address),
            vesting.claimable(user3.address),
        ]);

        expect(fromWei(claimable1)).to.be.gt(0);
        expect(fromWei(claimable2)).to.be.gt(0);
        expect(fromWei(claimable3)).to.be.gt(0);

        await expect(vesting.connect(user2).claimForWithAmount(user3.address, toWei("9999"))).to.be.revertedWith("Unauthorized");

        const beforeBalance = await mockToken.balanceOf(user3.address);

        await vesting.connect(user1).claimForWithAmount(user3.address, toWei("9999"));

        const afterBalance = await mockToken.balanceOf(user3.address);

        expect(fromWei(afterBalance) - fromWei(beforeBalance)).to.be.closeTo(fromWei(claimable3), 0.1);
    });

    it("should not claim more than allocated", async () => {
        await time.increase(time.duration.days(40));

        await vesting.connect(user1).claim();
        await vesting.connect(user2).claim();
        await vesting.connect(user3).claim();

        const afterBalance1 = await mockToken.balanceOf(user1.address);
        const afterBalance2 = await mockToken.balanceOf(user2.address);
        const afterBalance3 = await mockToken.balanceOf(user3.address);

        expect(fromWei(afterBalance1)).to.be.eq(1000);
        expect(fromWei(afterBalance2)).to.be.eq(1500);
        expect(fromWei(afterBalance3)).to.be.eq(2000);
    });
});
