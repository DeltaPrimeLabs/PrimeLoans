import chai, {expect} from 'chai'
import {ethers, waffle} from 'hardhat'
import {solidity} from "ethereum-waffle";
import {SmartLoansFactory, VPrimeMock} from "../../../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import MockVPrimeArtifact from '../../../artifacts/contracts/token/mock/vPrimeMock.sol/vPrimeMock.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import {fromBytes32, getFixedGasSigners, PoolAsset, Asset, toBytes32, toWei, fromWei, time} from "../../_helpers";
import {BigNumber, Contract} from "ethers";

const {deployContract} = waffle;
chai.use(solidity);

describe('vPrime tests', () => {
    let
        user1: SignerWithAddress,
        user2: SignerWithAddress,
        owner: SignerWithAddress,
        smartLoansFactory: SmartLoansFactory,
        vPrime: Contract;

    before(async () => {
        [user1, user2, owner] = await getFixedGasSigners(10000000);

        smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

        vPrime = await deployContract(
            user1,
            MockVPrimeArtifact,
            []
        ) as VPrimeMock;
        await vPrime.initialize(smartLoansFactory.address);
    })

    it("should check the initial balance of users", async () => {
        expect(await vPrime.balanceOf(user1.address)).to.be.equal(0);
        expect(await vPrime.balanceOf(user2.address)).to.be.equal(0);
    });

    it("[balance increase] should adjust users balances and check them every 6 hrs", async () => {
        expect(await vPrime.balanceOf(user1.address)).to.be.equal(0);
        expect(await vPrime.balanceOf(user2.address)).to.be.equal(0);

        let rateUser1 = 2000 / (60*60*24);
        let rateUser2 = 4000 / (60*60*24);
        await vPrime.adjustRateAndCap(user1.address, toWei(rateUser1.toString()), toWei("1500")); // 1 day = 60*60*24 seconds = 86400
        await vPrime.adjustRateAndCap(user2.address, toWei(rateUser2.toString()), toWei("3000")); // 1 day = 60*60*24 seconds = 86400

        await time.increase(time.duration.hours(6))

        expect(fromWei(await vPrime.balanceOf(user1.address))).to.be.closeTo(500, 0.3);
        expect(fromWei(await vPrime.balanceOf(user2.address))).to.be.closeTo(1000, 0.3);

        await time.increase(time.duration.hours(6))

        expect(fromWei(await vPrime.balanceOf(user1.address))).to.be.closeTo(1000, 0.3);
        expect(fromWei(await vPrime.balanceOf(user2.address))).to.be.closeTo(2000, 0.3);

        await time.increase(time.duration.hours(6))

        expect(fromWei(await vPrime.balanceOf(user1.address))).to.be.closeTo(1500, 0.3);
        expect(fromWei(await vPrime.balanceOf(user2.address))).to.be.closeTo(3000, 0.3);

        await time.increase(time.duration.hours(6))

        expect(fromWei(await vPrime.balanceOf(user1.address))).to.be.closeTo(1500, 0.3);
        expect(fromWei(await vPrime.balanceOf(user2.address))).to.be.closeTo(3000, 0.3);

    });

    it("[balance decrease] should adjust users balances and check them every 6 hours", async () => {
        let rateUser2 = -1000 / (60*60*24);
        await vPrime.adjustRateAndCap(user2.address, toWei(rateUser2.toString()), toWei("2700")); // 1 day = 60*60*24 seconds = 86400
        expect(fromWei(await vPrime.balanceOf(user2.address))).to.be.closeTo(3000, 0.3);

        await time.increase(time.duration.hours(6))
        expect(fromWei(await vPrime.balanceOf(user2.address))).to.be.closeTo(2750, 0.3);

        await time.increase(time.duration.hours(6))
        expect(fromWei(await vPrime.balanceOf(user2.address))).to.be.closeTo(2700, 0.3);
    });
});