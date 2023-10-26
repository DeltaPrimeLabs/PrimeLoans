import config from "../config";

const ethers = require('ethers');
import IVectorFinanceStakingArtifact
  from '../../artifacts/contracts/interfaces/IVectorFinanceStaking.sol/IVectorFinanceStaking.json';
import IVectorRewarder
  from '../../artifacts/contracts/interfaces/IVectorRewarder.sol/IVectorRewarder.json';
import IYieldYak
  from '../../artifacts/contracts/interfaces/facets/avalanche/IYieldYak.sol/IYieldYak.json';
import IBeefyFinance
  from '../../artifacts/contracts/interfaces/facets/IBeefyFinance.sol/IBeefyFinance.json';
import IVectorFinanceCompounder from '../../artifacts/contracts/interfaces/IVectorFinanceCompounder.sol/IVectorFinanceCompounder.json';
import {BigNumber} from "ethers";
import ApolloClient from "apollo-boost";
import gql from "graphql-tag";
import TOKEN_ADDRESSES from '../../common/addresses/avalanche/token_addresses.json';
import redstone from 'redstone-api';
import erc20ABI from '../../test/abis/ERC20.json';
import {TransactionParams} from '@paraswap/sdk';

export function minAvaxToBeBought(amount, currentSlippage) {
  return amount / (1 + (currentSlippage ? currentSlippage : 0));
}

