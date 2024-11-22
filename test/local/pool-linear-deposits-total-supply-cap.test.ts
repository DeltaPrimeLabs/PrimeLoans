import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import VariableUtilisationRatesCalculatorArtifact
    from '../../artifacts/contracts/mock/MockVariableUtilisationRatesCalculator.sol/MockVariableUtilisationRatesCalculator.json';
import OpenBorrowersRegistryArtifact
    from '../../artifacts/contracts/mock/OpenBorrowersRegistry.sol/OpenBorrowersRegistry.json';
import LinearIndexArtifact from '../../artifacts/contracts/LinearIndex.sol/LinearIndex.json';
import MockTokenArtifact from "../../artifacts/contracts/mock/MockToken.sol/MockToken.json";
import PoolArtifact from '../../artifacts/contracts/Pool.sol/Pool.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {customError, fromWei, getFixedGasSigners, time, toWei} from "../_helpers";
import {deployMockContract} from '@ethereum-waffle/mock-contract';
import {LinearIndex, MockToken, OpenBorrowersRegistry, Pool} from "../../typechain";
import {Contract} from "ethers";

chai.use(solidity);
const ZERO = ethers.constants.AddressZero;

const {deployContract} = waffle;

describe('Pool with variable utilisation interest rates - totalSupplyCap test', () => {
    let sut: Pool,
        owner: SignerWithAddress,
        depositor: SignerWithAddress,
        depositor2: SignerWithAddress,
        depositor3: SignerWithAddress,
        mockToken: Contract,
        mockVariableUtilisationRatesCalculator;

    before(async () => {
        [owner, depositor, depositor2, depositor3] = await getFixedGasSigners(10000000);
        mockVariableUtilisationRatesCalculator = await deployMockContract(owner, VariableUtilisationRatesCalculatorArtifact.abi);
        await mockVariableUtilisationRatesCalculator.mock.calculateDepositRate.returns(toWei("0.05"));
        await mockVariableUtilisationRatesCalculator.mock.calculateBorrowingRate.returns(toWei("0.05"));

        sut = (await deployContract(owner, PoolArtifact)) as Pool;

        mockToken = (await deployContract(owner, MockTokenArtifact, [[depositor.address, depositor2.address, depositor3.address]])) as MockToken;

        const borrowersRegistry = (await deployContract(owner, OpenBorrowersRegistryArtifact)) as OpenBorrowersRegistry;
        const depositIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
        await depositIndex.initialize(sut.address);
        const borrowingIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
        await borrowingIndex.initialize(sut.address);

        await sut.initialize(
            mockVariableUtilisationRatesCalculator.address,
            borrowersRegistry.address,
            depositIndex.address,
            borrowingIndex.address,
            mockToken.address,
            ZERO,
            0
        );
    });

    describe("totalSupplyCap", () => {
        it("should fail to set totalSupplyCap as a non-owner", async () => {
            await expect(sut.connect(depositor).setTotalSupplyCap(toWei("1"))).
            to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("should deposit without totalSupplyCap", async () => {
            await mockToken.connect(depositor).approve(sut.address, toWei("1.0"));
            await sut.connect(depositor).deposit(toWei("1.0"));
            expect(await mockToken.balanceOf(sut.address)).to.equal(toWei("1.0"));
            expect(await sut.balanceOf(sut.address)).to.be.equal(toWei("1.0"))
        });

        it("should set totalSupplyCap as a the owner", async () => {
            expect(await sut.totalSupplyCap()).to.be.equal(0);
            expect(await sut.connect(owner).setTotalSupplyCap(toWei("10")));
            expect(await sut.totalSupplyCap()).to.be.equal(toWei("10"));
        });

        it("should deposit with totalSupplyCap", async () => {
            await mockToken.connect(depositor).approve(sut.address, toWei("8.9"));
            await sut.connect(depositor).deposit(toWei("8.9"));
            expect(await mockToken.balanceOf(sut.address)).to.equal(toWei("9.9"));
            expect(fromWei(await sut.balanceOf(sut.address))).to.be.closeTo(9.9, 1e-5);
        });

        it("should fail to deposit more than totalSupplyCap", async () => {
            await mockToken.connect(depositor).approve(sut.address, toWei("0.2"));
            await expect(sut.connect(depositor).deposit(toWei("0.2"))).to.be.revertedWith(customError("TotalSupplyCapBreached"));
            expect(await mockToken.balanceOf(sut.address)).to.equal(toWei("9.9"));
            expect(fromWei(await sut.balanceOf(sut.address))).to.be.closeTo(9.9, 1e-5);
        });

        it("should fail to deposit more than totalSupplyCap as a different depositor", async () => {
            await mockToken.connect(depositor2).approve(sut.address, toWei("0.2"));
            await expect(sut.connect(depositor2).deposit(toWei("0.2"))).to.be.revertedWith(customError("TotalSupplyCapBreached"));
            expect(await mockToken.balanceOf(sut.address)).to.equal(toWei("9.9"));
            expect(fromWei(await sut.balanceOf(sut.address))).to.be.closeTo(9.9, 1e-5);
        });

        it("should enable deposit after setting totalSupplyCap to 0", async () => {
            await sut.connect(owner).setTotalSupplyCap(0);
            await mockToken.connect(depositor2).approve(sut.address, toWei("1"));
            await sut.connect(depositor2).deposit(toWei("1"));
            expect(await mockToken.balanceOf(sut.address)).to.equal(toWei("10.9"));
            expect(fromWei(await sut.balanceOf(sut.address))).to.be.closeTo(10.9, 0.00001)
        });
    });
});

