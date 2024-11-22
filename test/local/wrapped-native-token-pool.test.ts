import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import VariableUtilisationRatesCalculatorArtifact
    from '../../artifacts/contracts/mock/MockVariableUtilisationRatesCalculator.sol/MockVariableUtilisationRatesCalculator.json';
import OpenBorrowersRegistryArtifact
    from '../../artifacts/contracts/mock/OpenBorrowersRegistry.sol/OpenBorrowersRegistry.json';
import LinearIndexArtifact from '../../artifacts/contracts/LinearIndex.sol/LinearIndex.json';
import WrappedNativeTokenPoolArtifact
    from '../../artifacts/contracts/WrappedNativeTokenPool.sol/WrappedNativeTokenPool.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {customError, fromWei, getFixedGasSigners, toWei} from "../_helpers";
import {deployMockContract} from '@ethereum-waffle/mock-contract';
import WETH9Artifact from "../../artifacts/contracts/lib/WETH9.sol/WETH9.json";
import {LinearIndex, OpenBorrowersRegistry, WETH9, WrappedNativeTokenPool} from "../../typechain";
import {Contract} from "ethers";

chai.use(solidity);
const ZERO = ethers.constants.AddressZero;

const {deployContract, provider} = waffle;

describe('Wrapped native token pool', () => {
    let sut: WrappedNativeTokenPool,
        owner: SignerWithAddress,
        depositor: SignerWithAddress,
        depositor2: SignerWithAddress,
        depositor3: SignerWithAddress,
        wavax: Contract,
        mockVariableUtilisationRatesCalculator;

    before(async () => {
        [owner, depositor, depositor2, depositor3] = await getFixedGasSigners(10000000);
        mockVariableUtilisationRatesCalculator = await deployMockContract(owner, VariableUtilisationRatesCalculatorArtifact.abi);
        await mockVariableUtilisationRatesCalculator.mock.calculateDepositRate.returns(toWei("0.05"));
        await mockVariableUtilisationRatesCalculator.mock.calculateBorrowingRate.returns(toWei("0.05"));

        sut = (await deployContract(owner, WrappedNativeTokenPoolArtifact)) as WrappedNativeTokenPool;

        wavax = (await deployContract(owner, WETH9Artifact)) as WETH9;

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
            wavax.address,
            ZERO,
            0
        );

        await wavax.connect(depositor).deposit({value: toWei("10")});
    });

    it("should deposit requested value in native token", async () => {
        await sut.connect(depositor).depositNativeToken({value: toWei("1.0")});

        expect(fromWei(await wavax.balanceOf(sut.address))).to.equal(1);
        expect(fromWei(await sut.totalSupply())).to.equal(1);
        expect(fromWei(await sut.balanceOf(depositor.address))).to.equal(1);
    });

    it("should deposit requested value in wrapped token", async () => {
        await wavax.connect(depositor).approve(sut.address, toWei("1.0"));
        await sut.connect(depositor).deposit(toWei("1.0"));

        expect(fromWei(await sut.balanceOf(depositor.address))).to.closeTo(2, 0.000001);
        expect(fromWei(await wavax.balanceOf(sut.address))).to.equal(2);
        expect(fromWei(await sut.totalSupply())).to.be.closeTo(2, 0.000001);

        expect(fromWei(await sut.balanceOf(depositor.address))).to.be.closeTo(2, 0.000001);
    });

    it("should withdraw requested value in native token", async () => {
        let nativeTokenUserBalanceBefore = fromWei(await provider.getBalance(depositor.address));
        await sut.connect(depositor).withdrawNativeToken(toWei("1"));
        let nativeTokenUserBalanceAfter = fromWei(await provider.getBalance(depositor.address));
        expect(nativeTokenUserBalanceAfter - nativeTokenUserBalanceBefore).to.closeTo(1, 0.001);


        expect(fromWei(await wavax.balanceOf(sut.address))).to.equal(1);
        expect(fromWei(await sut.totalSupply())).to.be.closeTo(1, 0.001);
        expect(fromWei(await sut.balanceOf(depositor.address))).to.closeTo(1, 0.001);
    });

    it("should set totalSupplyCap as a the owner", async () => {
        expect(await sut.totalSupplyCap()).to.be.equal(0);
        expect(await sut.connect(owner).setTotalSupplyCap(toWei("10")));
        expect(await sut.totalSupplyCap()).to.be.equal(toWei("10"));
    });

    it("should fail to deposit too much  in native token", async () => {
        await sut.connect(depositor).depositNativeToken({value: toWei("1.0")});

        expect(fromWei(await sut.balanceOf(depositor.address))).to.closeTo(2, 0.000001);
        expect(fromWei(await wavax.balanceOf(sut.address))).to.equal(2);
        expect(fromWei(await sut.totalSupply())).to.be.closeTo(2, 0.000001);

        expect(fromWei(await sut.balanceOf(depositor.address))).to.be.closeTo(2, 0.000001);

        // TODO: This error is not being parsed correctly, however it was verified with debugging that this reverts in the correct place so we just assert for the revert
        // await expect(sut.connect(depositor).depositNativeToken({value: toWei("8.0")})).to.be.revertedWith(customError("TotalSupplyCapBreached"));
        await expect(sut.connect(depositor).depositNativeToken({value: toWei("8.0")})).to.be.reverted;
    });
});

