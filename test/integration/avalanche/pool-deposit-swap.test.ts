import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import PoolArtifact from '../../../artifacts/contracts/Pool.sol/Pool.json';
import DepositSwapAvalancheArtifact from '../../../artifacts/contracts/DepositSwapAvalanche.sol/DepositSwapAvalanche.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {customError, fromWei, getFixedGasSigners, time, toWei, wavaxAbi, yakRouterAbi} from "../../_helpers";
import {deployMockContract} from '@ethereum-waffle/mock-contract';
import {LinearIndex, MockToken, OpenBorrowersRegistry, Pool, DepositSwapAvalanche} from "../../../typechain";
import {BigNumber, Contract} from "ethers";
import TOKEN_ADDRESSES from "../../../common/addresses/avax/token_addresses.json";

chai.use(solidity);
const ZERO = ethers.constants.AddressZero;
const WAVAX_POOL_TUP_ADDRESS = "0xD26E504fc642B96751fD55D3E68AF295806542f5";
const USDC_POOL_TUP_ADDRESS = "0x2323dAC85C6Ab9bd6a8B5Fb75B0581E31232d12b";
const WAVAX_CONTRACT_ADDRESS = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7";
const yakRouterAddress = '0xC4729E56b831d74bBc18797e0e17A295fA77488c';

const {provider, deployContract} = waffle;

const yakRouter = new ethers.Contract(
    yakRouterAddress,
    yakRouterAbi,
    provider
)

async function query(tknFrom: string, tknTo: string, amountIn: BigNumber) {
    const maxHops = 1
    const gasPrice = ethers.utils.parseUnits('225', 'gwei')
    return await yakRouter.findBestPathWithGas(
        amountIn,
        tknFrom,
        tknTo,
        maxHops,
        gasPrice,
        { gasLimit: 1e9 }
    )
}

describe('Pool with variable utilisation interest rates', () => {
    let wavaxPool: Pool,
        usdcPool: Pool,
        wavaxContract: Contract,
        depositSwapContract: Contract,
        owner: SignerWithAddress,
        depositor: SignerWithAddress;

    beforeEach(async () => {
        [owner, depositor] = await getFixedGasSigners(10000000);

        depositSwapContract = (await deployContract(owner, DepositSwapAvalancheArtifact)) as DepositSwapAvalanche;
        wavaxPool = new ethers.Contract(WAVAX_POOL_TUP_ADDRESS, PoolArtifact.abi, depositor) as Pool;
        usdcPool = new ethers.Contract(USDC_POOL_TUP_ADDRESS, PoolArtifact.abi, depositor) as Pool;
        wavaxContract = new ethers.Contract(WAVAX_CONTRACT_ADDRESS, wavaxAbi, depositor) as Pool;

    });

    it("should deposit AVAX to WAVAX", async () => {
        expect(await wavaxContract.balanceOf(depositor.address)).to.be.equal(0);
        await wavaxContract.connect(depositor).deposit({value: toWei("10.0")});
        expect(fromWei(await wavaxContract.balanceOf(depositor.address))).to.be.equal(10);
    });

    it("should deposit requested value", async () => {
        expect(fromWei(await wavaxPool.balanceOf(depositor.address))).to.equal(0);

        await wavaxContract.connect(depositor).approve(wavaxPool.address, toWei("10.0"));
        await wavaxPool.connect(depositor).deposit(toWei("10.0"));

        expect(await wavaxContract.balanceOf(depositor.address)).to.equal(0);
        expect(fromWei(await wavaxPool.balanceOf(depositor.address))).to.equal(10);
    });

    it("should swap deposits from AVAX to USDC", async () => {
        expect(fromWei(await wavaxPool.balanceOf(depositor.address))).to.gte(10);
        expect(fromWei(await usdcPool.balanceOf(depositor.address))).to.equal(0);

        const queryRes = await query(TOKEN_ADDRESSES['AVAX'], TOKEN_ADDRESSES['USDC'], toWei("10.0"));
        const amountOutMin = queryRes.amounts[queryRes.amounts.length-1];

        console.log(`Input amount: ${queryRes.amounts[0]} (${fromWei(queryRes.amounts[0])})`)
        console.log(`MinOut: ${amountOutMin} (${amountOutMin.mul(98).div(100)})`)

        await wavaxPool.connect(depositor).approve(depositSwapContract.address, toWei("10.0"));
        await depositSwapContract.connect(depositor).depositSwap(
            queryRes.amounts[0],
            amountOutMin.mul(98).div(100),
            queryRes.path,
            queryRes.adapters
        )

        expect(fromWei(await wavaxPool.balanceOf(depositor.address))).to.equal(0);
        expect(fromWei(await usdcPool.balanceOf(depositor.address))).to.gte(10);
    });
});

