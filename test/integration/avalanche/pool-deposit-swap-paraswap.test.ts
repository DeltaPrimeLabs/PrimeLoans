import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import { constructSimpleSDK, SimpleFetchSDK, SwapSide } from '@paraswap/sdk';
import axios from 'axios';

import PoolArtifact from '../../../artifacts/contracts/Pool.sol/Pool.json';
import DepositSwapAvalancheArtifact from '../../../artifacts/contracts/DepositSwapAvalanche.sol/DepositSwapAvalanche.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {fromWei, getFixedGasSigners, getRedstonePrices, getTokensPricesMap, parseParaSwapRouteData, toWei, wavaxAbi} from "../../_helpers";
import {Pool, DepositSwapAvalanche} from "../../../typechain";
import {BigNumber, Contract} from "ethers";
import TOKEN_ADDRESSES from "../../../common/addresses/avax/token_addresses.json";
import { formatUnits } from 'ethers/lib/utils';

chai.use(solidity);
const WAVAX_POOL_TUP_ADDRESS = "0xD26E504fc642B96751fD55D3E68AF295806542f5";
const USDC_POOL_TUP_ADDRESS = "0x2323dAC85C6Ab9bd6a8B5Fb75B0581E31232d12b";
const WAVAX_CONTRACT_ADDRESS = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7";
const yakRouterAddress = '0xC4729E56b831d74bBc18797e0e17A295fA77488c';

const {deployContract} = waffle;

describe('Pool with variable utilisation interest rates', () => {
    let wavaxPool: Pool,
        usdcPool: Pool,
        wavaxContract: Contract,
        depositSwapContract: Contract,
        owner: SignerWithAddress,
        depositor: SignerWithAddress,
        tokensPrices: Map<string, number>,
        paraSwapMin: SimpleFetchSDK;

    const getSwapData = async (userAddress: string, srcToken: keyof typeof TOKEN_ADDRESSES, destToken: keyof typeof TOKEN_ADDRESSES, srcAmount: any) => {
        const priceRoute = await paraSwapMin.swap.getRate({
            srcToken: TOKEN_ADDRESSES[srcToken],
            destToken: TOKEN_ADDRESSES[destToken],
            amount: srcAmount.toString(),
            userAddress,
            side: SwapSide.SELL,
        });
        const txParams = await paraSwapMin.swap.buildTx({
            srcToken: priceRoute.srcToken,
            destToken: priceRoute.destToken,
            srcAmount: priceRoute.srcAmount,
            slippage: 300,
            priceRoute,
            userAddress,
            partner: 'anon',
        }, {
            ignoreChecks: true,
        });
        const swapData = parseParaSwapRouteData(txParams);
        return swapData;
    };

    beforeEach(async () => {
        [owner, depositor] = await getFixedGasSigners(10000000);

        depositSwapContract = (await deployContract(owner, DepositSwapAvalancheArtifact)) as DepositSwapAvalanche;
        wavaxPool = new ethers.Contract(WAVAX_POOL_TUP_ADDRESS, PoolArtifact.abi, depositor) as Pool;
        usdcPool = new ethers.Contract(USDC_POOL_TUP_ADDRESS, PoolArtifact.abi, depositor) as Pool;
        wavaxContract = new ethers.Contract(WAVAX_CONTRACT_ADDRESS, wavaxAbi, depositor) as Pool;

        let assetsList = ['AVAX', 'USDC'];
        tokensPrices = await getTokensPricesMap(assetsList, "avalanche", getRedstonePrices, []);

        paraSwapMin = constructSimpleSDK({chainId: 43114, axios});
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

        const swapData = await getSwapData(depositSwapContract.address, 'AVAX', 'USDC', toWei("10.0"));

        await wavaxPool.connect(depositor).approve(depositSwapContract.address, toWei("10.0"));
        await depositSwapContract.connect(depositor).depositSwapParaSwap(
            swapData.selector,
            swapData.data,
            TOKEN_ADDRESSES['AVAX'],
            toWei("10.0"),
            TOKEN_ADDRESSES['USDC'],
            1
        )

        expect(fromWei(await wavaxPool.balanceOf(depositor.address))).to.closeTo(0, 0.01);
        expect(parseFloat(formatUnits(await usdcPool.balanceOf(depositor.address), 6))).to.closeTo(tokensPrices.get("AVAX")! * 10, 1);
    });
});