export function calculateHealth(tokens, lbTokens) {
  let weightedCollateralFromLBs = 0;

  if (lbTokens) {
    lbTokens
      .filter(lbToken => lbToken.binIds)
      .forEach(lbToken => {
        lbToken.binIds.forEach(
          (binId, i) => {
            let balancePrimary = parseFloat(lbToken.binBalancePrimary[i]);
            let balanceSecondary = parseFloat(lbToken.binBalanceSecondary[i])
            let liquidity = lbToken.binPrices[i] * balancePrimary + balanceSecondary
            let debtCoveragePrimary = config.ASSETS_CONFIG[lbToken.primary].debtCoverage;
            let debtCoverageSecondary = config.ASSETS_CONFIG[lbToken.secondary].debtCoverage;

            weightedCollateralFromLBs += Math.min(
              debtCoveragePrimary * liquidity * config.ASSETS_CONFIG[lbToken.primary].price / lbToken.binPrices[i],
              debtCoverageSecondary * liquidity * config.ASSETS_CONFIG[lbToken.secondary].price
            ) * lbToken.accountBalances[i] / lbToken.binTotalSupply[i];
          }
        );
      })
  }

  let weightedCollateral = weightedCollateralFromLBs + tokens.reduce((acc, token) => acc + token.price * ((isNaN(token.balance) ? 0 : token.balance) - token.borrowed) * token.debtCoverage, 0);
  let weightedBorrowed = tokens.reduce((acc, token) => acc + token.price * token.borrowed * token.debtCoverage, 0);
  let borrowed = tokens.reduce((acc, token) => acc + token.price * token.borrowed, 0);

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

export async function yieldYakBalance(stakingContractAddress, address, decimals = 18) {
  try {
    console.log('try yieldYakBalance')
    const tokenContract = new ethers.Contract(stakingContractAddress, erc20ABI, provider.getSigner());
    const stakedYrtWei = await tokenContract.balanceOf(address);

    return formatUnits(stakedYrtWei, decimals);
  } catch (e) {
    console.log('yieldYakBalance error')
    return 0;
  }

}

export async function yieldYakStaked(address) {
  let query = `
    {   
      smartLoan(id: "${address}") {
        YY_AAVE_AVAX
        YY_PTP_sAVAX
        YY_GLP
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

  return (await client.query({query: gql(query)})).data.smartLoan;
}

export async function vectorFinanceBalance(stakingContractAddress, address, decimals = 18) {
  let result = 0;
  try {
    const tokenContract = new ethers.Contract(stakingContractAddress, IVectorFinanceStakingArtifact.abi, provider.getSigner());

    result = formatUnits(await tokenContract.balance(address), BigNumber.from(decimals.toString()));
  } catch (e) {
    console.log('vector balance error')
  }

  return result;

}

export async function vectorFinanceRewards(stakingContractAddress, loanAddress) {
  const stakingContract = new ethers.Contract(stakingContractAddress, IVectorFinanceStakingArtifact.abi, provider.getSigner());
  const rewarderAddress = await stakingContract.rewarder();

  const rewarderContract = new ethers.Contract(rewarderAddress, IVectorRewarder.abi, provider.getSigner());

  let i = 0;
  let totalEarned = 0;

  let iterate = true;

  //TODO: get prices from store
  const redstonePriceDataRequest = await fetch(config.redstoneFeedUrl);
  const redstonePriceData = await redstonePriceDataRequest.json();

  while (iterate) {
    try {
      let tokenAddress = await rewarderContract.rewardTokens(i);
      let tokenContract = new ethers.Contract(tokenAddress, erc20ABI, provider.getSigner());

      let earned = formatUnits(await rewarderContract.earned(loanAddress, tokenAddress), await tokenContract.decimals());

      let token = Object.entries(TOKEN_ADDRESSES).find(([, address]) => address.toLowerCase() === tokenAddress.toLowerCase());
      
      let price = redstonePriceData[token[0]] ? redstonePriceData[token[0]][0].dataPoints[0].value : 0;

      totalEarned += price * earned;
    } catch (e) {
      iterate = false;
    }

    i++;
  }

  return totalEarned;
}

export async function yieldYakMaxUnstaked(stakingContractAddress, loanAddress, decimals = 18) {
  try {
    const stakingContract = new ethers.Contract(stakingContractAddress, IYieldYak.abi, provider.getSigner());
    const loanBalance = formatUnits(await stakingContract.balanceOf(loanAddress), BigNumber.from(decimals));
    const totalDeposits = formatUnits(await stakingContract.totalDeposits(), BigNumber.from(decimals));
    const totalSupply = formatUnits(await stakingContract.totalSupply(), BigNumber.from(decimals));

    return loanBalance / totalSupply * totalDeposits;
  } catch (e) {
    console.log('yieldYakMaxUnstaked error');
    return 0;
  }


}

export async function beefyMaxUnstaked(stakingContractAddress, loanAddress, decimals = 18) {
  try {
    const stakingContract = new ethers.Contract(stakingContractAddress, IBeefyFinance.abi, provider.getSigner());
    const loanBalance = formatUnits(await stakingContract.balanceOf(loanAddress), BigNumber.from(decimals));
    const balance = formatUnits(await stakingContract.balance(), BigNumber.from(decimals));
    const totalSupply = formatUnits(await stakingContract.totalSupply(), BigNumber.from(decimals));

    return loanBalance / totalSupply * balance;
  } catch (e) {
    console.log('beefyMaxUnstaked error');
    return 0;
  }


}

export async function vectorFinanceMaxUnstaked(assetSymbol, stakingContractAddress, loanAddress) {
  const assetDecimals = config.ASSETS_CONFIG[assetSymbol].decimals;
  const stakingContract = new ethers.Contract(stakingContractAddress, IVectorFinanceCompounder.abi, provider.getSigner());
  let stakedBalance = 0;
  try {
    stakedBalance = formatUnits(await stakingContract.userDepositToken(loanAddress), BigNumber.from(assetDecimals));
  } catch (e) {
    console.log(e)

  }

  return stakedBalance;
}

export async function getPangolinLpApr(url) {
  let apr;

  if (url) {
    const resp = await fetch(url);
    const json = await resp.json();

    apr = json.swapFeeApr;
  } else {
    apr = 0;
  }

  return apr;
}

export async function getTraderJoeLpApr(lpAddress, assetAppreciation = 0) {
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

  return ((1 + feesUSD * 365 / reserveUSD) * (1 + assetAppreciation / 100) - 1) * 100;
}

export const paraSwapRouteToSimpleData = (txParams) => {
  const data = "0x" + txParams.data.substr(10);
  const [
    decoded,
  ] = ethers.utils.defaultAbiCoder.decode(
    ["(address,address,uint256,uint256,uint256,address[],bytes,uint256[],uint256[],address,address,uint256,bytes,uint256,bytes16)"],
    data
  );
  return {
    fromToken: decoded[0],
    toToken: decoded[1],
    fromAmount: decoded[2],
    toAmount: decoded[3],
    expectedAmount: decoded[4],
    callees: decoded[5],
    exchangeData: decoded[6],
    startIndexes: decoded[7],
    values: decoded[8],
    beneficiary: decoded[9],
    partner: decoded[10],
    feePercent: decoded[11],
    permit: decoded[12],
    deadline: decoded[13],
    uuid: decoded[14],
  };
};

export function getBinPrice(binId, binStep, firstDecimals, secondDecimals) {
  const binPrice = (1 + binStep / 10000) ** (binId - 8388608) * 10 ** (firstDecimals - secondDecimals);
  return formatTokenBalance(binPrice, 8, true);
}

export function getCountdownString(countDownDate) {
  let now = new Date().getTime();

  // Find the distance between now and the count down date
  let distance = countDownDate - now;

  // Time calculations for days, hours, minutes and seconds
  let days = Math.floor(distance / (1000 * 60 * 60 * 24));
  let hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  let minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  let seconds = Math.floor((distance % (1000 * 60)) / 1000);

  // Display the result in the element with id="demo"
  return hours + "h "
      + minutes + "min";
}

export function chartPoints(points) {
  if (points == null || points.length === 0) {
    return [];
  }

  let maxValue = 0;
  let minValue = points[0].value;

  let dataPoints = points.map(
      item => {
        if (item.value > maxValue) maxValue = item.value;

        if (item.value < minValue) minValue = item.value;

        return {
          x: item.timestamp,
          y: item.value
        };
      }
  );

  return [dataPoints, minValue, maxValue];
}

export const fromWei = val => parseFloat(ethers.utils.formatEther(val));
export const toWei = ethers.utils.parseEther;

// String -> BigNumber
export const parseUnits = ethers.utils.parseUnits;

// BigNumber -> String
export const formatUnits = ethers.utils.formatUnits;

function formatTokenBalance(value, precision = 5, toFixed = false) {
  const balanceOrderOfMagnitudeExponent = String(value).split('.')[0].length - 1;
  const precisionMultiplierExponent = precision - balanceOrderOfMagnitudeExponent;
  const precisionMultiplier = Math.pow(10, precisionMultiplierExponent >= 0 ? precisionMultiplierExponent : 0);
  if (value !== null) {
    if (!toFixed) {
      return String(Math.round(value * precisionMultiplier) / precisionMultiplier);
    } else {
      return (Math.round(value * precisionMultiplier) / precisionMultiplier).toFixed(precision).replace(/([0-9]+(\.[0-9]+[1-9])?)(\.?0+$)/, '$1');
    }
  } else {
    return '';
  }
}