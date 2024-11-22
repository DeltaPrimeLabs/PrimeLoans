import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import VariableUtilisationRatesCalculatorArtifact
    from '../../artifacts/contracts/mock/MockVariableUtilisationRatesCalculator.sol/MockVariableUtilisationRatesCalculator.json';
import LinearIndexArtifact from '../../artifacts/contracts/LinearIndex.sol/LinearIndex.json';
import PoolArtifact from '../../artifacts/contracts/Pool.sol/Pool.json';
import MockTokenArtifact from "../../artifacts/contracts/mock/MockToken.sol/MockToken.json";
import DestructableArtifact from '../../artifacts/contracts/mock/DestructableContract.sol/DestructableContract.json';
import OpenBorrowersRegistryArtifact
    from '../../artifacts/contracts/mock/OpenBorrowersRegistry.sol/OpenBorrowersRegistry.json';
import PoolRewarderArtifact from '../../artifacts/contracts/PoolRewarder.sol/PoolRewarder.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {customError, fromWei, getFixedGasSigners, time, toWei} from "../_helpers";
import {
    DestructableContract,
    LinearIndex,
    MockToken,
    OpenBorrowersRegistry,
    OpenBorrowersRegistry__factory,
    Pool, PoolRewarder,
    MockVariableUtilisationRatesCalculator,
} from "../../typechain";
import {BigNumber, Contract} from "ethers";
import addresses from "../../common/addresses/avax/token_addresses.json";

chai.use(solidity);
const ZERO = ethers.constants.AddressZero;

const {deployContract, provider} = waffle;

