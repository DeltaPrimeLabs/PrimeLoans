import {awaitConfirmation, depositTermsToSign, signMessage} from '../utils/blockchain';
import POOL from '@artifacts/contracts/WrappedNativeTokenPool.sol/WrappedNativeTokenPool.json';
import {formatUnits, fromWei, parseUnits} from '@/utils/calculate';
import erc20ABI from '../../test/abis/ERC20.json';
import config from '@/config';


const ethers = require('ethers');

export default {
  namespaced: true,
  state: {
    poolContract: null,
    usdcPoolContract: null,
    avaxPool: null,
    usdcPool: null,
    pools: null,
  },
  getters: {},
  mutations: {
    setPoolContract(state, poolContract) {
      state.poolContract = poolContract;
    },

    setUsdcPoolContract(state, poolContract) {
      state.usdcPoolContract = poolContract;
    },

    setAvaxPool(state, pool) {
      state.avaxPool = pool;
    },

    setUsdcPool(state, pool) {
      state.usdcPool = pool;
    },

    setPools(state, pools) {
      state.pools = pools;
    },
  },
  actions: {

    async poolStoreSetup({dispatch}) {
      await dispatch('setupPools');
    },

    async setupPools({rootState, commit}) {
      const poolService = rootState.serviceRegistry.poolService;
      poolService.setupPools(rootState.network.provider, rootState.network.account)
        .subscribe(pools => {
          poolService.emitPools(pools);
          commit('setPools', pools);
        });
    },

    async deposit({state, rootState, commit, dispatch}, {depositRequest}) {
      const provider = rootState.network.provider;

      const tokenContract = new ethers.Contract(config.POOLS_CONFIG[depositRequest.assetSymbol].tokenAddress, erc20ABI, provider.getSigner());
      const decimals = config.ASSETS_CONFIG[depositRequest.assetSymbol].decimals;
      const poolContract = state.pools.find(pool => pool.asset.symbol === depositRequest.assetSymbol).contract;
      const wallet = rootState.network.account;

      if (fromWei(await poolContract.balanceOf(wallet)) === 0) {
        if (!(await signMessage(provider, depositTermsToSign, rootState.network.account, true))) return;
      }

      let depositTransaction;
      if (depositRequest.depositNativeToken) {
        depositTransaction = await poolContract
          .connect(provider.getSigner())
          .depositNativeToken({value: parseUnits(String(depositRequest.amount), decimals)});
      } else {
        const allowance = formatUnits(await tokenContract.allowance(rootState.network.account, poolContract.address), decimals);

        if (parseFloat(allowance) < parseFloat(depositRequest.amount)) {
          let approveTransaction = await tokenContract.connect(provider.getSigner())
            .approve(poolContract.address,
              parseUnits(String(depositRequest.amount), decimals));

          await awaitConfirmation(approveTransaction, provider, 'approve');
        }

        depositTransaction = await poolContract
          .connect(provider.getSigner())
          .deposit(parseUnits(String(depositRequest.amount), decimals));
      }
      await awaitConfirmation(depositTransaction, provider, 'deposit');
      setTimeout(() => {
        dispatch('network/updateBalance', {}, {root: true});
      }, 1000);

      setTimeout(() => {
        dispatch('setupPools');
      }, 30000);
    },

    async withdraw({state, rootState, dispatch}, {withdrawRequest}) {
      const provider = rootState.network.provider;
      let withdrawTransaction;
      const pool = state.pools.find(pool => pool.asset.symbol === withdrawRequest.assetSymbol);
      if (withdrawRequest.withdrawNativeToken) {
        withdrawTransaction = await pool.contract.connect(provider.getSigner())
          .withdrawNativeToken(
            parseUnits(String(withdrawRequest.amount),
              config.ASSETS_CONFIG[withdrawRequest.assetSymbol].decimals));
      } else {
        withdrawTransaction = await pool.contract.connect(provider.getSigner())
          .withdraw(
            parseUnits(String(withdrawRequest.amount),
              config.ASSETS_CONFIG[withdrawRequest.assetSymbol].decimals));
      }
      await awaitConfirmation(withdrawTransaction, provider, 'deposit');

      setTimeout(() => {
        dispatch('network/updateBalance', {}, {root: true});
      }, 1000);

      setTimeout(() => {
        dispatch('setupPools');
      }, 30000);
    },
  }
};
