const ethers = require('ethers');
let ethereum = window.ethereum;
import Vue from "vue";
import redstone from 'redstone-api';

export default {
  namespaced: true,
  state: {
    provider: null,
    account: null,
    accountBalance: null,
    avaxPrice: null
  },
  mutations: {
    setProvider(state, provider) {
      state.provider = provider;
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
    async initNetwork({ dispatch }) {
      //TODO: Promise.all?
      await dispatch('initProvider');
      await dispatch('initAccount');
      await dispatch('updateBalance');
      await dispatch('updateAvaxPrice');
    },
    async initProvider({ commit, rootState }) {
      await ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      window.provider = provider;

      await commit('setProvider', provider);
      rootState.serviceRegistry.providerService.emitProviderCreated();
    },
    async initAccount({ commit, state, rootState }) {
      if (state.account) {
        return state.account;
      }

      let provider = state.provider;
      let accounts = await provider.listAccounts();

      if (accounts.length > 0) {
        const mainAccount = accounts[0];
        commit('setAccount', mainAccount);
        rootState.serviceRegistry.accountService.emitAccountLoaded();
      } else {
        Vue.$toast.error("No accounts available");
      }
    },
    async updateBalance({ state, commit }) {
      const mainAccount = state.account;
      const balance = parseFloat(ethers.utils.formatEther(await state.provider.getBalance(mainAccount)));

      commit('setAccountBalance', balance);
    },
    async updateAvaxPrice({ commit }) {
      const avaxPrice = (await redstone.getPrice("AVAX", { provider: 'redstone-avalanche'})).value;
      commit('setAvaxPrice', avaxPrice);
    }
  },
};
