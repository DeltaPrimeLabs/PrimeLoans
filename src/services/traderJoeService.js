import {
  LB_ROUTER_V21_ADDRESS, 
  LBRouterV21ABI
} from '@traderjoe-xyz/sdk-v2';
import lbHooksBaseRewarder from '/artifacts/contracts/interfaces/joe-v2/ILBHooksBaseRewarder.sol/ILBHooksBaseRewarder.json';
import * as traderJoeSdk from '@traderjoe-xyz/sdk-v2';
import { JSBI, ERC20ABI } from '@traderjoe-xyz/sdk';
import { Token, TokenAmount } from '@traderjoe-xyz/sdk-core';
import { ethers, BigNumber, utils } from 'ethers';
import axios from 'axios';
import config from '../config';

const CHAIN_ID = config.chainId;
const LBPairABI = [
  'function getReserves() public view returns (uint128, uint128)',
  'function getActiveId() public view returns (uint24)',
  'function balanceOf(address, uint256) public view returns (uint256)',
  'function getBin(uint24) public view returns (uint128, uint128)',
  'function totalSupply(uint256) public view returns (uint256)'
];

export default class TraderJoeService {
  calculateGasMargin(value, margin = 1000) {
    return BigNumber.from(value)
      .mul(BigNumber.from(10000).add(BigNumber.from(margin)))
      .div(BigNumber.from(10000));
  }

  initializeToken(tokenData) {
    // initialize Token
    const token = new Token(
      CHAIN_ID,
      tokenData.address,
      tokenData.decimals,
      tokenData.symbol,
      tokenData.name
    );

    return token;
  }

  async getLBPairReservesAndActiveBin(lbPairAddress, provider) {
    const lbPairContract = new ethers.Contract(lbPairAddress, LBPairABI, provider);
    const res = await Promise.all([
      lbPairContract.getReserves(),
      lbPairContract.getActiveId()
    ]);

    return res;
  }

  getIdSlippageFromPriceSlippage(priceSlippage, binStep) {
    return Math.floor(
      Math.log(1 + priceSlippage) / Math.log(1 + binStep / 1e4)
    );
  }

  getAddLiquidityParameters(
    address,
    tokenX,
    tokenY,
    tokenXValue,
    tokenYValue,
    distributionMethod,
    binStep,
    activeBinId,
    binRange,
    userPriceSlippage,
    userAmountsSlippage
  ) {
    // wrap into TokenAmount
    const tokenXAmount = new TokenAmount(tokenX, JSBI.BigInt(tokenXValue));
    const tokenYAmount = new TokenAmount(tokenY, JSBI.BigInt(tokenYValue));

    const allowedAmountsSlippage = userAmountsSlippage * 100;
    const minTokenXAmount =  JSBI.divide(
      JSBI.multiply(tokenXAmount.raw, JSBI.BigInt(10000 - allowedAmountsSlippage)),
      JSBI.BigInt(10000)
    );
    const minTokenYAmount =  JSBI.divide(
      JSBI.multiply(tokenYAmount.raw, JSBI.BigInt(10000 - allowedAmountsSlippage)),
      JSBI.BigInt(10000)
    );

    const allowedPriceSlippage = userPriceSlippage * 100;
    const priceSlippage = allowedPriceSlippage / 10000; // 0.005

    // set deadline for the transaction
    const currenTimeInSec = Math.floor((new Date().getTime()) / 1000);
    const deadline = currenTimeInSec + 3600;

    const idSlippage = this.getIdSlippageFromPriceSlippage(
      priceSlippage,
      Number(binStep)
    );

    // getting distribution parameters for selected shape given a price range
    let { deltaIds, distributionX, distributionY } = traderJoeSdk[distributionMethod](
      activeBinId,
      binRange,
      [tokenXAmount, tokenYAmount]
    );

    // declare liquidity parameters
    const addLiquidityInput = {
      tokenX: tokenX.address,
      tokenY: tokenY.address,
      binStep: Number(binStep),
      amountX: tokenXAmount.raw.toString(),
      amountY: tokenYAmount.raw.toString(),
      amountXMin: minTokenXAmount.toString(),
      amountYMin: minTokenYAmount.toString(),
      activeIdDesired: activeBinId,
      idSlippage,
      deltaIds,
      distributionX,
      distributionY,
      to: address,
      refundTo: address,
      deadline 
    };

    return addLiquidityInput;
  }

