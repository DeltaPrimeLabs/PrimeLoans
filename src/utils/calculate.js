import config from "../config";

const ethers = require('ethers');
import IVectorFinanceStakingArtifact
  from '../../artifacts/contracts/interfaces/IVectorFinanceStaking.sol/IVectorFinanceStaking.json';
import IVectorRewarder
  from '../../artifacts/contracts/interfaces/IVectorRewarder.sol/IVectorRewarder.json';
import {BigNumber} from "ethers";
import ApolloClient from "apollo-boost";
import gql from "graphql-tag";
import TOKEN_ADDRESSES from '../../common/addresses/avax/token_addresses.json';
import redstone from 'redstone-api';
import erc20ABI from '../../test/abis/ERC20.json';

export function minAvaxToBeBought(amount, currentSlippage) {
  return amount / (1 + (currentSlippage ? currentSlippage : 0));
}

export function calculateHealth(tokens) {

  let weightedCollateral = tokens.reduce((acc, t) => acc + t.price * (t.balance - t.borrowed) * t.debtCoverage, 0);
  let weightedBorrowed = tokens.reduce((acc, t) => acc + t.price * t.borrowed * t.debtCoverage, 0);
  let borrowed = tokens.reduce((acc, t) => acc + t.price * t.borrowed, 0);

  if (borrowed === 0) return 1;

  return Math.max(weightedCollateral >= 0 ? (weightedCollateral + weightedBorrowed - borrowed) / weightedCollateral : 0, 0);
}

export function calculateMaxApy(pools, apy) {
  if (!pools) return;
  return Math.max(apy * 5.5 - 4.5 * Math.min(...Object.values(pools).map(pool => pool.borrowingAPY)), apy);
}

export function mergeArrays(arrays) {
  return [...new Set(arrays.flat())];
}

export function parseLogs(logs) {
  const config = require('../config');

  let loanEvents = [];

  logs.forEach(log => {
    let event = {
      type: log.name,
      time: new Date(parseInt(log.timestamp.toString()) * 1000),
      tx: log.id
    };

    if (event.type === 'Bought' || event.type === 'Sold') {
      event.asset = ethers.utils.parseBytes32String(log.toAsset);
      event.value = parseFloat(ethers.utils.formatUnits(log.amount, config.ASSETS_CONFIG[event.asset].decimals));
    } else {
      event.value = parseFloat(ethers.utils.formatEther(log.amount));
    }

    loanEvents.unshift(event);
  });

  return loanEvents;
}

export function roundWithPrecision(num, precision) {
  var multiplier = Math.pow(10, precision);
  return Math.round( num * multiplier ) / multiplier;
}

export function round(num) {
  return roundWithPrecision(num, 18);
}

export function aprToApy(apr) {
  const compoundingPeriods = 100000;
  return Math.pow(1 + (apr / compoundingPeriods), compoundingPeriods) - 1;
}

export function removePaddedTrailingZeros(numberString) {
  return numberString.replace(/([0-9]+(\.[0-9]+[1-9])?)(\.?0+$)/, '$1');
}

export async function yieldYakApy(farmAddress) {
  const apysUrl = 'https://staging-api.yieldyak.com/apys';
  return (await (await fetch(apysUrl)).json())[farmAddress].apy / 100;
}

export async function vectorFinanceApy(token) {
  const apysUrl = 'https://api.vectorfinance.io/api/v1/vtx/apr';
  return (await (await fetch(apysUrl)).json()).Staking[token].total / 100;
}

export async function yieldYakRewards(stakingContractAddress, address) {
  const tokenContract = new ethers.Contract(stakingContractAddress, erc20ABI, provider.getSigner());
  const totalSupply = formatUnits(await tokenContract.totalSupply(), 18);
  const totalDeposits = formatUnits(await tokenContract.totalDeposits(), 18);
  const yrtToAvaxConversionRate = totalDeposits / totalSupply;
  const stakedYrtWei = await tokenContract.balanceOf(address);
  const stakedYrt = formatUnits(stakedYrtWei, 18);

  return stakedYrt * yrtToAvaxConversionRate - stakedYrt;
}

export async function yieldYakBalance(stakingContractAddress, address) {
  const tokenContract = new ethers.Contract(stakingContractAddress, erc20ABI, provider.getSigner());
  const stakedYrtWei = await tokenContract.balanceOf(address);

  return formatUnits(stakedYrtWei, 18);
}

