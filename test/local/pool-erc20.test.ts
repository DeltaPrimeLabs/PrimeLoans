import {ethers, waffle} from "hardhat"
import chai, {expect} from "chai"
import {solidity} from "ethereum-waffle";

import VariableUtilisationRatesCalculatorArtifact
    from "../../artifacts/contracts/mock/MockVariableUtilisationRatesCalculator.sol/MockVariableUtilisationRatesCalculator.json";
import LinearIndexArtifact from '../../artifacts/contracts/LinearIndex.sol/LinearIndex.json';
import MockTokenArtifact from "../../artifacts/contracts/mock/MockToken.sol/MockToken.json";
import PoolArtifact from "../../artifacts/contracts/Pool.sol/Pool.json";
import OpenBorrowersRegistryArtifact
    from "../../artifacts/contracts/mock/OpenBorrowersRegistry.sol/OpenBorrowersRegistry.json";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {customError, fromWei, getFixedGasSigners, time, toWei} from "../_helpers";
import {LinearIndex, MockToken, OpenBorrowersRegistry, Pool, MockVariableUtilisationRatesCalculator} from "../../typechain";
import {Contract} from "ethers";

chai.use(solidity);

const {deployContract} = waffle;
const ZERO = ethers.constants.AddressZero;

describe("Pool ERC20 token functions", () => {
    let sut: Pool,
        owner: SignerWithAddress,
        user1: SignerWithAddress,
        user2: SignerWithAddress,
        user3: SignerWithAddress,
        user4: SignerWithAddress,
        user5: SignerWithAddress,
        user6: SignerWithAddress,
        mockToken: Contract;

    // shortcut to Pool.balanceOf with conversion to ethers.
    async function balanceOf(user: SignerWithAddress): Promise<number> {
        return fromWei(await sut.balanceOf(user.address));
    }

    beforeEach(async () => {
        [owner, user1, user2, user3, user4, user5, user6] = await getFixedGasSigners(10000000);
        sut = (await deployContract(owner, PoolArtifact)) as Pool;

        mockToken = (await deployContract(owner, MockTokenArtifact, [[user1.address, user2.address, user3.address, user4.address, user5.address, user6.address]])) as MockToken;

        //TODO: replace with a simple rates calculator (constant rates) here and in all other tests where testing compounding
        //is not necessary. Check variable utilisation rates calculator only in the tests where it's essential
        let MockVariableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as MockVariableUtilisationRatesCalculator;
        let borrowersRegistry = (await deployContract(owner, OpenBorrowersRegistryArtifact)) as OpenBorrowersRegistry;
        const depositIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
        await depositIndex.initialize(sut.address);
        const borrowingIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
        await borrowingIndex.initialize(sut.address);

        await sut.initialize(
            MockVariableUtilisationRatesCalculator.address,
            borrowersRegistry.address,
            depositIndex.address,
            borrowingIndex.address,
            mockToken.address,
            ZERO,
            0
        );
    });

    // describe("transfer", () => {
    //
    //     it("should revert if not enough balance", async () => {
    //         await mockToken.connect(user1).approve(sut.address, toWei("1.0"));
    //         await sut.connect(user1).deposit(toWei("1.0"));
    //
    //         await expect(sut.connect(user1).transfer(user2.address, toWei("1.1")))
    //             .to.be.revertedWith("TransferAmountExceedsBalance");
    //     });
    //
    //     it("should accumulate user1 interest prior to transferring the funds", async () => {
    //         // given
    //         await mockToken.connect(user1).approve(sut.address, toWei("1.0"));
    //         await sut.connect(user1).deposit(toWei("1.0"));
    //
    //         await sut.connect(user1).borrow(toWei("0.7"));
    //         await time.increase(time.duration.years(1));
    //
    //         // note: after accumulating interest user1 should be able to transfer
    //         // more funds than originally deposited
    //         // when
    //
    //         expect(await balanceOf(user1)).to.be.closeTo(1.042, 0.00001);
    //
    //         await sut.connect(user1).transfer(user2.address, toWei("1.04"));
    //
    //         // then
    //         expect(await balanceOf(user2)).to.be.equal(1.04);
    //         expect(await balanceOf(user1)).to.be.closeTo(0.002000001331811263, 0.000001);
    //     });
    //
    //     it("should accumulate user2 interest prior to transferring the funds", async () => {
    //         // given
    //         await mockToken.connect(user1).approve(sut.address, toWei("1.0"));
    //         await sut.connect(user1).depositOnBehalf(toWei("1.0"), user1.address);
    //
    //         await mockToken.connect(user2).approve(sut.address, toWei("2.0"));
    //         await sut.connect(user2).deposit(toWei("2.0"));
    //
    //         await sut.connect(user3).borrow(toWei("2.0"));
    //         await time.increase(time.duration.years(1));
    //
    //         expect(await balanceOf(user1)).to.be.closeTo(1.032, 0.000001);
    //
    //         // when
    //         await sut.connect(user1).transfer(user2.address, toWei("1.03"));
    //
    //         // then
    //         expect(await balanceOf(user1)).to.be.closeTo(0.002000001014713342, 0.000001);
    //         expect(await balanceOf(user2)).to.be.closeTo(3.0940000020294267 , 0.000001);
    //     });
    //
    // });

    describe("lock deposit", () => {

        it("should allow a user to deposit and lock funds", async () => {
            await mockToken.connect(user1).approve(sut.address, toWei("1.0"));
            await sut.connect(user1).deposit(toWei("1.0"));

            console.log('1')
            expect(await balanceOf(user1)).to.be.closeTo(1.0, 0.00001);
            expect(await balanceOf(user2)).to.be.closeTo(0, 0.00001);
            await sut.connect(user1).transfer(user2.address, toWei("1.0"));
            expect(await balanceOf(user1)).to.be.closeTo(0, 0.00001);
            expect(await balanceOf(user2)).to.be.closeTo(1.0, 0.00001);

            let sixtyDays = 60 * 24 * 60 * 60;

            console.log('2')

            expect(fromWei(await sut.lockedBalances(user2.address))).to.be.closeTo(0, 0.00001);
            expect(await sut.lockedUntil(user2.address)).to.be.equal(0);

            await sut.connect(user2).lockDeposit(toWei("0.7"), sixtyDays);

            console.log('3')

            expect(fromWei(await sut.lockedBalances(user2.address))).to.be.closeTo(0.7, 0.00001);
            let timestampInSecondsNowPlus60days = Math.floor(Date.now() / 1000) + sixtyDays;
            expect(await sut.lockedUntil(user2.address)).to.be.closeTo(timestampInSecondsNowPlus60days, 30 * 60);
        });

        // it("should not allow a user to decrease the locked amount", async () => {
        //     let sixtyDays = 60 * 24 * 60 * 60;
        //     await expect(sut.connect(user2).lockDeposit(toWei("0.6"), sixtyDays))
        //         .to.be.revertedWith("Cannot decrease locked amount");
        // });
        //
        // it("should not allow a user to decrease the lock time", async () => {
        //     let thirtyDays = 30 * 24 * 60 * 60;
        //     await expect(sut.connect(user2).lockDeposit(toWei("0.7"), thirtyDays))
        //         .to.be.revertedWith("Cannot decrease lock time");
        // });
        //
        // it("should not allow a user to transfer, withdraw, or transferFrom when funds are locked", async () => {
        //     await expect(sut.connect(user2).transfer(user1.address, toWei("1.0")))
        //         .to.be.revertedWith("Balance is locked");
        //
        //     await expect(sut.connect(user2).withdraw(toWei("1.0")))
        //         .to.be.revertedWith("Balance is locked");
        //
        //     await expect(sut.connect(user1).transferFrom(user2.address, user1.address, toWei("1.0")))
        //         .to.be.revertedWith("Balance is locked");
        // });
        //
        // it("should allow a user to transfer, withdraw, and transferFrom after the lock period has ended", async () => {
        //     let sixtyDays = 60 * 24 * 60 * 60;
        //     await sut.connect(user2).lockDeposit(toWei("0.7"), sixtyDays);
        //
        //     // wait 60 days
        //     await time.increase(time.duration.days(60));
        //
        //     await sut.connect(user2).transfer(user1.address, toWei("0.1"));
        //     expect(await balanceOf(user1)).to.be.closeTo(0.1, 0.00001);
        //     expect(await balanceOf(user2)).to.be.closeTo(0.6, 0.00001);
        //
        //     await sut.connect(user2).withdraw(toWei("0.1"));
        //     expect(await balanceOf(user1)).to.be.closeTo(0.1, 0.00001);
        //     expect(await balanceOf(user2)).to.be.closeTo(0.5, 0.00001);
        //
        //     await sut.connect(user2).approve(user1.address, toWei("0.1"));
        //     await sut.connect(user1).transferFrom(user2.address, user1.address, toWei("0.1"));
        //     expect(await balanceOf(user1)).to.be.closeTo(0.2, 0.00001);
        //     expect(await balanceOf(user2)).to.be.closeTo(0.4, 0.00001);
        // });
    });

    // describe("approve", () => {
    //     it("should revert upon setting an allowance for a zero address", async () => {
    //         await expect(sut.connect(user1).approve(ethers.constants.AddressZero, toWei("1.05"))).
    //         to.be.revertedWith("SpenderZeroAddress");
    //     });
    //
    //     it("should properly assign amount to different spenders within one owner", async () => {
    //         await mockToken.connect(user1).approve(sut.address, toWei("5.0"));
    //         await sut.connect(user1).deposit(toWei("5.0"));
    //
    //         await sut.connect(user1).approve(user2.address, toWei("1.05"));
    //         await sut.connect(user1).approve(user3.address, toWei("2.03"));
    //         await sut.connect(user1).approve(user4.address, toWei("1.27"));
    //
    //         // then
    //         expect(fromWei(await sut.allowance(user1.address, user2.address)))
    //             .to.be.equal(1.05);
    //         expect(fromWei(await sut.allowance(user1.address, user3.address)))
    //             .to.be.equal(2.03);
    //         expect(fromWei(await sut.allowance(user1.address, user4.address)))
    //             .to.be.equal(1.27);
    //     });
    //
    //     it("should properly assign amount to different spenders for different owners", async () => {
    //         // given
    //         await mockToken.connect(user1).approve(sut.address, toWei("5.0"));
    //         await sut.connect(user1).deposit(toWei("5.0"));
    //
    //         await mockToken.connect(user2).approve(sut.address, toWei("3.0"));
    //         await sut.connect(user2).deposit(toWei("3.0"));
    //
    //         // when
    //         await sut.connect(user1).approve(user2.address, toWei("2.33"));
    //         await sut.connect(user1).approve(user3.address, toWei("1.89"));
    //         await sut.connect(user2).approve(user3.address, toWei("1.89"));
    //         await sut.connect(user2).approve(user4.address, toWei("2.33"));
    //
    //         // then
    //         expect(fromWei(await sut.allowance(user1.address, user2.address)))
    //             .to.be.equal(2.33);
    //         expect(fromWei(await sut.allowance(user1.address, user3.address)))
    //             .to.be.equal(1.89);
    //         expect(fromWei(await sut.allowance(user1.address, user4.address)))
    //             .to.be.equal(0);
    //
    //         expect(fromWei(await sut.allowance(user2.address, user2.address)))
    //             .to.be.equal(0);
    //         expect(fromWei(await sut.allowance(user2.address, user3.address)))
    //             .to.be.equal(1.89);
    //         expect(fromWei(await sut.allowance(user2.address, user4.address)))
    //             .to.be.equal(2.33);
    //     });
    // })
    //
    // describe("increaseAllowance", () => {
    //     it("should revert upon increasing an allowance for a zero address", async () => {
    //         await expect(sut.connect(user1).increaseAllowance(ethers.constants.AddressZero, toWei("1"))).
    //         to.be.revertedWith("SpenderZeroAddress");
    //     });
    //
    //     it("should increase an allowance", async () => {
    //         await sut.connect(user1).increaseAllowance(user2.address, toWei("1"));
    //         await sut.connect(user1).increaseAllowance(user2.address, toWei("3"));
    //         expect(await sut.allowance(user1.address, user2.address)).to.be.equal(toWei("4"))
    //     });
    // });
    //
    // describe("decreaseAllowance", () => {
    //     it("should revert upon decreasing an allowance for a zero address", async () => {
    //         await expect(sut.connect(user1).decreaseAllowance(ethers.constants.AddressZero, toWei("1"))).
    //         to.be.revertedWith("SpenderZeroAddress");
    //     });
    //
    //     it("should decrease an allowance", async () => {
    //         await sut.connect(user1).approve(user2.address, toWei("6"));
    //         await sut.connect(user1).decreaseAllowance(user2.address, toWei("1"));
    //         await sut.connect(user1).decreaseAllowance(user2.address, toWei("2"));
    //         expect(await sut.allowance(user1.address, user2.address)).to.be.equal(toWei("3"))
    //     });
    //
    //     it("should revert upon decreasing an allowance for below the current allowance level", async () => {
    //         await expect(sut.connect(user1).decreaseAllowance(user2.address, toWei("100"))).to.be.revertedWith("InsufficientAllowance");
    //     });
    //
    // });
    //
    // describe("transferFrom", () => {
    //     it("should revert if amount is higher than user1 balance", async () => {
    //         await mockToken.connect(user1).approve(sut.address, toWei("2.0"));
    //         await sut.connect(user1).deposit(toWei("2.0"));
    //
    //         await sut.connect(user1).approve(user2.address, toWei("2.0"));
    //         await sut.connect(user1).withdraw(toWei("1.0"));
    //
    //         await expect(sut.connect(user2).transferFrom(user1.address, user2.address, toWei("1.01")))
    //             .to.be.revertedWith("TransferAmountExceedsBalance");
    //     });
    //
    //     it("should revert if caller's allowance for user1's tokens is too low", async () => {
    //         await mockToken.connect(user1).approve(sut.address, toWei("1.0"));
    //         await sut.connect(user1).deposit(toWei("1.0"));
    //
    //         await sut.connect(user1).approve(user2.address, toWei("0.5"));
    //
    //         await expect(sut.connect(user2).transferFrom(user1.address, user2.address, toWei("0.55")))
    //             // .to.be.revertedWith("Not enough tokens allowed");
    //             .to.be.revertedWith("InsufficientAllowance");
    //     });
    //
    //     it("should decrease allowance by the transfer amount", async () => {
    //         await mockToken.connect(user1).approve(sut.address, toWei("1.0"));
    //         await sut.connect(user1).deposit(toWei("1.0"));
    //
    //         await sut.connect(user1).approve(user5.address, toWei("0.5"));
    //
    //         await sut.connect(user5).transferFrom(user1.address, user3.address, toWei("0.4"));
    //         expect(fromWei(await sut.allowance(user1.address, user5.address)))
    //             .to.be.equal(0.1);
    //     });
    //
    //     it("should decrease balance of the user1 after transfer from user1 to user3", async () => {
    //         await mockToken.connect(user1).approve(sut.address, toWei("2.0"));
    //         await sut.connect(user1).deposit(toWei("2.0"));
    //
    //         await sut.connect(user1).approve(user5.address, toWei("1.5"));
    //
    //         await sut.connect(user5).transferFrom(user1.address, user3.address, toWei("1.2"));
    //         expect(await balanceOf(user1)).to.be.closeTo(0.8, 0.000001);
    //     });
    //
    //     it("should not decrease balance of the msg.user5", async () => {
    //         await mockToken.connect(user1).approve(sut.address, toWei("3.9"));
    //         await sut.connect(user1).deposit(toWei("3.9"));
    //
    //         await mockToken.connect(user5).approve(sut.address, toWei("5.2"));
    //         await sut.connect(user5).deposit(toWei("5.2"));
    //
    //         await mockToken.connect(user3).approve(sut.address, toWei("4.0"));
    //         await sut.connect(user3).deposit(toWei("4.0"));
    //
    //         await sut.connect(user1).approve(user5.address, toWei("2.0"));
    //
    //         await sut.connect(user5).transferFrom(user1.address, user3.address, toWei("0.89"));
    //
    //         expect(await balanceOf(user5)).to.be.closeTo(5.2, 0.00001);
    //     });
    //
    //     it("should increase balance of the user3 after transfer from user1", async () => {
    //         await mockToken.connect(user1).approve(sut.address, toWei("3.9"));
    //         await sut.connect(user1).deposit(toWei("3.9"));
    //
    //         await mockToken.connect(user3).approve(sut.address, toWei("1.0"));
    //         await sut.connect(user3).deposit(toWei("1.0"));
    //
    //         await sut.connect(user1).approve(user5.address, toWei("0.9"));
    //
    //         await sut.connect(user5).transferFrom(user1.address, user3.address, toWei("0.89"));
    //         expect(await balanceOf(user3)).to.be.closeTo(1.89, 0.000001);
    //     });
    //
    //     it("should accumulate interest of the user1 and user3", async () => {
    //         await mockToken.connect(user1).approve(sut.address, toWei("3.9"));
    //         await sut.connect(user1).deposit(toWei("3.9"));
    //
    //         await mockToken.connect(user3).approve(sut.address, toWei("1.0"));
    //         await sut.connect(user3).deposit(toWei("1.0"));
    //
    //         await sut.connect(user1).approve(user5.address, toWei("3.9"));
    //
    //         await time.increase(time.duration.years(5));
    //         await sut.connect(user5).transferFrom(user1.address, user3.address, toWei("1.0"));
    //
    //         expect(await balanceOf(user1)).to.be.closeTo(2.9, 0.000001);
    //         expect(await balanceOf(user3)).to.be.closeTo(2, 0.000001);
    //     });
    // });
    //
    // describe("totalSupply with multiple depositors", () => {
    //     it("should properly sum total tokens supply - minting", async () => {
    //         await mockToken.connect(user1).approve(sut.address, toWei("4.06"));
    //         await sut.connect(user1).deposit(toWei("4.06"));
    //
    //         await mockToken.connect(user2).approve(sut.address, toWei("3.1"));
    //         await sut.connect(user2).deposit(toWei("3.1"));
    //
    //         await mockToken.connect(user3).approve(sut.address, toWei("12.14"));
    //         await sut.connect(user3).deposit(toWei("12.14"));
    //
    //         await mockToken.connect(user4).approve(sut.address, toWei("4.354"));
    //         await sut.connect(user4).deposit(toWei("4.354"));
    //
    //         await mockToken.connect(user5).approve(sut.address, toWei("12.64"));
    //         await sut.connect(user5).deposit(toWei("12.64"));
    //
    //         let balanceOfUser1 = await balanceOf(user1);
    //         let balanceOfUser2 = await balanceOf(user2);
    //         let balanceOfUser3 = await balanceOf(user3);
    //         let balanceOfUser4 = await balanceOf(user4);
    //         let balanceOfUser5 = await balanceOf(user5);
    //
    //         let sumOfBalances = balanceOfUser1 + balanceOfUser2 + balanceOfUser3 + balanceOfUser4 + balanceOfUser5;
    //
    //         expect(fromWei(await sut.totalSupply())).to.be.equal(36.294);
    //         expect(fromWei(await sut.totalSupply())).to.be.closeTo(sumOfBalances, 0.000001);
    //     });
    //
    //     it("should properly sum total tokens supply - minting and burning", async () => {
    //         await mockToken.connect(user1).approve(sut.address, toWei("4.06"));
    //         await sut.connect(user1).deposit(toWei("4.06"));
    //
    //         await mockToken.connect(user2).approve(sut.address, toWei("3.1"));
    //         await sut.connect(user2).deposit(toWei("3.1"));
    //
    //         await sut.connect(user1).withdraw(toWei("2.0"));
    //         await sut.connect(user2).withdraw(toWei("1.5"));
    //
    //         let balanceOfUser1 = await balanceOf(user1);
    //         let balanceOfUser2 = await balanceOf(user2);
    //
    //         expect(fromWei(await sut.totalSupply())).to.be.closeTo(3.660000, 0.000001);
    //         expect(fromWei(await sut.totalSupply())).to.be.closeTo(balanceOfUser1 + balanceOfUser2, 0.000001);
    //     });
    //
    //     it("should properly sum total tokens supply with accumulated interest - minting", async () => {
    //         await mockToken.connect(user1).approve(sut.address, toWei("4.06"));
    //         await sut.connect(user1).deposit(toWei("4.06"));
    //
    //         await mockToken.connect(user2).approve(sut.address, toWei("3.1"));
    //         await sut.connect(user2).deposit(toWei("3.1"));
    //
    //         await mockToken.connect(user3).approve(sut.address, toWei("12.14"));
    //         await sut.connect(user3).deposit(toWei("12.14"));
    //
    //         await mockToken.connect(user4).approve(sut.address, toWei("4.354"));
    //         await sut.connect(user4).deposit(toWei("4.354"));
    //
    //         await mockToken.connect(user5).approve(sut.address, toWei("12.64"));
    //         await sut.connect(user5).deposit(toWei("12.64"));
    //
    //         await mockToken.connect(user6).approve(sut.address, toWei("20"));
    //         await sut.connect(user6).borrow(toWei("20"));
    //
    //         await time.increase(time.duration.years(1));
    //
    //         let balanceOfUser1 = await balanceOf(user1);
    //         let balanceOfUser2 = await balanceOf(user2);
    //         let balanceOfUser3 = await balanceOf(user3);
    //         let balanceOfUser4 = await balanceOf(user4);
    //         let balanceOfUser5 = await balanceOf(user5);
    //
    //         expect(balanceOfUser1).to.be.closeTo(4.113694825591007, 0.000001);
    //         expect(balanceOfUser2).to.be.closeTo(3.1409985121507686, 0.000001);
    //         expect(balanceOfUser3).to.be.closeTo(12.30055546371301, 0.000001);
    //         expect(balanceOfUser4).to.be.closeTo(4.41158307158208, 0.000001);
    //         expect(balanceOfUser5).to.be.closeTo(12.807168126963134, 0.000001);
    //
    //         let sumOfBalances = balanceOfUser1 + balanceOfUser2 + balanceOfUser3 + balanceOfUser4 + balanceOfUser5;
    //
    //         expect(fromWei(await sut.totalSupply())).to.be.closeTo(sumOfBalances, 0.000001);
    //     });
    //
    //     it("should properly sum total tokens supply with accumulated interest - burning", async () => {
    //         await mockToken.connect(user1).approve(sut.address, toWei("4.06"));
    //         await sut.connect(user1).deposit(toWei("4.06"));
    //
    //         await mockToken.connect(user2).approve(sut.address, toWei("3.1"));
    //         await sut.connect(user2).deposit(toWei("3.1"));
    //
    //         await sut.connect(user3).borrow(toWei("2"));
    //
    //         await time.increase(time.duration.years(1));
    //
    //         expect(await balanceOf(user1)).to.be.closeTo(4.087217877094972, 0.000001);
    //         expect(await balanceOf(user2)).to.be.closeTo(3.120782122905028, 0.000001);
    //
    //         await sut.connect(user1).withdraw(toWei("2.06"));
    //         await sut.connect(user2).withdraw(toWei("1.1"));
    //
    //         expect(await balanceOf(user1)).to.be.closeTo(2.0272178785753985, 0.000001);
    //         expect(await balanceOf(user2)).to.be.closeTo(2.0207821245144038, 0.000001);
    //     });
    //
    //     it("should properly sum total tokens supply with accumulated interest - minting, burning and borrowing", async () => {
    //         await mockToken.connect(user1).approve(sut.address, toWei("3.06"));
    //         await sut.connect(user1).deposit(toWei("3.06"));
    //
    //         await mockToken.connect(user2).approve(sut.address, toWei("2.1"));
    //         await sut.connect(user2).deposit(toWei("2.1"));
    //
    //         await sut.connect(user3).borrow(toWei("1"));
    //
    //         await time.increase(time.duration.years(1));
    //         expect(await balanceOf(user1)).to.be.closeTo(3.074232558139535, 0.000001);
    //         expect(await balanceOf(user2)).to.be.closeTo(2.1097674418604653, 0.000001);
    //         await sut.connect(user1).withdraw(toWei("2.06"));
    //         await sut.connect(user2).withdraw(toWei("1.1"));
    //
    //         expect(await balanceOf(user1)).to.be.closeTo(1.014232558845335, 0.000001);
    //         expect(await balanceOf(user2)).to.be.closeTo(1.0097674426995662, 0.000001);
    //
    //         await time.increase(time.duration.years(1));
    //
    //         let balanceOfUser1 = await balanceOf(user1);
    //         let balanceOfUser2 = await balanceOf(user2);
    //
    //         expect(balanceOfUser1).to.be.closeTo(1.0266198264725823, 0.000001);
    //         expect(balanceOfUser2).to.be.closeTo(1.0221001755114634, 0.000001);
    //
    //         let sumOfBalances = balanceOfUser1 + balanceOfUser2;
    //
    //         expect(fromWei(await sut.totalSupply())).to.be.closeTo(sumOfBalances, 0.000001);
    //
    //         await sut.connect(user3).borrow(toWei("0.7"));
    //
    //         await time.increase(time.duration.years(1));
    //
    //         balanceOfUser1 = await balanceOf(user1);
    //         balanceOfUser2 = await balanceOf(user2);
    //
    //         expect(balanceOfUser1).to.be.closeTo(1.2436627106811908, 0.000001);
    //         expect(balanceOfUser2).to.be.closeTo(1.2381875371078563, 0.000001);
    //
    //         sumOfBalances = balanceOfUser1 + balanceOfUser2;
    //
    //         expect(fromWei(await sut.totalSupply())).to.be.closeTo(sumOfBalances, 0.000001);
    //
    //         await mockToken.connect(user3).approve(sut.address, toWei("0.22"));
    //         await sut.connect(user3).repay(toWei("0.22"));
    //
    //         await time.increase(time.duration.years(1));
    //
    //         balanceOfUser1 = await balanceOf(user1);
    //         balanceOfUser2 = await balanceOf(user2);
    //
    //         expect(balanceOfUser1).to.be.closeTo(1.4464277028533703, 0.000001);
    //         expect(balanceOfUser2).to.be.closeTo(1.440059863901895, 0.000001);
    //
    //         sumOfBalances = balanceOfUser1 + balanceOfUser2;
    //
    //         expect(fromWei(await sut.totalSupply())).to.be.closeTo(sumOfBalances, 0.000001);
    //     });
    // });
});
