import Vue from 'vue';
import {WrapperBuilder} from '@redstone-finance/evm-connector';
import CACHE_LAYER_URLS from '../../common/redstone-cache-layer-urls.json';
import {utils} from "ethers";

const ethers = require('ethers');

export function transactionUrl(tx) {
  return 'https://snowtrace.io/tx/' + tx;
}

export const wrapContract = async function wrapContract(contract, assets) {
  //for more symbols in data feed it's more optimal to not specify asset list
  let providedAssets = (assets && assets.length <= 5) ? assets : undefined;

  return WrapperBuilder.wrap(contract).usingDataService(
    {
      dataServiceId: 'redstone-avalanche-prod',
      uniqueSignersCount: 3,
      dataFeeds: providedAssets,
      disablePayloadsDryRun: true
    },
    CACHE_LAYER_URLS.urls
  );
};

export async function handleTransaction(fun, args, onSuccess, onFail) {
  try {
    const tx = Array.isArray(args) ? await fun(...args) : await fun(args);
    if (tx) {
      await provider.waitForTransaction(tx.hash);
    }

    if (onSuccess) {
      console.log('BLOCKCHAIN.js onSuccess');
      onSuccess();
    }

  } catch (error) {
    console.log(error);
    if (onFail) {
      console.log('BLOCKCHAIN.js onFail');
      onFail(error);
    }
  }
}

export function assetAppreciation(symbol) {
  if (symbol === 'sAVAX') return 1.072;
  if (symbol === 'TJ_AVAX_sAVAX_LP') return 1.036;
  return 1;
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
  let signedMessage = await signer.signMessage(message);

  let signingWallet = ethers.utils.verifyMessage(message, signedMessage);

  await fetch(`https://vercel-api.deltaprime.io/api/terms?wallet=${wallet}&version=${depositor ? 'depositor' : 'loan'}&signedMessage=${signedMessage}`, {
    method: 'GET',
    mode: 'no-cors'
  });

  if (signingWallet !== wallet) {
    Vue.$toast.error(`Wrong signing wallet. Please do not change your Metamask wallet during the procedure.`);
    return false;
  }
  return true;
}

export const loanTermsToSign =
  `
By entering DeltaPrime I agree to be bound by the DeltaPrime "TERMS OF USE" and herby further represent and warrant that:
 

I am not a citizen of, natural and legal person, having habitual residence, location or their seat of incorporation in the country or territory where transactions with digital tokens or virtual assets are prohibited, licensed, restricted or taxed by applicable state, territorial, provincial or local laws, rules or regulations e.g. United States of America (including its territories: American Samoa, Guam, Puerto Rico, the Northern Mariana Islands and the U.S. Virgin Islands) or any other restricted jurisdiction. It is my responsibility to ensure that I am legally eligible to enter the DeltaPrime and use DeltaPrime protocol under any laws applicable to me in my jurisdiction of residence or otherwise.

I am not a person nor acting on behalf of a person residing in any country embargoed by the European Union or person listed in “Specially Designated Nationals and Blocked Persons List” published by the Office of Foreign Assets Control ("OFAC") of the US Department of the Treasury and/or subject to European Union or USA export controls or sanctions (including without limitation Iran, Cuba, Sudan, Syria and North Korea), or any other sanctioned jurisdiction or sanction list.

I understand that sufficient collateral is required when using DeltaPrime, and that my credit accounts may be terminated if I do not maintain one, in which case I may be charged penalty by the protocol.

I also understand that notorious not collateralized positions from one account may result in termination of my account or accounts, in which case I may be charged penalty by the protocol as well.

I understand and accept that DeltaPrime concept, the underlying or related software application and software protocol are still in an early development stage and offered "as is", and that the use of experimental software may result in complete loss of my funds.
`;

export const depositTermsToSign =
  `
By entering DeltaPrime I agree to be bound by the DeltaPrime "TERMS OF USE" and herby further represent and warrant that:
 

I am not a citizen of, natural and legal person, having habitual residence, location or their seat of incorporation in the country or territory where transactions with digital tokens or virtual assets are prohibited, licensed, restricted or taxed by applicable state, territorial, provincial or local laws, rules or regulations e.g. United States of America (including its territories: American Samoa, Guam, Puerto Rico, the Northern Mariana Islands and the U.S. Virgin Islands) or any other restricted jurisdiction. It is my responsibility to ensure that I am legally eligible to enter the DeltaPrime and use DeltaPrime protocol under any laws applicable to me in my jurisdiction of residence or otherwise.

I am not a person nor acting on behalf of a person residing in any country embargoed by the European Union or person listed in “Specially Designated Nationals and Blocked Persons List” published by the Office of Foreign Assets Control ("OFAC") of the US Department of the Treasury and/or subject to European Union or USA export controls or sanctions (including without limitation Iran, Cuba, Sudan, Syria and North Korea), or any other sanctioned jurisdiction or sanction list.

I understand that my funds can be loaned to other accounts and are under risk of protocol failure.

I understand and accept that DeltaPrime concept, the underlying or related software application and software protocol are still in an early development stage and offered "as is", and that the use of experimental software may result in complete loss of my funds.
`;