export async function yieldYakStaked(address) {
  let query = `
    {   
      smartLoan(id: "${address}") {
        YY_AAVE_AVAX
        YY_PTP_sAVAX
        YY_PNG_AVAX_USDC_LP
        YY_PNG_AVAX_ETH_LP
        YY_TJ_AVAX_USDC_LP
        YY_TJ_AVAX_ETH_LP
        YY_TJ_AVAX_sAVAX_LP
      }
    }
  `;

  const client = new ApolloClient({
    uri: config.subgraph
  });
  console.log(await client.query({query: gql(query)}))

  return (await client.query({query: gql(query)})).data.smartLoan;
}

export async function vectorFinanceBalance(stakingContractAddress, address, decimals = 18) {
  const tokenContract = new ethers.Contract(stakingContractAddress, IVectorFinanceStakingArtifact.abi, provider.getSigner());

  return formatUnits(await tokenContract.balance(address), BigNumber.from(decimals.toString()));
}

export async function vectorFinanceRewards(stakingContractAddress, loanAddress) {
  const stakingContract = new ethers.Contract(stakingContractAddress, IVectorFinanceStakingArtifact.abi, provider.getSigner());
  const rewarderAddress = await stakingContract.rewarder();

  const rewarderContract = new ethers.Contract(rewarderAddress, IVectorRewarder.abi, provider.getSigner());

  let i = 0;
  let totalEarned = 0;

  let iterate = true;
  while (iterate) {
    try {
      let tokenAddress = await rewarderContract.rewardTokens(i);
      let tokenContract = new ethers.Contract(tokenAddress, erc20ABI, provider.getSigner());

      let earned = formatUnits(await rewarderContract.earned(loanAddress, tokenAddress), await tokenContract.decimals());

      let token = Object.entries(TOKEN_ADDRESSES).find(([, address]) => address.toLowerCase() === tokenAddress.toLowerCase());

      //TODO: get prices from store
      let price = (await redstone.getPrice(token[0])).value;

      totalEarned += price * earned;
    } catch (e) {
      iterate = false;
    }

    i++;
  }

  return totalEarned;
}


export async function getPangolinLpApr(url) {
  let apr;

  if (url) {
    const resp = await fetch(url);
    const json = await resp.json();

    apr = json.swapFeeApr / 100;
  } else {
    apr = 0;
  }

  return apr;
}

export async function getTraderJoeLpApr(lpAddress) {
  let tjSubgraphUrl = 'https://api.thegraph.com/subgraphs/name/traderjoe-xyz/exchange';

  const FEE_RATE = 0.0025;

  lpAddress = lpAddress.toLowerCase();

  let aprDate = new Date();

  const date = Math.round(aprDate.getTime() / 1000 - 32 * 3600);

  const pairQuery = gql(`
{
  pairs(
    first: 1
    where: {id: "${lpAddress}"}
  ) {
    id
    name
    token0Price
    token1Price
    token0 {
      id
      symbol
      decimals
    }
    token1 {
      id
      symbol
      decimals
    }
    reserve0
    reserve1
    reserveUSD
    volumeUSD
    hourData(
        first: 25
        where: {date_gte: ${date}}
        orderBy: date
        orderDirection: desc
      ) {
        untrackedVolumeUSD
        volumeUSD
        date
        volumeToken0
        volumeToken1
      }
    timestamp
    }
  }
`)


  const client = new ApolloClient({
    uri: tjSubgraphUrl
  });

  const response = await client.query({query: pairQuery});

  const hourData = response.data.pairs[0].hourData;
  hourData.shift();

  let volumeUSD = parseFloat(hourData.reduce((sum, data) => sum + parseFloat(data.volumeUSD), 0));
  let reserveUSD = parseFloat(response.data.pairs[0].reserveUSD);



  const feesUSD = volumeUSD * FEE_RATE;

  return feesUSD * 365 / reserveUSD;
}

export const fromWei = val => parseFloat(ethers.utils.formatEther(val));
export const toWei = ethers.utils.parseEther;

// String -> BigNumber
export const parseUnits = ethers.utils.parseUnits;

// BigNumber -> String
export const formatUnits = ethers.utils.formatUnits;
