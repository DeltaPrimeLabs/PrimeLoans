import Vue from 'vue';
import {WrapperBuilder} from '@redstone-finance/evm-connector';
import CACHE_LAYER_URLS from '../../common/redstone-cache-layer-urls.json';
import {utils} from "ethers";
import config from '../config';
import IDATA_STORE from "../../artifacts/contracts/interfaces/gmx-v2/IDataStore.sol/IDataStore.json";
import {fromWei} from "./calculate";
import {
  depositGasLimitKey,
  ESTIMATED_GAS_FEE_BASE_AMOUNT, ESTIMATED_GAS_FEE_BASE_AMOUNT_V2_1,
  ESTIMATED_GAS_FEE_MULTIPLIER_FACTOR, ESTIMATED_GAS_FEE_PER_ORACLE_PRICE,
  WITHDRAWAL_GAS_LIMIT_KEY
} from "../integrations/contracts/dataStore";
import {formatUnits} from "ethers/lib/utils";

const ethers = require('ethers');

export function transactionUrl(tx) {
  return 'https://snowtrace.dev/tx/' + tx;
}

export const wrapContract = async function wrapContract(contract, assets) {
  //for more symbols in data feed it's more optimal to not specify asset list
  const providedAssets = (assets && assets.length <= 5) ? assets : undefined;
  return WrapperBuilder.wrap(contract).usingDataService(
    {
      dataServiceId: config.dataProviderId,
      uniqueSignersCount: 3,
      dataFeeds: providedAssets,
      disablePayloadsDryRun: true
    },
    CACHE_LAYER_URLS.urls
  );
};

export const switchChain = async (chainId, signer) => {
  const currentChainId = await signer.getChainId();

  if (currentChainId !== chainId) {
    const ethereum = window.ethereum;
    if (typeof ethereum === 'undefined') return;

    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x' + chainId.toString(16) }],
    });
  }
}

export async function handleTransaction(fun, args, onSuccess, onFail) {
  try {
    const res = Array.isArray(args) ? await fun(...args) : await fun(args);

    if (onSuccess) {
      console.log('BLOCKCHAIN.js onSuccess');
      onSuccess(res);
    }

  } catch (error) {
    console.log(error);
    if (onFail) {
      console.log('BLOCKCHAIN.js onFail');
      onFail(error);
    }
  }
}

export async function glpApy() {
  return (await (await fetch('https://api.multifarm.fi/jay_flamingo_random_6ix_vegas/get_asset_details/AVAX_Gmx_GLP')).json()).feeAPRHistory[0].value;
}

export async function awaitConfirmation(tx, provider, actionName) {
  const transaction = await provider.waitForTransaction(tx.hash);

  if (transaction.status === 0) {
    console.log(transaction);
    throw `Failed to ${actionName}`;
  }
  return transaction;
}

