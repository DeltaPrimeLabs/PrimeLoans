import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import PoolArtifact from '../../artifacts/contracts/Pool.sol/Pool.json';
import DepositRewarderNativeArtifact from '../../artifacts/contracts/DepositRewarderNative.sol/DepositRewarderNative.json';
import MockTokenArtifact from "../../artifacts/contracts/mock/MockToken.sol/MockToken.json";
import VariableUtilisationRatesCalculatorArtifact
    from '../../artifacts/contracts/mock/MockVariableUtilisationRatesCalculator.sol/MockVariableUtilisationRatesCalculator.json';
import LinearIndexArtifact from '../../artifacts/contracts/LinearIndex.sol/LinearIndex.json';
import OpenBorrowersRegistryArtifact
    from '../../artifacts/contracts/mock/OpenBorrowersRegistry.sol/OpenBorrowersRegistry.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {fromWei, getFixedGasSigners, time, toWei} from "../_helpers";
import {
    LinearIndex,
    MockToken,
    OpenBorrowersRegistry,
    Pool,
    DepositRewarderNative,
    MockVariableUtilisationRatesCalculator
} from "../../typechain";
import {Contract} from "ethers";


chai.use(solidity);

const {deployContract, provider} = waffle;

describe('Pool with variable utilisation interest rates and rewards', () => {
    describe('Depositing only (multiple depositors)', () => {
        let pool: Pool,
            rewarder: DepositRewarderNative,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            depositor1: SignerWithAddress,
            depositor2: SignerWithAddress,
            depositor3: SignerWithAddress,
            poolToken: Contract,
            MockVariableUtilisationRatesCalculator: MockVariableUtilisationRatesCalculator;

        before("Deploy Pool & DepositRewarderNative contracts", async () => {
            [owner, depositor, depositor1, depositor2, depositor3] = await getFixedGasSigners(10000000);
            // Deploy Pool
            pool = (await deployContract(owner, PoolArtifact)) as Pool;

            // Deploy tokens
            poolToken = (await deployContract(owner, MockTokenArtifact, [[depositor1.address, depositor2.address, depositor3.address]])) as MockToken;

            // Deploy and initialize rewarder
            rewarder = (await deployContract(owner, DepositRewarderNativeArtifact, [pool.address])) as DepositRewarderNative;

            MockVariableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as MockVariableUtilisationRatesCalculator;
            const borrowersRegistry = (await deployContract(owner, OpenBorrowersRegistryArtifact)) as OpenBorrowersRegistry;
            const depositIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
            await depositIndex.initialize(pool.address);
            const borrowingIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
            await borrowingIndex.initialize(pool.address);

            await pool.initialize(
                MockVariableUtilisationRatesCalculator.address,
                borrowersRegistry.address,
                depositIndex.address,
                borrowingIndex.address,
                poolToken.address,
                rewarder.address,
                0
            );
        });

        it("should successfully set the duration target", async () => {
            await rewarder.setRewardsDuration(time.duration.days(360));
        });

        it("should deposit (depositor1, depositor2)", async () => {
            // Deposit to pool DEPOSITOR1 -> +10.0
            await poolToken.connect(depositor1).approve(pool.address, toWei("10.0"));
            await pool.connect(depositor1).deposit(toWei("10.0"));
            expect(await pool.balanceOf(depositor1.address)).to.equal(toWei("10.0"));

            // Deposit to pool DEPOSITOR2 -> +10.0
            await poolToken.connect(depositor2).approve(pool.address, toWei("10.0"));
            await pool.connect(depositor2).deposit(toWei("10.0"));
            expect(await pool.balanceOf(depositor2.address)).to.equal(toWei("10.0"));
        });

        it("should initialize rewarder", async () => {
            await rewarder.addDeposits([depositor1.address, depositor2.address]);
            expect(await rewarder.balanceOf(depositor1.address)).to.equal(toWei("10.0"));
            expect(await rewarder.balanceOf(depositor2.address)).to.equal(toWei("10.0"));
        });

        it("should set up rewards rewarder contract", async () => {
            expect(await rewarder.rewardRate()).to.be.equal(0);
            await rewarder.notifyRewardAmount({ value: toWei("100") });
            expect(await rewarder.rewardRate()).to.be.equal(toWei("100").div(time.duration.days(360)));
        });

        it("should fail to set a new duration during an ongoing one", async () => {
            await expect(rewarder.setRewardsDuration(time.duration.days(1))).to.be.revertedWith("reward duration not finished");
        });

        it("should fail to deposit / withdraw as a non-pool EOA", async () => {
            await expect(rewarder.stakeFor(1, owner.address)).to.be.revertedWith("Unauthorized");
            await expect(rewarder.withdrawFor(1, owner.address)).to.be.revertedWith("Unauthorized");
        });

        it("[360 days] should deposit (depositor1) to pool + depositor2 via transfer and check rewards after some time", async () => {
            expect(await provider.getBalance(rewarder.address)).to.be.equal(toWei("100"));
            // Deposit to pool DEPOSITOR1 -> +10.0
            await poolToken.connect(depositor1).approve(pool.address, toWei("10.0"));
            await pool.connect(depositor1).deposit(toWei("10.0"));
            expect(await pool.balanceOf(depositor1.address)).to.equal(toWei("20.0"));
            expect(await pool.balanceOf(depositor2.address)).to.equal(toWei("10.0"));

            // check rewards
            expect(fromWei(await pool.connect(depositor1).checkRewards())).to.be.closeTo(0, 1e-3);
            expect(fromWei(await pool.connect(depositor2).checkRewards())).to.be.closeTo(0, 1e-3);

            // FastForward 180 days ahead (+180 days in total)
            await time.increase(time.duration.days(180));
            // check rewards
            expect(fromWei(await pool.connect(depositor1).checkRewards())).to.be.closeTo(33.333, 1e-3);
            expect(fromWei(await pool.connect(depositor2).checkRewards())).to.be.closeTo(16.666, 1e-3);

            // FastForward 90 days ahead (+270 days in total)
            await time.increase(time.duration.days(90));
            // check rewards
            expect(fromWei(await pool.connect(depositor1).checkRewards())).to.be.closeTo(50, 1e-3);
            expect(fromWei(await pool.connect(depositor2).checkRewards())).to.be.closeTo(25, 1e-3);

            // Transfer deposited funds from borrower1 to borrower2
            await pool.connect(depositor1).transfer(depositor2.address, toWei("5"));
            // FastForward 90 days ahead (360 days in total)
            await time.increase(time.duration.days(90));
            // check rewards
            expect(fromWei(await pool.connect(depositor1).checkRewards())).to.be.closeTo(62.5, 1e-3);
            expect(fromWei(await pool.connect(depositor2).checkRewards())).to.be.closeTo(37.5, 1e-3);

            // claim rewards
            let initialRewardTokenBalance = fromWei(await provider.getBalance(depositor1.address));
            let initialRewardTokenBalance2 = fromWei(await provider.getBalance(depositor2.address));
            await pool.connect(depositor1).getRewards();
            expect(fromWei(await provider.getBalance(depositor1.address)) - initialRewardTokenBalance).to.be.closeTo(62.5, 1e-3);
            expect(fromWei(await provider.getBalance(depositor2.address)) - initialRewardTokenBalance2).to.be.closeTo(0, 1e-3);

            await pool.connect(depositor1).withdraw(toWei("15.0"));
            expect(fromWei(await provider.getBalance(rewarder.address))).to.be.closeTo(37.5, 1e-3);

            await pool.connect(depositor2).getRewards();
            expect(fromWei(await provider.getBalance(depositor2.address)) - initialRewardTokenBalance2).to.be.closeTo(37.5, 1e-3);
            expect(fromWei(await provider.getBalance(rewarder.address))).to.be.closeTo(0, 1e-3);
            await pool.connect(depositor2).withdraw(toWei("15.0"));
        });

        it("should successfully set a new duration target and add rewards", async () => {
            expect(fromWei(await provider.getBalance(rewarder.address))).to.be.closeTo(0, 1e-3);
            await rewarder.setRewardsDuration(time.duration.days(180));
            await rewarder.notifyRewardAmount({ value: toWei("100") });
        });

        it("[180 days] should deposit (depositor1, 2 & 3) to pool and check rewards after some time", async () => {
            expect(fromWei(await provider.getBalance(rewarder.address))).to.be.closeTo(100, 1e-3);

            // check rewards
            expect(await pool.connect(depositor1).checkRewards()).to.be.equal(0);
            expect(await pool.connect(depositor2).checkRewards()).to.be.equal(0);
            expect(await pool.connect(depositor3).checkRewards()).to.be.equal(0);

            // Deposit to pool DEPOSITOR1 -> +10.0
            await poolToken.connect(depositor1).approve(pool.address, toWei("10.0"));
            await pool.connect(depositor1).deposit(toWei("10.0"));

            // FastForward 90 days ahead (+90 days in total)
            await time.increase(time.duration.days(90));
            // check rewards
            expect(fromWei(await pool.connect(depositor1).checkRewards())).to.be.closeTo(50, 1e-3);
            expect(await pool.connect(depositor2).checkRewards()).to.be.equal(0);
            expect(await pool.connect(depositor3).checkRewards()).to.be.equal(0);

            // Deposit to pool DEPOSITOR2 -> +5.0
            await poolToken.connect(depositor2).approve(pool.address, toWei("5.0"));
            await pool.connect(depositor2).deposit(toWei("5.0"));

            // Deposit to pool DEPOSITOR3 -> +5.0
            await poolToken.connect(depositor3).approve(pool.address, toWei("5.0"));
            await pool.connect(depositor3).deposit(toWei("5.0"));

            // FastForward 45 days ahead (+135 days in total)
            await time.increase(time.duration.days(45));
            // check rewards
            await pool.connect(depositor1).checkRewards();
            await pool.connect(depositor2).checkRewards();
            await pool.connect(depositor3).checkRewards();
            expect(fromWei(await pool.connect(depositor1).checkRewards())).to.be.closeTo(62.5, 1e-3);
            expect(fromWei(await pool.connect(depositor2).checkRewards())).to.be.closeTo(6.25, 1e-3);
            expect(fromWei(await pool.connect(depositor3).checkRewards())).to.be.closeTo(6.25, 1e-3);

            // FastForward 45 days ahead (+180 days in total)
            await time.increase(time.duration.days(45));
            // check rewards
            expect(fromWei(await pool.connect(depositor1).checkRewards())).to.be.closeTo(75, 1e-3);
            expect(fromWei(await pool.connect(depositor2).checkRewards())).to.be.closeTo(12.5, 1e-3);
            expect(fromWei(await pool.connect(depositor3).checkRewards())).to.be.closeTo(12.5, 1e-3);

            // claim rewards
            let initialAvaxBalance1 = fromWei(await provider.getBalance(depositor1.address));
            let initialAvaxBalance2 = fromWei(await provider.getBalance(depositor2.address));
            let initialAvaxBalance3 = fromWei(await provider.getBalance(depositor3.address));
            await pool.connect(depositor1).getRewards();
            await pool.connect(depositor2).getRewards();
            await pool.connect(depositor3).getRewards();
            expect(fromWei(await provider.getBalance(depositor1.address)) - initialAvaxBalance1).to.be.closeTo(75, 1e-3);
            expect(fromWei(await provider.getBalance(depositor2.address)) - initialAvaxBalance2).to.be.closeTo(12.5, 1e-3);
            expect(fromWei(await provider.getBalance(depositor3.address)) - initialAvaxBalance3).to.be.closeTo(12.5, 1e-3);

            expect(fromWei(await provider.getBalance(rewarder.address))).to.be.closeTo(0, 1e-3);
        });
    });

    describe('Depositing and withdrawing (multiple depositors)', () => {
        let pool: Pool,
            rewarder: DepositRewarderNative,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            depositor1: SignerWithAddress,
            depositor2: SignerWithAddress,
            depositor3: SignerWithAddress,
            poolToken: Contract,
            MockVariableUtilisationRatesCalculator: MockVariableUtilisationRatesCalculator;

        before("Deploy Pool & DepositRewarderNative contracts", async () => {
            [owner, depositor, depositor1, depositor2, depositor3] = await getFixedGasSigners(10000000);
            // Deploy Pool
            pool = (await deployContract(owner, PoolArtifact)) as Pool;

            // Deploy tokens
            poolToken = (await deployContract(owner, MockTokenArtifact, [[depositor1.address, depositor2.address, depositor3.address]])) as MockToken;

            // Deploy and initialize rewarder
            rewarder = (await deployContract(owner, DepositRewarderNativeArtifact, [pool.address])) as DepositRewarderNative;

            MockVariableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as MockVariableUtilisationRatesCalculator;
            const borrowersRegistry = (await deployContract(owner, OpenBorrowersRegistryArtifact)) as OpenBorrowersRegistry;
            const depositIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
            await depositIndex.initialize(pool.address);
            const borrowingIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
            await borrowingIndex.initialize(pool.address);

            await pool.initialize(
                MockVariableUtilisationRatesCalculator.address,
                borrowersRegistry.address,
                depositIndex.address,
                borrowingIndex.address,
                poolToken.address,
                rewarder.address,
                0
            );
        });

        it("should successfully set the duration target", async () => {
            await rewarder.setRewardsDuration(time.duration.days(360));
        });

        it("should set up rewards rewarder contract", async () => {
            expect(await rewarder.rewardRate()).to.be.equal(0);
            await rewarder.notifyRewardAmount({ value: toWei("100") });
            expect(await rewarder.rewardRate()).to.be.equal(toWei("100").div(time.duration.days(360)));
        });

        it("[360 days] should deposit (depositor1) to pool and check rewards after some time", async () => {
            expect(await provider.getBalance(rewarder.address)).to.be.equal(toWei("100"));
            // Deposit to pool DEPOSITOR1 -> +10.0
            await poolToken.connect(depositor1).approve(pool.address, toWei("10.0"));
            await pool.connect(depositor1).deposit(toWei("10.0"));

            // check rewards
            expect(await pool.connect(depositor1).checkRewards()).to.be.equal(0);

            // FastForward 180 days ahead (+180 days in total)
            await time.increase(time.duration.days(180));
            // check rewards
            expect(fromWei(await pool.connect(depositor1).checkRewards())).to.be.closeTo(50, 1e-3);

            // FastForward 90 days ahead (+270 days in total)
            await time.increase(time.duration.days(90));
            // check rewards
            expect(fromWei(await pool.connect(depositor1).checkRewards())).to.be.closeTo(75, 1e-3);

            // Withdraw everything
            let initialAvaxBalance = fromWei(await provider.getBalance(depositor1.address));
            await pool.connect(depositor1).withdraw(toWei("10.0"));
            await pool.connect(depositor1).getRewards();
            expect(fromWei(await provider.getBalance(depositor1.address)) - initialAvaxBalance).to.be.closeTo(75, 1e-3);
            expect(fromWei(await pool.connect(depositor1).checkRewards())).to.be.equal(0);


            // FastForward 90 days ahead (360 days in total)
            await time.increase(time.duration.days(90));
            // check rewards
            expect(fromWei(await pool.connect(depositor1).checkRewards())).to.be.equal(0);

            expect(fromWei(await provider.getBalance(rewarder.address))).to.be.closeTo(25, 1e-3);
        });

        it("should successfully set a new duration target and add rewards", async () => {
            expect(fromWei(await provider.getBalance(rewarder.address))).to.be.closeTo(25, 1e-3);
            await rewarder.setRewardsDuration(time.duration.days(180));
            await rewarder.notifyRewardAmount({ value: toWei("100") });
        });

        it("[180 days] should deposit (depositor1, 2 & 3) to pool and check rewards after some time", async () => {
            expect(fromWei(await provider.getBalance(rewarder.address))).to.be.closeTo(125, 1e-3);

            // check rewards
            expect(await pool.connect(depositor1).checkRewards()).to.be.equal(0);
            expect(await pool.connect(depositor2).checkRewards()).to.be.equal(0);
            expect(await pool.connect(depositor3).checkRewards()).to.be.equal(0);

            // Deposit to pool DEPOSITOR1 -> +10.0
            await poolToken.connect(depositor1).approve(pool.address, toWei("10.0"));
            await pool.connect(depositor1).deposit(toWei("10.0"));

            // FastForward 90 days ahead (+90 days in total)
            await time.increase(time.duration.days(90));
            // check rewards
            expect(fromWei(await pool.connect(depositor1).checkRewards())).to.be.closeTo(50, 1e-3);
            expect(await pool.connect(depositor2).checkRewards()).to.be.equal(0);
            expect(await pool.connect(depositor3).checkRewards()).to.be.equal(0);

            // Depositor 1 withdraw all
            await pool.connect(depositor1).withdraw(toWei("10.0"));
            await pool.connect(depositor1).getRewards();

            // Deposit to pool DEPOSITOR2 -> +5.0
            await poolToken.connect(depositor2).approve(pool.address, toWei("5.0"));
            await pool.connect(depositor2).deposit(toWei("5.0"));

            // Deposit to pool DEPOSITOR3 -> +5.0
            await poolToken.connect(depositor3).approve(pool.address, toWei("5.0"));
            await pool.connect(depositor3).deposit(toWei("5.0"));

            // FastForward 45 days ahead (+135 days in total)
            await time.increase(time.duration.days(45));
            // check rewards
            await pool.connect(depositor1).checkRewards();
            await pool.connect(depositor2).checkRewards();
            await pool.connect(depositor3).checkRewards();
            expect(fromWei(await pool.connect(depositor1).checkRewards())).to.be.equal(0);
            expect(fromWei(await pool.connect(depositor2).checkRewards())).to.be.closeTo(12.5, 1e-3);
            expect(fromWei(await pool.connect(depositor3).checkRewards())).to.be.closeTo(12.5, 1e-3);

            // FastForward 45 days ahead (+180 days in total)
            await time.increase(time.duration.days(45));
            // check rewards
            expect(fromWei(await pool.connect(depositor1).checkRewards())).to.be.equal(0);
            expect(fromWei(await pool.connect(depositor2).checkRewards())).to.be.closeTo(25, 1e-3);
            expect(fromWei(await pool.connect(depositor3).checkRewards())).to.be.closeTo(25, 1e-3);

            // claim rewards
            let initialAvaxBalance1 = fromWei(await provider.getBalance(depositor1.address));
            let initialAvaxBalance2 = fromWei(await provider.getBalance(depositor2.address));
            let initialAvaxBalance3 = fromWei(await provider.getBalance(depositor3.address));
            await pool.connect(depositor1).getRewards();
            await pool.connect(depositor2).getRewards();
            await pool.connect(depositor3).getRewards();
            expect(fromWei(await provider.getBalance(depositor1.address)) - initialAvaxBalance1).to.be.closeTo(0, 1e-3);
            expect(fromWei(await provider.getBalance(depositor2.address)) - initialAvaxBalance2).to.be.closeTo(25, 1e-3);
            expect(fromWei(await provider.getBalance(depositor3.address)) - initialAvaxBalance3).to.be.closeTo(25, 1e-3);

            expect(fromWei(await provider.getBalance(rewarder.address))).to.be.closeTo(25, 1e-3);
        });
    });

    describe('Depositing and withdrawing (multiple depositors)', () => {
        let pool: Pool,
            rewarder: DepositRewarderNative,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            depositor1: SignerWithAddress,
            depositor2: SignerWithAddress,
            depositor3: SignerWithAddress,
            poolToken: Contract,
            MockVariableUtilisationRatesCalculator: MockVariableUtilisationRatesCalculator;

        before("Deploy Pool & DepositRewarderNative contracts", async () => {
            [owner, depositor, depositor1, depositor2, depositor3] = await getFixedGasSigners(10000000);
            // Deploy Pool
            pool = (await deployContract(owner, PoolArtifact)) as Pool;

            // Deploy tokens
            poolToken = (await deployContract(owner, MockTokenArtifact, [[depositor1.address, depositor2.address, depositor3.address]])) as MockToken;

            // Deploy and initialize rewarder
            rewarder = (await deployContract(owner, DepositRewarderNativeArtifact, [pool.address])) as DepositRewarderNative;

            MockVariableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as MockVariableUtilisationRatesCalculator;
            const borrowersRegistry = (await deployContract(owner, OpenBorrowersRegistryArtifact)) as OpenBorrowersRegistry;
            const depositIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
            await depositIndex.initialize(pool.address);
            const borrowingIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
            await borrowingIndex.initialize(pool.address);

            await pool.initialize(
                MockVariableUtilisationRatesCalculator.address,
                borrowersRegistry.address,
                depositIndex.address,
                borrowingIndex.address,
                poolToken.address,
                rewarder.address,
                0
            );
        });

        it("should successfully set the duration target", async () => {
            await rewarder.setRewardsDuration(time.duration.days(360));
        });

        it("should set up rewards rewarder contract", async () => {
            expect(await rewarder.rewardRate()).to.be.equal(0);
            await rewarder.notifyRewardAmount({ value: toWei("100") });
            expect(await rewarder.rewardRate()).to.be.equal(toWei("100").div(time.duration.days(360)));
        });

        it("[360 days] should deposit (depositor1) to pool, borrow, transfer more than initial deposit (because of accumulated interest)", async () => {
            expect(await provider.getBalance(rewarder.address)).to.be.equal(toWei("100"));
            // Deposit to pool DEPOSITOR1 -> +10.0
            await poolToken.connect(depositor1).approve(pool.address, toWei("10.0"));
            await pool.connect(depositor1).deposit(toWei("10.0"));
            await pool.connect(depositor1).borrow(toWei("7.0"));
            
            expect(await rewarder.balanceOf(depositor1.address)).to.be.equal(toWei("10.0"));
            expect(await rewarder.balanceOf(depositor2.address)).to.be.equal(0);

            // check rewards
            expect(fromWei(await pool.connect(depositor1).checkRewards())).to.be.closeTo(0, 1e-3);

            // FastForward 180 days ahead (+180 days in total)
            await time.increase(time.duration.days(180));
            // check rewards
            expect(fromWei(await pool.connect(depositor1).checkRewards())).to.be.closeTo(50, 1e-3);
            
            await pool.connect(depositor1).transfer(depositor2.address, toWei("5"));
            expect(await rewarder.balanceOf(depositor1.address)).to.be.equal(toWei("5"));
            expect(await rewarder.balanceOf(depositor2.address)).to.be.equal(toWei("5.0"));

            // FastForward 45 days ahead (+225 days in total)
            await time.increase(time.duration.days(45));
            // check rewards
            expect(fromWei(await pool.connect(depositor1).checkRewards())).to.be.closeTo(56.25, 1e-3);
            expect(fromWei(await pool.connect(depositor2).checkRewards())).to.be.closeTo(6.25, 1e-3);

            await pool.connect(depositor1).approve(depositor1.address, toWei("5.1"));
            await pool.connect(depositor1).transferFrom(depositor1.address, depositor2.address, toWei("5.1"));
            expect(await rewarder.balanceOf(depositor1.address)).to.be.equal(0);
            expect(await rewarder.balanceOf(depositor2.address)).to.be.equal(toWei("10.0"));

            // FastForward 45 days ahead (+270 days in total)
            await time.increase(time.duration.days(45));
            // check rewards
            expect(fromWei(await pool.connect(depositor1).checkRewards())).to.be.closeTo(56.25, 1e-3);
            expect(fromWei(await pool.connect(depositor2).checkRewards())).to.be.closeTo(18.75, 1e-3);

            await pool.connect(depositor1).transfer(depositor2.address, toWei("0.1"));
            expect(await rewarder.balanceOf(depositor1.address)).to.be.equal(0);
            expect(await rewarder.balanceOf(depositor2.address)).to.be.equal(toWei("10.0"));
        });
    });
});
