import {Contract} from "ethers";
const ethers = require('ethers');
import BORROW_NFT from '@artifacts/contracts/ERC721/EarlyAccessNFT.sol/EarlyAccessNFT.json'
import EAP_NFT from '@artifacts/contracts/ERC721/EarlyAccessNFT.sol/EarlyAccessNFT.json'
import DEPOSIT_NFT from '@artifacts/contracts/ERC721/DepositAccessNFT.sol/DepositAccessNFT.json'
import WOLF_OF_DEFI_WINNERS_NFT from '@artifacts/contracts/ERC721/WolfOfDeFiWinners.sol/WolfOfDeFiWinners.json'
const FACTORY_TUP = require('@contracts/SmartLoansFactoryTUP.json');
const POOL_TUP = require('@contracts/WavaxPoolTUP.json');
import FACTORY_NFT from '@artifacts/contracts/upgraded/SmartLoansFactoryWithAccessNFT.sol/SmartLoansFactoryWithAccessNFT.json'
import POOL_NFT from '@artifacts/contracts/upgraded/PoolWithAccessNFT.sol/PoolWithAccessNFT.json'
import {awaitConfirmation} from "../utils/blockchain";
const ZERO = ethers.constants.AddressZero;

export default {
  namespaced: true,
  state: {
    eapNftContract: null,
    borrowNftContractSet: true,
    hasEapNft: null,
    borrowNftId: null,
    borrowNftImageUri: null,
    depositNftContract: null,
    depositNftContractSet: true,
    hasDepositNft: null,
    depositNftId: null,
    depositNftImageUri: null,
    nfts: [],
    numberOfNfts: 0,
  },
  mutations: {
    setEapNftContract(state, contract) {
      state.eapNftContract = contract;
    },
    setBorrowNftContractSet(state, has) {
      state.borrowNftContractSet = has;
    },
    setBorrowNftId(state, id) {
      state.borrowNftId = id;
    },
    setHasEapNft(state, has) {
      state.hasEapNft = has;
    },
    setBorrowNftImageUri(state, uri) {
      state.borrowNftImageUri = uri;
    },
    setDepositNftContract(state, contract) {
      state.depositNftContract = contract;
    },
    setDepositNftContractSet(state, has) {
      state.depositNftContractSet = has;
    },
    setDepositNftId(state, id) {
      state.depositNftId = id;
    },
    setHasDepositNft(state, has) {
      state.hasDepositNft = has;
    },
    setDepositNftImageUri(state, uri) {
      state.depositNftImageUri = uri;
    },
    setNfts(state, nfts) {
      state.nfts = nfts;
    },
    setNumberOfNfts(state, number) {
      state.numberOfNfts = number;
    },
  },
  getters: {
    borrowingLocked(state) {
      return state.borrowNftContractSet && !state.hasEapNft;
    },
    depositLocked(state) {
      return state.depositNftContractSet && state.depositNftId === null;
    }
  },
  actions: {
    async initNfts({ commit, dispatch, rootState }) {
      const provider = rootState.network.provider;

      try {
        const factory = new Contract(FACTORY_TUP.address, FACTORY_NFT.abi, provider.getSigner());
        factory.iface = new ethers.utils.Interface(FACTORY_NFT.abi);

        const address = await factory.getAccessNFT();
        //TODO: simplify
        commit('setBorrowNftContractSet', address !== ZERO);

        const eapContract = new Contract(address, EAP_NFT.abi, provider.getSigner());

        commit('setEapNftContract', eapContract);
        dispatch('checkEapNftBalance');
        dispatch('loadWolfOfDefiWinnersNfts');
        dispatch('loadBorrowAccessNfts')
      } catch(e) {
        console.error(e)
        commit('setBorrowNftContractSet', false);
      }

      try {
        const pool = new Contract(POOL_TUP.address, POOL_NFT.abi, provider.getSigner());
        const address = await pool.getAccessNFT();
        commit('setDepositNftContractSet', address !== ZERO);

        const depositContract = new Contract(address, DEPOSIT_NFT.abi, provider.getSigner());

        commit('setDepositNftContract', depositContract);
        // dispatch('getDepositNftId');
      } catch(e) {
        console.error(e);
        commit('setDepositNftContractSet', false);
      }
    },
    async updateEapNft({ commit, state }) {
      const jsonUri = await state.eapNftContract.baseURI();
      const response = await fetch(jsonUri);
      const json = await response.json();
      const uri = json.image;

      commit('setBorrowNftImageUri', uri);
      commit('setNfts', [...state.nfts, uri]);
    },
    async updateDepositNftFromId({ commit, state }, { id }) {
      const jsonUri = await state.depositNftContract.tokenURI(id);
      const response = await fetch(jsonUri);
      const json = await response.json();
      const uri = json.image;

      commit('setDepositNftImageUri', uri);
    },
    async checkEapNftBalance({ state, rootState, dispatch, commit }) {
      const balance = (await state.eapNftContract.balanceOf(rootState.network.account)).toNumber();
      commit('setNumberOfNfts', state.numberOfNfts + balance);
      if (balance > 0) {
        commit('setHasEapNft', true);
        dispatch('updateEapNft')
      } else {
        commit('setHasBorrowNft', false);
      }
    },
    async loadWolfOfDefiWinnersNfts({state, rootState, dispatch, commit}) {
      const wolfsContractAddress = '0xf9a12a4759500df05983fd3ebd7f8a8f262a2967';
      const wolfsContract = new Contract(wolfsContractAddress, WOLF_OF_DEFI_WINNERS_NFT.abi, provider.getSigner());
      const balance = (await wolfsContract.balanceOf(rootState.network.account)).toNumber();
      commit('setNumberOfNfts', state.numberOfNfts + balance);
      for (let i = 0; i < balance; i++) {
        const id = (await wolfsContract.tokenOfOwnerByIndex(rootState.network.account, i)).toNumber();
        const tokenUri = await wolfsContract.tokenURI(id);
        const response = await fetch(tokenUri);
        const tokenJson = await response.json();
        commit('setNfts', [...state.nfts, tokenJson.image]);
      }
    },
    async loadBorrowAccessNfts({state, rootState, dispatch, commit}) {
      const borrowNftContractAddress = '0xF8d1b34651f2c9230beB9b83B2260529769FDeA4';
      const borrowNftContract = new Contract(borrowNftContractAddress, WOLF_OF_DEFI_WINNERS_NFT.abi, provider.getSigner());
      const balance = (await borrowNftContract.balanceOf(rootState.network.account)).toNumber();
      commit('setNumberOfNfts', state.numberOfNfts + balance);
      if (balance > 0) {
        const tokenId = (await borrowNftContract.tokenOfOwnerByIndex(rootState.network.account, 0));
        const tokenUri = await borrowNftContract.tokenURI(tokenId);
        const response = await fetch(tokenUri);
        const tokenJson = await response.json();
        commit('setNfts', [...state.nfts, tokenJson.image]);
      }
    },
    async getDepositNftId({ state, rootState, dispatch, commit }) {
      const balance = (await state.depositNftContract.balanceOf(rootState.network.account)).toNumber();

      if (balance > 0) {
        const id = (await state.depositNftContract.tokenOfOwnerByIndex(rootState.network.account, 0)).toNumber();

        commit('setHasDepositNft', true);
        commit('setDepositNftId', id);
        dispatch('updateDepositNftFromId', {id: id})
      } else {
        commit('setHasDepositNft', false);
      }
    },
    async mintBorrowNft({ dispatch, state, rootState }, {id, signature}) {
      const provider = rootState.network.provider;
      let tx = await state.eapNftContract.safeMint(id, signature);

      awaitConfirmation(tx, provider, 'mint').then(() => {
        // dispatch('initNfts');
        // dispatch('checkBorrowNftBalance', {id: id})
      });

    },
    async mintDepositNft({ dispatch, state, rootState }, {id, signature}) {
      const provider = rootState.network.provider;
      let tx = await state.depositNftContract.safeMint(id, signature);

      awaitConfirmation(tx, provider, 'mint').then(() => {
        // dispatch('initNfts');
        // dispatch('getDepositNftId', {id: id})
      })
    }
  }
};
