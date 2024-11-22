import {ethers, waffle} from "hardhat"
import chai, {expect} from "chai"
import {solidity} from "ethereum-waffle";

import VariableUtilisationRatesCalculatorArtifact
    from "../../artifacts/contracts/mock/MockVariableUtilisationRatesCalculator.sol/MockVariableUtilisationRatesCalculator.json";
import LinearIndexArtifact from '../../artifacts/contracts/LinearIndex.sol/LinearIndex.json';

import PoolArtifact from "../../artifacts/contracts/Pool.sol/Pool.json";
import MockTokenArtifact from "../../artifacts/contracts/mock/MockToken.sol/MockToken.json";
import OpenBorrowersRegistryArtifact
    from "../../artifacts/contracts/mock/OpenBorrowersRegistry.sol/OpenBorrowersRegistry.json";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {customError, fromWei, getFixedGasSigners, time, toWei} from "../_helpers";
import {LinearIndex, MockToken, OpenBorrowersRegistry, Pool, MockVariableUtilisationRatesCalculator} from "../../typechain";

chai.use(solidity);

const {deployContract} = waffle;
const ZERO = ethers.constants.AddressZero;

describe("Pool ERC20 token functions", () => {
    let sut: Pool,
        owner: SignerWithAddress,
        user1: SignerWithAddress,
        user2: SignerWithAddress,
        mockToken: MockToken;

    beforeEach(async () => {
        [owner, user1, user2] = await getFixedGasSigners(10000000);
        sut = (await deployContract(owner, PoolArtifact)) as Pool;

        let MockVariableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as MockVariableUtilisationRatesCalculator;
        let borrowersRegistry = (await deployContract(owner, OpenBorrowersRegistryArtifact)) as OpenBorrowersRegistry;
        mockToken = (await deployContract(owner, MockTokenArtifact, [[user1.address, user2.address]])) as MockToken;

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

    describe("transfer", () => {

        it("should fail to deposit 0 tokens", async () => {
            await expect(sut.connect(user1).deposit(0)).to.be.revertedWith(customError("ZeroDepositAmount"));
        });

        it("should deposit and withdraw", async () => {
            const depositValue = toWei("1.0");
            await mockToken.connect(user1).approve(sut.address, depositValue);
            await sut.connect(user1).deposit(depositValue);

            expect(fromWei(await sut.balanceOf(user1.address))).to.be.equal(fromWei(depositValue));
            expect(fromWei(await mockToken.balanceOf(sut.address))).to.be.equal(fromWei(depositValue));

            const withdrawValue = toWei("0.3");
            await sut.connect(user1).withdraw(withdrawValue);

            expect(fromWei(await sut.balanceOf(user1.address))).to.be.equal(0.7);
        });

        it("should borrow and repay", async () => {
            const depositValue = toWei("1.0");
            await mockToken.connect(user1).approve(sut.address, depositValue);
            await sut.connect(user1).deposit(depositValue);
            await sut.connect(user2).borrow(toWei(".2"));
            expect(fromWei(await mockToken.balanceOf(sut.address))).to.be.equal(.8);

            expect(fromWei(await sut.borrowed(user2.address))).to.be.equal(0.2);
            expect(fromWei(await mockToken.balanceOf(sut.address))).to.be.equal(0.8);

            const repayValue = toWei("0.1");
            await mockToken.connect(user2).approve(sut.address, repayValue);
            await sut.connect(user2).repay(repayValue);
            expect(fromWei(await sut.borrowed(user2.address))).to.be.closeTo(0.1, 0.000001);
        });

        it("should accumulate interest for one year", async () => {
            const depositValue = toWei("0.5");
            await mockToken.connect(user1).approve(sut.address, depositValue);
            await sut.connect(user1).deposit(depositValue);
            await sut.connect(user2).borrow(toWei("0.3"));

            await time.increase(time.duration.years(1));

            expect(fromWei(await mockToken.balanceOf(sut.address))).to.be.equal(0.2);

            expect(fromWei(await sut.balanceOf(user1.address))).to.be.closeTo(0.5072, 0.000001);
            expect(fromWei(await sut.getBorrowed(user2.address))).to.be.closeTo(0.309, 0.000001);

            expect(fromWei(await sut.getDepositRate())).to.be.closeTo(0.01664516141070167, 0.000001);
            expect(fromWei(await sut.getBorrowingRate())).to.be.closeTo(0.03415220820189274, 0.000001);
        });
    });
});
