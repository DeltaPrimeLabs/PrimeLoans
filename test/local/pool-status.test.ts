import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import PoolArtifact from '../../artifacts/contracts/Pool.sol/Pool.json';
import MockTokenArtifact from "../../artifacts/contracts/mock/MockToken.sol/MockToken.json";
import VariableUtilisationRatesCalculatorArtifact
    from '../../artifacts/contracts/mock/MockVariableUtilisationRatesCalculator.sol/MockVariableUtilisationRatesCalculator.json';
import LinearIndexArtifact from '../../artifacts/contracts/LinearIndex.sol/LinearIndex.json';
import OpenBorrowersRegistryArtifact
    from '../../artifacts/contracts/mock/OpenBorrowersRegistry.sol/OpenBorrowersRegistry.json';
import MockBorrowersRegistryArtifact
    from '../../artifacts/contracts/mock/MockBorrowersRegistry.sol/MockBorrowersRegistry.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {customError, fromWei, getFixedGasSigners, time, toWei} from "../_helpers";
import {LinearIndex, MockToken, OpenBorrowersRegistry, Pool, MockVariableUtilisationRatesCalculator, MockBorrowersRegistry} from "../../typechain";
import {Contract} from "ethers";

chai.use(solidity);

const {deployContract} = waffle;
const ZERO = ethers.constants.AddressZero;

describe('Pool status', () => {
    let pool: Pool,
        owner: SignerWithAddress,
        depositor: SignerWithAddress,
        mockToken: Contract,
        MockVariableUtilisationRatesCalculator: MockVariableUtilisationRatesCalculator;

    before("Deploy Pool contract", async () => {
        [owner, depositor] = await getFixedGasSigners(10000000);
        pool = (await deployContract(owner, PoolArtifact)) as Pool;

        mockToken = (await deployContract(owner, MockTokenArtifact, [[depositor.address, owner.address]])) as MockToken;

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
            mockToken.address,
            ZERO,
            0
        );

        await mockToken.connect(depositor).approve(pool.address, toWei("2.0"));
        await pool.connect(depositor).deposit(toWei("2.0"));
    });

    it("should return pool's status", async () => {
        await pool.borrow(toWei("1.0"));

        let totalSupply = await pool.totalSupply();
        let depositRate = await pool.getDepositRate();
        let borrowingRate = await pool.getBorrowingRate();
        let totalBorrowed = await pool.totalBorrowed();
        let maxPoolUtilisationForBorrowing = await pool.getMaxPoolUtilisationForBorrowing();

        let status = await pool.getFullPoolStatus();
        expect(status[0]).to.be.eq(totalSupply);
        expect(status[1]).to.be.eq(depositRate);
        expect(status[2]).to.be.eq(borrowingRate);
        expect(status[3]).to.be.eq(totalBorrowed);
        expect(status[4]).to.be.eq(maxPoolUtilisationForBorrowing);
    });
});