  async approveLBRouter(tokenAddress, tokenAmount, account, provider) {
    const spender = LB_ROUTER_V21_ADDRESS[CHAIN_ID];
    const amount = BigNumber.from(tokenAmount);
    const tokenContract = new ethers.Contract(tokenAddress, ERC20ABI, provider.getSigner());
    const allowance = utils.formatUnits(await tokenContract.allowance(account, spender));

    if (parseFloat(allowance) < parseFloat(utils.formatUnits(amount))) {
      const estimatedGas = await tokenContract.estimateGas.approve(spender, amount)
      const tx = await tokenContract.approve(
        spender, 
        amount, 
        { gasLimit: this.calculateGasMargin(estimatedGas) }
      )
      await tx.wait();
    }
  }

  async addLiquidity({ provider, addLiquidityInput }) {
    try{
      await this.approveLBRouter(addLiquidityInput.tokenX, addLiquidityInput.amountX, addLiquidityInput.to, provider);
      await this.approveLBRouter(addLiquidityInput.tokenY, addLiquidityInput.amountY, addLiquidityInput.to, provider);
      // init router contract
      const routerContract = new ethers.Contract(
        LB_ROUTER_V21_ADDRESS[CHAIN_ID],
        LBRouterV21ABI,
        provider.getSigner()
      );

      const estimate = routerContract.estimateGas.addLiquidity // 'addLiquidityAVAX' if one of the tokens is AVAX
      const method = routerContract.addLiquidity

      // set AVAX amount, such as tokenAmountAVAX.raw.toString(), when one of the tokens is AVAX; otherwise, set to null
      const value = null 

      // call methods
      const estimatedGasLimit = await estimate(
        addLiquidityInput,
        value ? { value } : {}
      )

      await method(addLiquidityInput, {
        ...(value ? { value } : {}),
        gasLimit: this.calculateGasMargin(estimatedGasLimit)
      })
    } catch(error) {
      console.error(error);
    }
  }

  async getRemoveLiquidityParameters(
    smartLoanAddress,
    lbPairAddress,
    provider,
    tokenX,
    tokenY,
    binStep,
    allowedAmountsSlippage,
    binIdsToRemove
  ) {
    const lbPairContract = new ethers.Contract(lbPairAddress, LBPairABI, provider);
    const amounts = [];
    const ids = [];
    let totalXBalanceWithdrawn = BigNumber.from(0);
    let totalYBalanceWithdrawn = BigNumber.from(0);

    for (let binId of binIdsToRemove) {
      const [lbTokenAmount, binReserves, totalSupply] = await Promise.all([
        lbPairContract.balanceOf(smartLoanAddress, binId),
        lbPairContract.getBin(binId),
        lbPairContract.totalSupply(binId)
      ]);

      if (lbTokenAmount != BigInt(0)) {
        ids.push(binId);
        amounts.push(lbTokenAmount);

        totalXBalanceWithdrawn = totalXBalanceWithdrawn
            .add(BigNumber.from(lbTokenAmount)
                .mul(BigNumber.from(binReserves[0]))
                .div(BigNumber.from(totalSupply))
            );
        totalYBalanceWithdrawn = totalYBalanceWithdrawn
            .add(BigNumber.from(lbTokenAmount)
                .mul(BigNumber.from(binReserves[1]))
                .div(BigNumber.from(totalSupply))
            );
      }
    }

    // To-do: set the dynamic amount slippage tolerance. for now we set it to 0.5%
    const minTokenXAmount = totalXBalanceWithdrawn
      .mul(BigNumber.from(10000 - allowedAmountsSlippage))
      .div(BigNumber.from(10000));
    const minTokenYAmount = totalYBalanceWithdrawn
      .mul(BigNumber.from(10000 - allowedAmountsSlippage))
      .div(BigNumber.from(10000));

    // set transaction deadline
    const currenTimeInSec =  Math.floor((new Date().getTime()) / 1000);
    const deadline = currenTimeInSec + 3600;

    // set array of remove liquidity parameters
    const removeLiquidityParams = [
      tokenX.address,
      tokenY.address,
      binStep,
      minTokenXAmount.toString(),
      minTokenYAmount.toString(),
      ids,
      amounts,
      smartLoanAddress,
      deadline
    ];

    return removeLiquidityParams;
  }

  async getRewardsInfo(loan, market) {
    try {
      const URL = `https://2t8c1g5jra.execute-api.us-east-1.amazonaws.com/traderjoe/rewards/claimable?chain=${window.chain}&loan=${loan}&market=${market}`;
      const rewardsInfo = await axios.get(URL);

      return rewardsInfo.data;
    } catch (error) {
      console.error(`fetching rewards info failed. ${error}`);
    }
  }

  async getRewardsInfoV2_2(rewarder, primeAccountAddress, binIds, provider) {
    try {
      const lbHooksSimpleRewarder = new ethers.Contract(rewarder, lbHooksBaseRewarder.abi, provider);

      return lbHooksSimpleRewarder.getPendingRewards(primeAccountAddress, binIds);
    } catch (error) {
      console.error(`fetching rewards info failed. ${error}`);
    }
  }
}