describe('Safety tests of pool', () => {
    describe('Intializing a pool', () => {
        let pool: Pool,
            rewarder: PoolRewarder,
            owner: SignerWithAddress,
            nonContractAddress: string,
            ratesCalculator: MockVariableUtilisationRatesCalculator,
            borrowersRegistry: OpenBorrowersRegistry,
            depositIndex: LinearIndex,
            borrowingIndex: LinearIndex,
            mockToken: Contract;

        before("Deploy a pool contract", async () => {
            [owner] = await getFixedGasSigners(10000000);
            nonContractAddress = '88a5c2d9919e46f883eb62f7b8dd9d0cc45bc290';
            ratesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact) as MockVariableUtilisationRatesCalculator);
            pool = (await deployContract(owner, PoolArtifact)) as Pool;
            borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());
            depositIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
            await depositIndex.initialize(pool.address);
            borrowingIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
            await borrowingIndex.initialize(pool.address);
            rewarder = (await deployContract(owner, PoolRewarderArtifact, [addresses.AVAX, pool.address])) as PoolRewarder;

            mockToken = (await deployContract(owner, MockTokenArtifact, [[owner.address]])) as MockToken;
        });

        it("should not allow initializing pool with a non-contract ratesCalculator", async () => {
            await expect(
                pool.initialize(
                    nonContractAddress,
                    borrowersRegistry.address,
                    depositIndex.address,
                    borrowingIndex.address,
                    mockToken.address,
                    rewarder.address,
                    0
                )).to.be.revertedWith("Wrong init arguments");
        });

        it("should not allow initializing pool with a non-contract borrowersRegistry", async () => {
            await expect(
                pool.initialize(
                    ratesCalculator.address,
                    nonContractAddress,
                    depositIndex.address,
                    borrowingIndex.address,
                    mockToken.address,
                    rewarder.address,
                    0
                )).to.be.revertedWith("Wrong init arguments");
        });

        it("should not allow initializing pool with a non-contract depositIndex", async () => {
            await expect(
                pool.initialize(
                    ratesCalculator.address,
                    borrowersRegistry.address,
                    nonContractAddress,
                    borrowingIndex.address,
                    mockToken.address,
                    rewarder.address,
                    0
                )).to.be.revertedWith("Wrong init arguments");
        });

        it("should not allow initializing pool with a non-contract borrowIndex", async () => {
            await expect(
                pool.initialize(
                    ratesCalculator.address,
                    borrowersRegistry.address,
                    depositIndex.address,
                    nonContractAddress,
                    mockToken.address,
                    rewarder.address,
                    0
                )).to.be.revertedWith("Wrong init arguments");
        });

        it("should not allow initializing pool with a non-contract rewarder contract", async () => {
            await expect(
                pool.initialize(
                    ratesCalculator.address,
                    borrowersRegistry.address,
                    depositIndex.address,
                    borrowingIndex.address,
                    mockToken.address,
                    nonContractAddress,
                    0
                )).to.be.revertedWith("Wrong init arguments");
        });

        it("should initialize a pool", async () => {
            await pool.initialize(
                ratesCalculator.address,
                borrowersRegistry.address,
                depositIndex.address,
                borrowingIndex.address,
                mockToken.address,
                rewarder.address,
                0
            );
        });

        it("should not allow setting a non-contract ratesCalculator", async () => {
            await expect(pool.setRatesCalculator(nonContractAddress)).
            to.be.revertedWith(customError("NotAContract", ethers.utils.getAddress(nonContractAddress)));
        });

        it("should not allow setting a non-contract borrowersRegistry", async () => {
            await expect(pool.setBorrowersRegistry(nonContractAddress)).
            to.be.revertedWith(customError("NotAContract", ethers.utils.getAddress(nonContractAddress)));
        });

        it("should not allow setting a non-contract poolRewarder", async () => {
            await expect(pool.setBorrowersRegistry(nonContractAddress)).
            to.be.revertedWith(customError("NotAContract", ethers.utils.getAddress(nonContractAddress)));
        });
    });

    describe('Forcefully fund pool', () => {
        let pool: Pool,
            destructable: DestructableContract,
            owner: SignerWithAddress,
            user1: SignerWithAddress,
            user2: SignerWithAddress,
            user3: SignerWithAddress,
            ratesCalculator: MockVariableUtilisationRatesCalculator,
            mockToken: Contract;

        before("Deploy a pool contract and a destructable contract for force funding", async () => {
            [owner, user1, user2, user3] = await getFixedGasSigners(10000000);
            ratesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact) as MockVariableUtilisationRatesCalculator);
            pool = (await deployContract(owner, PoolArtifact)) as Pool;
            destructable = (await deployContract(user1, DestructableArtifact)) as DestructableContract;
            const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());
            const depositIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
            await depositIndex.initialize(pool.address);
            const borrowingIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
            await borrowingIndex.initialize(pool.address);

            mockToken = (await deployContract(owner, MockTokenArtifact, [[owner.address, user1.address, user2.address, user3.address]])) as MockToken;

            await pool.initialize(
                ratesCalculator.address,
                borrowersRegistry.address,
                depositIndex.address,
                borrowingIndex.address,
                mockToken.address,
                ZERO,
                0
            );
        });

        it("user1 funds destructable contract with 1ETH", async () => {
            await user1.sendTransaction({to: destructable.address, value: toWei("1.0")});
        });

        it("user2 and user3 make pool related actions", async () => {
            await mockToken.connect(user2).approve(pool.address, toWei("1.0"));
            await pool.connect(user2).deposit(toWei("1.0"));

            await pool.connect(user3).borrow(toWei("0.7"));

            expect(fromWei(await mockToken.balanceOf(pool.address))).to.be.closeTo(0.3, 0.000001);
        });

        it("year passes, user 1 forcefully funds pool contract with 1 ETH", async () => {
            await time.increase(time.duration.years(1));

            expect(fromWei(await pool.totalSupply())).to.be.closeTo(1.042, 0.000001);
            expect(fromWei(await mockToken.balanceOf(pool.address))).to.be.closeTo(0.3, 0.000001);

            expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.04909362439719865, 0.000001);
            expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.08497600767754318, 0.000001);

            await destructable.connect(user1).destruct(pool.address);

            expect(fromWei(await pool.totalSupply())).to.be.closeTo(1.0420000013318114, 0.000001);
            expect(fromWei(await mockToken.balanceOf(pool.address))).to.be.closeTo(0.3, 0.000001);
            expect(fromWei(await provider.getBalance(pool.address))).to.be.closeTo(1.0, 0.000001);

            expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.04909362461845358 , 0.000001);
            expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.08497600798112968, 0.000001);
        });

        it("wait a year and check pool", async () => {
            await time.increase(time.duration.years(1));

            expect(fromWei(await pool.totalSupply())).to.be.closeTo(1.084, 0.000001);
            expect(fromWei(await mockToken.balanceOf(pool.address))).to.be.closeTo(0.3, 0.000001);
            expect(fromWei(await provider.getBalance(pool.address))).to.be.closeTo(1, 0.000001);

            expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.05595134189349273, 0.000001);
            expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.09417896707018499, 0.000001);
        });
    });

    describe('Checking surplus', () => {
        let pool: Pool,
            owner: SignerWithAddress,
            user1: SignerWithAddress,
            user2: SignerWithAddress,
            user3: SignerWithAddress,
            ratesCalculator: MockVariableUtilisationRatesCalculator,
            mockToken: Contract;

        before("Deploy Pool contract", async () => {
            [owner, user1, user2, user3] = await getFixedGasSigners(10000000);
            ratesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as MockVariableUtilisationRatesCalculator;
            pool = (await deployContract(owner, PoolArtifact)) as Pool;
            const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());
            const depositIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
            await depositIndex.initialize(pool.address);
            const borrowingIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
            await borrowingIndex.initialize(pool.address);

            mockToken = (await deployContract(owner, MockTokenArtifact, [[owner.address, user1.address, user2.address, user3.address]])) as MockToken;

            await pool.initialize(
                ratesCalculator.address,
                borrowersRegistry.address,
                depositIndex.address,
                borrowingIndex.address,
                mockToken.address,
                ZERO,
                0
            );
        });

        it("surplus for empty pool should be 0", async () => {
            let poolBalance = fromWei(await mockToken.balanceOf(pool.address));
            let totalBorrowed = fromWei(await pool.totalBorrowed());
            let totalSupply = fromWei(await pool.totalSupply());
            const currentSurplus = poolBalance + totalBorrowed - totalSupply;
            expect(currentSurplus).to.be.closeTo(0, 0.00001);
        });

        it("surplus before borrowing should be 0", async () => {
            await mockToken.connect(user1).approve(pool.address, toWei("1"));
            await pool.connect(user1).deposit(toWei("1"));

            expect(await mockToken.balanceOf(pool.address)).to.be.equal(toWei("1", "ether"));

            const currentSurplus = fromWei(await mockToken.balanceOf(pool.address)) + fromWei(await pool.totalBorrowed()) - fromWei(await pool.totalSupply());
            expect(currentSurplus).to.be.closeTo(0, 0.00001);
        });

        it("surplus before accumulating rates should be 0", async () => {
            await pool.connect(user2).borrow(toWei("0.5"));
            expect(fromWei(await mockToken.balanceOf(pool.address))).to.be.equal(0.5);

            const currentSurplus = fromWei(await mockToken.balanceOf(pool.address)) + fromWei(await pool.totalBorrowed()) - fromWei(await pool.totalSupply());
            expect(currentSurplus).to.be.closeTo(0, 0.00001);
        });

        it("surplus after accumulating rates should be greater than zero", async () => {
            await time.increase(time.duration.years(2));

            const poolBalance = fromWei(await mockToken.balanceOf(pool.address));

            const surplus = (await mockToken.balanceOf(pool.address)).add(await pool.totalBorrowed()).sub(await pool.totalSupply());

            expect(surplus.toNumber()).to.be.greaterThanOrEqual(0);

            expect(poolBalance).to.be.closeTo(0.5, 0.00001);
        });

        it("surplus after multiple operations should be above 0", async () => {
            await time.increase(time.duration.months(6));

            await pool.connect(user2).borrow(toWei("0.1"));

            await time.increase(time.duration.years(0.25));

            await mockToken.connect(user1).approve(pool.address, toWei("0.3"));
            await pool.connect(user1).deposit(toWei("0.3"));

            await pool.connect(user2).borrow(toWei("0.2"));

            await time.increase(time.duration.days(7));

            await mockToken.connect(user1).approve(pool.address, toWei("0.2"));
            await pool.connect(user1).deposit(toWei("0.2"));

            await pool.connect(user1).withdraw(toWei("0.27"));

            await time.increase(time.duration.years(20));

            await pool.connect(user1).withdraw(toWei("0.07"));

            await time.increase(time.duration.years(20));

            const poolBalance = await mockToken.balanceOf(pool.address);
            expect(fromWei(poolBalance)).to.be.closeTo(0.36, 0.00001);

            let surplus = poolBalance.add(await pool.totalBorrowed()).sub(await pool.totalSupply());
            expect(fromWei(surplus)).to.be.greaterThanOrEqual(0);
        });

        it("set new spread", async () => {
            expect(fromWei(await pool.balanceOf(user1.address))).to.be.closeTo(17.445068652748844, 0.000001);
            expect(fromWei(await pool.getBorrowed(user2.address))).to.be.closeTo(21.156335815936057, 0.000001);

            await ratesCalculator.setSpread(1e15);
            expect(await ratesCalculator.spread()).to.equal(1e15);

            await time.increase(time.duration.years(1));

            expect(fromWei(await pool.balanceOf(user1.address))).to.be.closeTo(18.216872080554264, 0.000001);
            expect(fromWei(await pool.getBorrowed(user2.address))).to.be.closeTo(22.121090100692832, 0.000001);

            const poolBalance = await mockToken.balanceOf(pool.address);
            expect(fromWei(poolBalance)).to.be.closeTo(0.36, 0.00001);

            let surplus = poolBalance.add(await pool.totalBorrowed()).sub(await pool.totalSupply());
            expect(fromWei(surplus)).to.be.greaterThanOrEqual(0);
        });

        it("should not allow setting spread higher than 1 Wei", async () => {
            await expect(ratesCalculator.setSpread(toWei("1").add(1))).to.be.revertedWith("Spread must be smaller than 1e18")
        });
    });

    describe('Multiple surplus recover', () => {
        let pool: Pool,
            owner: SignerWithAddress,
            user1: SignerWithAddress,
            user2: SignerWithAddress,
            user3: SignerWithAddress,
            ratesCalculator: MockVariableUtilisationRatesCalculator,
            mockToken: Contract;

        before("Deploy Pool contract", async () => {
            [owner, user1, user2, user3] = await getFixedGasSigners(10000000);
            ratesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as MockVariableUtilisationRatesCalculator;
            pool = (await deployContract(owner, PoolArtifact)) as Pool;
            const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());
            const depositIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
            await depositIndex.initialize(pool.address);
            const borrowingIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
            await borrowingIndex.initialize(pool.address);

            mockToken = (await deployContract(owner, MockTokenArtifact, [[owner.address, user1.address, user2.address, user3.address]])) as MockToken;

            await pool.initialize(
                ratesCalculator.address,
                borrowersRegistry.address,
                depositIndex.address,
                borrowingIndex.address,
                mockToken.address,
                ZERO,
                0
            );
        });

        it("multiple recovering surplus should not make pool unbalanced", async () => {
            await mockToken.connect(user1).approve(pool.address, toWei("1"));
            await pool.connect(user1).deposit(toWei("1"));

            await pool.connect(user2).borrow(toWei("0.5"));

            await mockToken.connect(user1).approve(pool.address, toWei("1"));
            await pool.connect(user1).deposit(toWei("1"));

            await recoverSurplus();
            await time.increase(time.duration.months(3));

            await mockToken.connect(user1).approve(pool.address, toWei("0.1"));
            await pool.connect(user1).deposit(toWei("0.1"));

            //time increase
            await recoverSurplus();
            await time.increase(time.duration.months(6));
            await recoverSurplus();
            await time.increase(time.duration.years(1));
            await recoverSurplus();
            await time.increase(time.duration.years(5));
            await recoverSurplus();

            //depositing, withdrawing, borrowing, repaying with time
            await pool.connect(user1).withdraw(toWei("0.1"));
            await recoverSurplus();
            await time.increase(time.duration.months(3));

            await mockToken.connect(user2).approve(pool.address, toWei("0.1"));
            await pool.connect(user2).repay(toWei("0.1"));

            await recoverSurplus();
            await time.increase(time.duration.months(3));
            await pool.connect(user2).borrow(toWei("0.5"));

            await mockToken.connect(user1).approve(pool.address, toWei("1"));
            await pool.connect(user1).deposit(toWei("1"));

            await time.increase(time.duration.years(5));
            await recoverSurplus();

            async function recoverSurplus() {
                const poolBalance = await mockToken.balanceOf(pool.address);
                const currentSurplus = (await mockToken.balanceOf(pool.address)).add(await pool.totalBorrowed()).sub(await pool.totalSupply());

                if (currentSurplus.gt(0)) {
                    const maxAvailableSurplus = (poolBalance.lt(currentSurplus)) ? poolBalance : currentSurplus;
                    if (maxAvailableSurplus.gt(BigNumber.from("2"))) {
                        await pool.connect(owner).recoverSurplus(maxAvailableSurplus.sub(BigNumber.from(2)), user3.address);
                    }
                } else {
                    //surplus can sometimes be minimally lower than zero due to finite accuracy of arithmetic operations
                    //minimal surplus of -100 Wei is acceptable
                    expect(currentSurplus.toNumber()).to.be.lessThanOrEqual(100);
                }
            }
        });
    });


    describe('Pool utilisation greater than 1', () => {
        let pool: Pool,
            owner: SignerWithAddress,
            user1: SignerWithAddress,
            user2: SignerWithAddress,
            user3: SignerWithAddress,
            ratesCalculator: MockVariableUtilisationRatesCalculator,
            mockToken: Contract;

        before("Deploy Pool contract", async () => {
            [owner, user1, user2, user3] = await getFixedGasSigners(10000000);
            ratesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as MockVariableUtilisationRatesCalculator;
            pool = (await deployContract(owner, PoolArtifact)) as Pool;
            const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());
            const depositIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
            await depositIndex.initialize(pool.address);
            const borrowingIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
            await borrowingIndex.initialize(pool.address);

            mockToken = (await deployContract(owner, MockTokenArtifact, [[owner.address, user1.address, user2.address, user3.address]])) as MockToken;

            await pool.initialize(
                ratesCalculator.address,
                borrowersRegistry.address,
                depositIndex.address,
                borrowingIndex.address,
                mockToken.address,
                ZERO,
                0
            );
        });

        it("keep rates at maximum when pool utilisation is above 1", async () => {
            await mockToken.connect(user1).approve(pool.address, toWei("1.2"));
            await pool.connect(user1).deposit(toWei("1.2"));

            expect(await mockToken.balanceOf(pool.address)).to.be.equal(toWei("1.2", "ether"));

            await pool.connect(user2).borrow(toWei("1.05")); // `1.09 -> 1.05; ~0.9083% -> 0,875%
            expect(await mockToken.balanceOf(pool.address)).to.be.equal(toWei("0.15", "ether"));

            await time.increase(time.duration.years(4));

            let poolUtilisation = await ratesCalculator.getPoolUtilisation(await pool.totalBorrowed(), await pool.totalSupply());
            expect(fromWei(poolUtilisation)).to.be.closeTo(1.0622653316645807, 0.000001);

            let poolBalance = fromWei(await mockToken.balanceOf(pool.address));
            let depositUser1 = fromWei(await pool.balanceOf(user1.address));
            let borrowedUser2 = fromWei(await pool.getBorrowed(user2.address));

            expect(depositUser1).to.be.closeTo(2.397, 0.000001);
            expect(borrowedUser2).to.be.closeTo(2.54625, 0.000001);

            await mockToken.connect(user2).approve(pool.address, toWei("2.4"));
            await pool.connect(user2).repay(toWei("2.4"));

            await pool.connect(user1).withdraw(toWei("2.19"));

            await pool.connect(user2).borrow(toWei("0.03"));
            await pool.connect(user1).withdraw(toWei("0.01999999999"));

            depositUser1 = fromWei(await pool.balanceOf(user1.address));

            expect(depositUser1).to.be.closeTo(0.18700002064989066, 0.000001);

            expect(depositUser1).to.be.below(borrowedUser2 + poolBalance);

            await time.increase(time.duration.years(1));

            poolBalance = fromWei(await mockToken.balanceOf(pool.address));
            depositUser1 = fromWei(await pool.balanceOf(user1.address));
            borrowedUser2 = fromWei(await pool.getBorrowed(user2.address));

            expect(depositUser1).to.be.below(borrowedUser2 + poolBalance);

            poolUtilisation = await ratesCalculator.getPoolUtilisation(await pool.totalBorrowed(), await pool.totalSupply());
            expect(fromWei(poolUtilisation)).to.be.above(1);

            expect(fromWei(await pool.getDepositRate())).to.equal(0.6);
            expect(fromWei(await pool.getBorrowingRate())).to.equal(0.75);
        });

        it("recover surplus funds", async () => {
            const poolBalance = await mockToken.balanceOf(pool.address);
            const totalBorrowed = await pool.totalBorrowed();
            const totalSupply = await pool.totalSupply();
            const depositRate = await pool.getDepositRate();
            const borrowingRate = await pool.getBorrowingRate();

            const currentSurplus = poolBalance.add(totalBorrowed).sub(totalSupply);
            const maxAvailableSurplus = (poolBalance.lt(currentSurplus)) ? poolBalance : currentSurplus;

            expect(fromWei(maxAvailableSurplus)).to.be.closeTo(0.31000000001, 0.000001);
            expect(fromWei(poolBalance)).to.equal(0.31000000001);
            expect(fromWei(totalSupply)).to.be.closeTo(0.2672173602778801, 0.00001);
            expect(fromWei(totalBorrowed)).to.be.closeTo(0.27652170033485013, 0.00001);

            let receiverBalanceBeforeRecover = await mockToken.balanceOf(user3.address);

            await pool.connect(owner).recoverSurplus(maxAvailableSurplus, user3.address);


            let receiverBalanceAfterRecover = await mockToken.balanceOf(user3.address);

            expect(fromWei(await mockToken.balanceOf(pool.address))).to.be.closeTo(0, 0.00001);
            expect(fromWei(receiverBalanceAfterRecover)).to.be.closeTo(fromWei(receiverBalanceBeforeRecover.add(maxAvailableSurplus)), 0.00001);
            await expect(pool.connect(owner).recoverSurplus(toWei("0.01"), user3.address)).to.be.revertedWith(customError("InsufficientPoolFunds"));

            expect(fromWei(await pool.totalSupply())).to.be.closeTo(fromWei(totalSupply), 0.00001);
            expect(fromWei(await pool.getDepositRate())).to.equal(fromWei(depositRate));
            expect(fromWei(await pool.getBorrowingRate())).to.equal(fromWei(borrowingRate));
        });

        it("check condition of pool after a year", async () => {
            await time.increase(time.duration.years(1));

            expect(fromWei(await pool.getDepositRate())).to.equal(0.6);
            expect(fromWei(await pool.getBorrowingRate())).to.equal(0.75);

            expect(fromWei(await mockToken.balanceOf(pool.address))).to.be.closeTo(0, 0.00001);
            expect(fromWei(await pool.totalSupply())).to.be.closeTo(0.34743470753689504, 0.00001);
        });

        it("repay rest of loan and check pool condition", async () => {
            let borrowed = await pool.getBorrowed(user2.address);
            await mockToken.connect(user2).approve(pool.address, borrowed);
            await pool.connect(user2).repay(borrowed);

            expect(fromWei(await pool.totalSupply())).to.be.closeTo(0.34743471008057014, 0.00001);
            expect(fromWei(await pool.getDepositRate())).to.closeTo(0, 0.00001);
            expect(fromWei(await pool.getBorrowingRate())).to.closeTo(0.03, 0.00001);
        });

        it("withdraw rest of deposit and check pool condition", async () => {
            await pool.connect(user1).withdraw(await pool.balanceOf(user1.address));
            expect(fromWei(await pool.totalSupply())).to.be.closeTo(0, 0.00001);
            expect(fromWei(await pool.totalBorrowed())).to.be.closeTo(0, 0.00001);
            //there are some residual funds due to deposit rate offset
            expect(fromWei(await mockToken.balanceOf(pool.address))).to.be.closeTo(0.02935867114845466, 0.000001);
        });

        it("recover surplus and check pool condition", async () => {
            const poolBalance = await mockToken.balanceOf(pool.address);
            const totalBorrowed = await pool.totalBorrowed();
            const totalSupply = await pool.totalSupply();

            const currentSurplus = poolBalance.add(totalBorrowed).sub(totalSupply);
            const maxAvailableSurplus = (poolBalance.lt(currentSurplus)) ? poolBalance : currentSurplus;

            await pool.connect(owner).recoverSurplus(maxAvailableSurplus, user3.address);

            expect(fromWei(await pool.totalSupply())).to.be.closeTo(0, 0.00001);
            expect(fromWei(await pool.totalBorrowed())).to.be.closeTo(0, 0.00001);
            expect(fromWei(await mockToken.balanceOf(pool.address))).to.be.closeTo(0, 0.00001);
        });
    });

    describe('Freeze pool', () => {
        let pool: Pool,
            originalPool: Pool,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            borrower: SignerWithAddress,
            admin: SignerWithAddress,
            mockVariableUtilisationRatesCalculator: MockVariableUtilisationRatesCalculator,
            mockToken: Contract;

        before("should deploy a pool", async () => {
            [owner, depositor, borrower, admin] = await getFixedGasSigners(10000000);
            originalPool = (await deployContract(owner, PoolArtifact)) as Pool;

            pool = (await deployContract(owner, PoolArtifact)) as Pool;

            mockVariableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as MockVariableUtilisationRatesCalculator;
            const borrowersRegistry = (await deployContract(owner, OpenBorrowersRegistryArtifact)) as OpenBorrowersRegistry;
            const depositIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
            await depositIndex.initialize(pool.address);
            const borrowingIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
            await borrowingIndex.initialize(pool.address);

            mockToken = (await deployContract(owner, MockTokenArtifact, [[owner.address, borrower.address, depositor.address]])) as MockToken;

            await pool.initialize(
                mockVariableUtilisationRatesCalculator.address,
                borrowersRegistry.address,
                depositIndex.address,
                borrowingIndex.address,
                mockToken.address,
                ZERO,
                0
            );
        });


        it("should allow basic actions for a standard Rates calculator ", async () => {
            await mockToken.connect(depositor).approve(pool.address, toWei("1.2"));
            await pool.connect(depositor).deposit(toWei("1.2"));

            await pool.connect(depositor).withdraw(toWei("0.2"));
            await pool.connect(borrower).borrow(toWei("0.7"));

            await mockToken.connect(borrower).approve(pool.address, toWei("0.2"));
            await pool.connect(borrower).repay(toWei("0.2"));

            expect(fromWei(await pool.getBorrowed(borrower.address))).to.be.closeTo(0.5, 0.000001);
            expect(fromWei(await pool.totalSupply())).to.be.closeTo(1, 0.000001);
            expect(fromWei(await pool.totalBorrowed())).to.be.closeTo(0.5, 0.000001);
            expect(fromWei(await mockToken.balanceOf(pool.address))).to.be.closeTo(0.5, 0.000001);
        });


        it("should set a zero address calculator to freeze the pool", async () => {
            await pool.connect(owner).setRatesCalculator(ethers.constants.AddressZero)

            expect(fromWei(await pool.totalSupply())).to.be.closeTo(1, 0.000001);
            expect(fromWei(await pool.totalBorrowed())).to.be.closeTo(0.5, 0.000001);
            expect(fromWei(await mockToken.balanceOf(pool.address))).to.be.closeTo(0.5, 0.000001);
        });


        it("should revert basic actions for a freeze calculator ", async () => {
            await mockToken.connect(depositor).approve(pool.address, toWei("1.0"));
            await expect(pool.connect(depositor).deposit(toWei("1.0"))).to.be.revertedWith(customError("PoolFrozen"));

            await expect(pool.connect(depositor).withdraw(toWei("0.2"))).to.be.revertedWith(customError("PoolFrozen"));
            await expect(pool.connect(borrower).borrow(toWei("0.2"))).to.be.revertedWith(customError("PoolFrozen"));

            await mockToken.connect(borrower).approve(pool.address, toWei("0.5"));
            await expect(pool.connect(borrower).repay(toWei("0.5"))).to.be.revertedWith(customError("PoolFrozen"));

            expect(fromWei(await pool.totalSupply())).to.be.closeTo(1, 0.000001);
            expect(fromWei(await pool.totalBorrowed())).to.be.closeTo(0.5, 0.000001);
            expect(fromWei(await mockToken.balanceOf(pool.address))).to.be.closeTo(0.5, 0.000001);
        });


        it("should set back a standard calculator", async () => {
            await pool.connect(owner).setRatesCalculator(mockVariableUtilisationRatesCalculator.address)
        });

        it("should allow basic actions for a standard calculator ", async () => {
            expect(fromWei(await pool.totalSupply())).to.be.closeTo(1, 0.000001);
            expect(fromWei(await pool.totalBorrowed())).to.be.closeTo(0.5, 0.000001);
            expect(fromWei(await mockToken.balanceOf(pool.address))).to.be.closeTo(0.5, 0.000001);

            await mockToken.connect(depositor).approve(pool.address, toWei("1.0"));
            await expect(pool.connect(depositor).deposit(toWei("1.0"))).not.to.be.reverted;

            await expect(pool.connect(depositor).withdraw(toWei("0.2"))).not.to.be.reverted;
            await expect(pool.connect(borrower).borrow(toWei("0.2"))).not.to.be.reverted;

            await mockToken.connect(borrower).approve(pool.address, toWei("0.5"));
            await expect(pool.connect(borrower).repay(toWei("0.5"))).not.to.be.reverted;
        });
    });
});