export function getLog(tx, abi, name = '') {
  const iface = new utils.Interface(abi);
  let chosenLog;

  tx.logs.forEach(log => {
      try{
        let parsed = iface.parseLog(log);

        if (parsed.name === name) {
          chosenLog = parsed;
        }
      } catch (e) {
      }
    }
  );

  return chosenLog;
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export async function calculateGmxV2ExecutionFee(
    gmxV2DataStoreAddress,
    gmxV2DepositCallbackGasLimit,
    gmxV2UseMaxPriorityFeePerGas,
    gmxV2GasPriceBuffer,
    gmxV2GasPricePremium,
    isDeposit
) {
  const dataStore = new ethers.Contract(gmxV2DataStoreAddress, IDATA_STORE.abi, provider.getSigner());

  //TODO: use multicall

  //TODO: withdraw check

  const estimatedGasLimit = isDeposit ?
      fromWei(await dataStore.getUint(depositGasLimitKey(true))) * 10**18 + gmxV2DepositCallbackGasLimit
      :
      fromWei(await dataStore.getUint(hashData(["bytes32"], [WITHDRAWAL_GAS_LIMIT_KEY]))) * 10**18 + gmxV2DepositCallbackGasLimit;

  //TODO: user the proper oracle price count
  let oraclePriceCount = 2;
  let baseGasLimit = (fromWei(await dataStore.getUint(ESTIMATED_GAS_FEE_BASE_AMOUNT_V2_1)) + (fromWei(await dataStore.getUint(ESTIMATED_GAS_FEE_PER_ORACLE_PRICE)) * oraclePriceCount))  * 10**18;

  let multiplierFactor = formatUnits(await dataStore.getUint(ESTIMATED_GAS_FEE_MULTIPLIER_FACTOR), 30);

  const adjustedGasLimit = baseGasLimit + estimatedGasLimit * multiplierFactor;

  const maxPriorityFeePerGas = (await provider.getFeeData()).maxPriorityFeePerGas.toNumber();
  let gasPrice = (await provider.getGasPrice()).toNumber();

  if (gmxV2UseMaxPriorityFeePerGas) gasPrice += maxPriorityFeePerGas;
  gasPrice *= (1 + gmxV2GasPriceBuffer);
  gasPrice += gmxV2GasPricePremium;

  //TODO: decrease the multiplicator
  const deltaPrimeMultiplicator = 6;

  return deltaPrimeMultiplicator * adjustedGasLimit * gasPrice / 10**18;
}

export async function handleCall(fun, args, onSuccess, onFail) {
  try {
    if (!args) {
      return await fun();
    } else {
      return Array.isArray(args) ? await fun(...args) : await fun(args);
    }

    if (onSuccess) {
      onSuccess();
    }
  } catch (error) {
    console.log(error);
    let message = error.data ? error.data.message : (error.message ? error.message : error);

    if (message.startsWith('[ethjs-query]')) {
      if (message.includes('reason string')) {
        message = message.split('reason string ')[1].split('","data":')[0];
      } else {
        message = message.split('"message":"')[1].replace('."}}}\'', '');
      }
    }

    message = message.replace('Error: VM Exception while processing transaction: reverted with reason string ', '');
    message = message.replace('execution reverted: ', '');
    message = message.replace(/'/g, '');

    Vue.$toast.error(message);
    if (onFail) onFail();
  }
}

export function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export function isPausedError(e) {
  if (e && e.data && e.data.message) {
    return e.data.message.includes('ProtocolUpgrade: paused');
  }
}

export function isOracleError(e) {
  const ORACLE_ERROR = '0x2b13aef500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003';
  return e.data && e.data.data && e.data.data.includes(ORACLE_ERROR);
}

export async function signMessage(provider, message, wallet, depositor = false) {
  const signer = provider.getSigner();
  let signedMessage;

  try {
    signedMessage = await signer.signMessage(message);
  } catch (e) {
    throw Error;
  }

  let signingWallet = ethers.utils.verifyMessage(message, signedMessage);

  if (signingWallet !== wallet) {
    throw Error;
  }

  let result = await fetch(`https://vercel-api.deltaprime.io/api/terms?wallet=${wallet}&version=${depositor ? 'depositor' : 'loan'}&signedMessage=${signedMessage}`);

  if (!result || !result.ok || result.status === 0) throw Error;

  return signedMessage;
}

export function decodeOutput(abi, functionName, returnData, comment = '') {
  try {
    let outputs = abi.find(el => el.name === functionName && el.type === 'function').outputs;
    let types = outputs.map(
        output => {
          if (output.type === 'tuple[]') {
            return `tuple(${output.components.map(c => c.type)})[]`
          } else if (output.type === 'tuple') {
            return `tuple(${output.components.map(c => c.type)})`
          } else {
            return output.type;
          }
        }
    )
    return utils.defaultAbiCoder.decode(types, returnData);
  } catch (e) {
    console.log(e)
  }
}

export async function signMessageForNotifi(provider, message, wallet, depositor = false) {
  const signer = provider.getSigner();
  let signedMessage = await signer.signMessage(message);

  let signingWallet = ethers.utils.verifyMessage(message, signedMessage);

  if (signingWallet !== wallet) {
    Vue.$toast.error(`Wrong signing wallet. Please do not change your Metamask wallet during the procedure.`);
    return false;
  }
  return {signedMessage: utils.arrayify(signedMessage), account: wallet};
}

export async function hashData(dataTypes, dataValues) {
  const bytes = ethers.utils.defaultAbiCoder.encode(dataTypes, dataValues);
  return ethers.utils.keccak256(ethers.utils.arrayify(bytes));
}

export const loanTermsToSign =
`By entering DeltaPrime I agree to be bound by the DeltaPrime "TERMS OF USE" and herby further represent and warrant that:
I am not a citizen of, natural and legal person, having habitual residence, location or their seat of incorporation in the country or territory where transactions with digital
tokens or virtual assets are prohibited [full text available at https://arweave.net/yJYGxmLhSccPc3NSRGpgzolKi1YeGiVFteLeWbhPnxw].`;

export const depositTermsToSign =
`By entering DeltaPrime I agree to be bound by the DeltaPrime "TERMS OF USE" and herby further represent and warrant that:
I am not a citizen of, natural and legal person, having habitual residence, location or their seat of incorporation in the country or territory where transactions with digital tokens or virtual assets are prohibited [full text available at https://arweave.net/9dc5BuzFYefZrL7ciUnxyeRUFh52U3UKju7AD6InsJ8].`;

async function getLoanHistoryData(walletAddress) {
  const startDate = 1701428400 * 1000;
  const endDate = new Date().getTime();

  const response = await fetch(`https://2t8c1g5jra.execute-api.us-east-1.amazonaws.com/loan-stats?address=${walletAddress}&from=${startDate}&to=${endDate}&network=${window.chain}`);
  const body = await response.json()

  return body.data;
}

export async function getData(loanAddress, timestamp) {

  let historyData = await getLoanHistoryData(loanAddress);

  let dataPoint = historyData.find(
      el => {
          return el.timestamp > timestamp * 1000;
      }
  );

  return dataPoint;
}
