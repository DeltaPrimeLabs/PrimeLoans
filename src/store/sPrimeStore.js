import SPRIME from '../abis/sPrime/ISPrime.json';
import SPRIME_TJV2 from '../abis/sPrime/ISPrimeTraderJoe.json';
import SPRIME_UNISWAP from '../abis/sPrime/ISPrimeUniswap.json';
import erc20ABI from '../abis/ERC20.json';
import WAVAX from '../abis/WAVAX.json';

import {parseUnits} from '@/utils/calculate';
import {awaitConfirmation, wrapContract} from '../utils/blockchain';
import config from '@/config';
import {toWei} from '../utils/calculate';


const ethers = require('ethers');
let TOKEN_ADDRESSES;
const SUCCESS_DELAY_AFTER_TRANSACTION = 1000;


export default {
  namespaced: true,
  state: {},
  getters: {},
  mutations: {},
  actions: {
    async loadDeployments() {
      TOKEN_ADDRESSES = await import(`/common/addresses/${window.chain}/token_addresses.json`);
    },

    async sPrimeStoreSetup({dispatch}) {
      await dispatch('loadDeployments');
    },

    async sPrimeMint({state, rootState, dispatch}, {sPrimeMintRequest}) {
      const provider = rootState.network.provider;

      // let dataFeeds = ['PRIME', sPrimeMintRequest.secondAsset]
      let dataFeeds = [...Object.keys(config.POOLS_CONFIG), 'PRIME']
      const sprimeContract = await wrapContract(new ethers.Contract(sPrimeMintRequest.sPrimeAddress, sPrimeMintRequest.dex === 'TRADERJOEV2' ? SPRIME_TJV2.abi : SPRIME_UNISWAP.abi, provider.getSigner()), dataFeeds);

      const secondAssetDecimals = config.SPRIME_CONFIG[sPrimeMintRequest.dex][sPrimeMintRequest.secondAsset].secondAssetDecimals;
      let amountPrime = toWei(sPrimeMintRequest.amountPrime ? Number(sPrimeMintRequest.amountPrime).toFixed(18) : '0')
      let amountSecond = parseUnits(sPrimeMintRequest.amountSecond ? Number(sPrimeMintRequest.amountSecond).toFixed(secondAssetDecimals) : '0', secondAssetDecimals)

      if (sPrimeMintRequest.isSecondAssetNative && sPrimeMintRequest.amountSecond > 0) {
        let wrapTx = await new ethers.Contract(TOKEN_ADDRESSES[sPrimeMintRequest.secondAsset], WAVAX, provider.getSigner()).deposit({value: amountSecond});
        await awaitConfirmation(wrapTx, provider, 'wrap');
      }

      //approvals
      await approve(TOKEN_ADDRESSES['PRIME'], amountPrime);
      await approve(TOKEN_ADDRESSES[sPrimeMintRequest.secondAsset], amountSecond);

      async function approve(address, amount) {
        const tokenContract = new ethers.Contract(address, erc20ABI, provider.getSigner());
        const allowance = await tokenContract.allowance(rootState.network.account, sPrimeMintRequest.sPrimeAddress);

        if (allowance.lt(amount)) {
          let approveTransaction = await tokenContract.connect(provider.getSigner())
            .approve(sPrimeMintRequest.sPrimeAddress, amount);

          await awaitConfirmation(approveTransaction, provider, 'approve');
        }
      }

      const transaction = window.chain === 'avalanche' ?
        await sprimeContract.deposit(sPrimeMintRequest.activeId, sPrimeMintRequest.idSlippage, amountPrime, amountSecond, sPrimeMintRequest.isRebalance, sPrimeMintRequest.slippage * 100) :
        await sprimeContract.deposit(sPrimeMintRequest.activeId, sPrimeMintRequest.idSlippage, amountPrime, amountSecond, 0, 0, sPrimeMintRequest.isRebalance, sPrimeMintRequest.slippage * 100)

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      await awaitConfirmation(transaction, provider, 'mint');


      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      rootState.serviceRegistry.sPrimeService.emitRefreshSPrimeDataWithDefault(provider, rootState.network.account);
      rootState.serviceRegistry.vPrimeService.emitRefreshVPrimeDataWithDefault(rootState.network.account);
    },
    async sPrimeRebalance({state, rootState, dispatch}, {sPrimeRebalanceRequest: sPrimeRebalanceRequest}) {
      console.log('sPrimeRebalance: ', sPrimeRebalanceRequest)
      const provider = rootState.network.provider;

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      // let dataFeeds = ['PRIME', sPrimeMintRequest.secondAsset]
      let dataFeeds = [...Object.keys(config.POOLS_CONFIG), sPrimeRebalanceRequest.secondAsset, 'PRIME']
      const sprimeContract = await wrapContract(new ethers.Contract(sPrimeRebalanceRequest.sPrimeAddress, sPrimeRebalanceRequest.dex === 'TRADERJOEV2' ? SPRIME_TJV2.abi : SPRIME_UNISWAP.abi, provider.getSigner()), dataFeeds);

      const transaction = window.chain === 'avalanche' ?
        await sprimeContract.deposit(sPrimeRebalanceRequest.activeId, sPrimeRebalanceRequest.idSlippage, 0, 0, sPrimeRebalanceRequest.isRebalance, sPrimeRebalanceRequest.slippage * 100) :
        await sprimeContract.deposit(sPrimeRebalanceRequest.activeId, sPrimeRebalanceRequest.idSlippage, 0, 0, 0, 0, sPrimeRebalanceRequest.isRebalance, sPrimeRebalanceRequest.slippage * 100)

      await awaitConfirmation(transaction, provider, 'rebalance');

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      rootState.serviceRegistry.sPrimeService.emitRefreshSPrimeDataWithDefault(provider, rootState.network.account);
      rootState.serviceRegistry.vPrimeService.emitRefreshVPrimeDataWithDefault(rootState.network.account);
    },
    async sPrimeRedeem({state, rootState, dispatch}, {sPrimeRedeemRequest: sPrimeRedeemRequest}) {
      const provider = rootState.network.provider;

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let share = toWei(sPrimeRedeemRequest.share);

      let dataFeeds = [...Object.keys(config.POOLS_CONFIG), sPrimeRedeemRequest.secondAsset, 'PRIME']
      const sprimeContract = await wrapContract(new ethers.Contract(sPrimeRedeemRequest.sPrimeAddress, SPRIME.abi, provider.getSigner()), dataFeeds);

      const transaction = await sprimeContract.withdraw(share, 0, 0);
      await awaitConfirmation(transaction, provider, 'redeem');

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      rootState.serviceRegistry.sPrimeService.emitRefreshSPrimeDataWithDefault(provider, rootState.network.account);
      rootState.serviceRegistry.vPrimeService.emitRefreshVPrimeDataWithDefault(rootState.network.account);
    }
  }
};
