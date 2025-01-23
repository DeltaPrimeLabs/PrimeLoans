import EthereumProvider from '@walletconnect/ethereum-provider';

const ethers = require('ethers');
let ethereum = window.ethereum;
import Vue from "vue";
import redstone from 'redstone-api';
import config from "../config";

export default {
  namespaced: true,
  state: {
    provider: null,
    account: null,
    accountBalance: null
  },
  mutations: {
    setProvider(state, provider) {
      console.log(provider);
      state.provider = provider;
    },
    setHistoricalProvider(state, historicalProvider) {
      state.historicalProvider = historicalProvider;
    },
    setAccount(state, account) {
      state.account = account;
    },
    setAccountBalance(state, balance) {
      state.accountBalance = balance;
    },
    setAvaxPrice(state, price) {
      state.avaxPrice = price;
    }
  },
  actions: {
    async initNetwork({ commit, dispatch, rootState }) {

      rootState.serviceRegistry.providerService.observeProvider().subscribe(async provider => {
        console.log(provider);

        commit('setProvider', provider);
        setTimeout(async () => {
          await dispatch('fundsStore/fundsStoreSetup', {}, {root: true});
        }, 2000)

      })

      rootState.serviceRegistry.accountService.observeAccount().subscribe(async account => {
        console.log(account);
        commit('setAccount', account);
      })

      const priceService = rootState.serviceRegistry.priceService;

      const redstonePriceDataRequest = await fetch(config.redstoneFeedUrl);
      const redstonePriceData = await redstonePriceDataRequest.json();

      const prices = priceService.setupPrices(redstonePriceData);

      rootState.serviceRegistry.providerService.initNetwork();

      rootState.serviceRegistry.providerService.emitProviderCreated();

    },

    async initAccount({ commit, state, rootState }) {
      if (state.account) {
        return state.account;
      }

      let provider = state.provider;
      let accounts;
      if (provider.STORAGE_KEY && provider.STORAGE_KEY === 'wc@2:ethereum_provider:') {
        accounts = provider.accounts;
      } else {
        accounts = await provider.listAccounts();
      }

      if (accounts.length > 0) {
        const mainAccount = accounts[0];
        commit('setAccount', mainAccount);
        rootState.serviceRegistry.accountService.emitAccountLoaded(mainAccount);
      } else {
        Vue.$toast.error("No accounts available");
      }
    },
    async updateBalance({ state, commit }) {
      const mainAccount = state.account;
      const balance = parseFloat(ethers.utils.formatEther(await state.provider.getBalance(mainAccount)));

      commit('setAccountBalance', balance);
    }
  },
};
