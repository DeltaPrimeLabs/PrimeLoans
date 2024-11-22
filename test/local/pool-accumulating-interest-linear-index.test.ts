import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import VariableUtilisationRatesCalculatorArtifact
    from '../../artifacts/contracts/mock/MockVariableUtilisationRatesCalculator.sol/MockVariableUtilisationRatesCalculator.json';
import LinearIndexArtifact from '../../artifacts/contracts/LinearIndex.sol/LinearIndex.json';
import PoolArtifact from '../../artifacts/contracts/Pool.sol/Pool.json';
import MockTokenArtifact from "../../artifacts/contracts/mock/MockToken.sol/MockToken.json";
import OpenBorrowersRegistryArtifact
    from '../../artifacts/contracts/mock/OpenBorrowersRegistry.sol/OpenBorrowersRegistry.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {fromWei, getFixedGasSigners, time, toWei} from "../_helpers";
import {LinearIndex, MockToken, OpenBorrowersRegistry, Pool, MockVariableUtilisationRatesCalculator} from "../../typechain";
import {Contract} from "ethers";

chai.use(solidity);
const ZERO = ethers.constants.AddressZero;

const {deployContract} = waffle;

//results: https://docs.google.com/spreadsheets/d/1foJvQ03Mp3jXil4OyB6UyKeO4P7ho7aXu9WA-TYxeB0/edit#gid=445998878
const TEST_ACTIONS = [
    {
        id: 1,
        delay: 0,
        deposit1: 6,
        expectedDeposited: 6,
        expectedBorrowed: 0,
        expectedDepositAPR: 0,
        expectedBorrowAPR: 0.03,
    },
    {
        id: 2,
        delay: 0,
        deposit2: 4,
        expectedDeposited: 10,
        expectedBorrowed: 0,
        expectedDepositAPR: 0,
        expectedBorrowAPR: 0.03,
    },
    {
        id: 3,
        borrow1: 3,
        expectedDeposited: 10,
        expectedBorrowed: 3,
        expectedDepositAPR: 0.0072,
        expectedBorrowAPR: 0.03,
    },
    {
        id: 4,
        borrow2: 2,
        expectedDeposited: 10,
        expectedBorrowed: 5,
        expectedDepositAPR: 0.01200000000410959,
        expectedBorrowAPR: 0.03,
    },
    {
        id: 5,
        delay: 31536000,
        expectedDeposited: 10.120000002351599,
        expectedBorrowed: 5.15,
        expectedDepositAPR: 0.012213438739310953,
        expectedBorrowAPR: 0.03,
    },
    {
        id: 6,
        repay1: 2,
        expectedDeposited: 10.120000009961949,
        expectedBorrowed: 3.15,
        expectedDepositAPR: 0.007470355753403078,
        expectedBorrowAPR: 0.03,
    },
    {
        id: 7,
        delay: 31536000,
        expectedDeposited: 10.195600010260806,
        expectedBorrowed: 3.2445,
        expectedDepositAPR: 0.007637412239540408,
        expectedBorrowAPR: 0.03,
    },
    {
        id: 8,
        borrow1: 3,
        expectedDeposited: 10.195600012658067,
        expectedBorrowed: 6.2445,
        expectedDepositAPR: 0.017448801717788318,
        expectedBorrowAPR: 0.03561153866682229,
    },
    {
        id: 9,
        delay: 31536000,
        expectedDeposited: 10.373501015672817,
        expectedBorrowed: 6.4668762695910225,
        expectedDepositAPR: 0.020214006438441828,
        expectedBorrowAPR: 0.04053155023740202,
    },
    {
        id: 10,
        withdraw1: 1,
        expectedDeposited: 9.373501021314022,
        expectedBorrowed: 6.466876276642527,
        expectedDepositAPR: 0.03888870703754257,
        expectedBorrowAPR: 0.07045970100947259,
    },
    {
        id: 11,
        delay: 31536000,
        expectedDeposited: 9.738024356448008,
        expectedBorrowed: 6.92253044556001,
        expectedDepositAPR: 0.04543598226551902,
        expectedBorrowAPR: 0.0798943221413616,
    },
    {
        id: 12,
        borrow2: 1,
        expectedDeposited: 9.738024368006968,
        expectedBorrowed: 7.922530460008709,
        expectedDepositAPR: 0.10591626679371975,
        expectedBorrowAPR: 0.1627344937662184,
    },
    {
        id: 13,
        delay: 31536000,
        expectedDeposited: 10.769439555012537,
        expectedBorrowed: 9.211799443765672,
        expectedDepositAPR: 0.20145490057280988,
        expectedBorrowAPR: 0.2943991003093648,
    }
]
describe('Pool testing suite with accumulating interest', () => {
    let sut: Pool,
        owner: SignerWithAddress,
        depositor1: SignerWithAddress,
        depositor2: SignerWithAddress,
        borrower1: SignerWithAddress,
        borrower2: SignerWithAddress,
        mockToken: Contract,
        MockVariableUtilisationRatesCalculator: MockVariableUtilisationRatesCalculator;

    before("Deploy Pool contract", async () => {
        [owner, depositor1, depositor2, borrower1, borrower2] = await getFixedGasSigners(10000000);
        sut = (await deployContract(owner, PoolArtifact)) as Pool;

        MockVariableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as MockVariableUtilisationRatesCalculator;
        const borrowersRegistry = (await deployContract(owner, OpenBorrowersRegistryArtifact)) as OpenBorrowersRegistry;

        let depositIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
        await depositIndex.initialize(sut.address);
        let borrowingIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
        await borrowingIndex.initialize(sut.address);

        mockToken = (await deployContract(owner, MockTokenArtifact, [[depositor1.address, depositor2.address]])) as MockToken;

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

    describe('Should perform test suite', () =>

        TEST_ACTIONS.forEach(
            (action, i) => {
                it(`should perform action ${action.id}`, async () => {

                        if (action.delay) {
                            await time.increase(action.delay);
                        }

                        if (action.deposit1) {
                            await mockToken.connect(depositor1).approve(sut.address, toWei(action.deposit1.toString()));
                            await sut.connect(depositor1).deposit(toWei(action.deposit1.toString()));
                        }

                        if (action.deposit2) {
                            await mockToken.connect(depositor2).approve(sut.address, toWei(action.deposit2.toString()));
                            await sut.connect(depositor2).deposit(toWei(action.deposit2.toString()));
                        }

                        if (action.withdraw1) {
                            await sut.connect(depositor1).withdraw(toWei(action.withdraw1.toString()));
                        }

                        // if (action.withdraw2) {
                        //   await sut.connect(depositor2).withdraw(toWei(action.withdraw2.toString()));
                        // }

                        if (action.borrow1) {
                            await sut.connect(borrower1).borrow(toWei(action.borrow1.toString()));
                        }

                        if (action.borrow2) {
                            await sut.connect(borrower2).borrow(toWei(action.borrow2.toString()));
                        }

                        if (action.repay1) {
                            await mockToken.connect(borrower1).approve(sut.address, toWei(action.repay1.toString()));
                            await sut.connect(borrower1).repay(toWei(action.repay1.toString()));
                        }

                        // if (action.repay2) {
                        //   await sut.connect(borrower2).repay(toWei(action.repay2.toString()));
                        // }

                        let deposited = fromWei(await sut.totalSupply());
                        expect(deposited).to.be.closeTo(action.expectedDeposited, 0.000001);

                        let borrowed = fromWei(await sut.totalBorrowed());
                        expect(borrowed).to.be.closeTo(action.expectedBorrowed, 0.000001);

                        let depositRate = fromWei(await sut.getDepositRate());
                        expect(depositRate).to.be.closeTo(action.expectedDepositAPR, 0.000001);

                        let borrowingRate = fromWei(await sut.getBorrowingRate());
                        expect(borrowingRate).to.be.closeTo(action.expectedBorrowAPR, 0.000001);
                    }
                );
            })
    );
});