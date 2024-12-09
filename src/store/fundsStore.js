import {
  awaitConfirmation,
  isOracleError,
  signMessage,
  loanTermsToSign,
  wrapContract, getLog, decodeOutput, capitalize
} from '../utils/blockchain';
import SMART_LOAN from '@artifacts/contracts/interfaces/SmartLoanGigaChadInterface.sol/SmartLoanGigaChadInterface.json';
import ABI_WOMBAT_DYNAMIC_POOL_V2 from '../abis/WombatDynamicPoolV2.json';
import {formatUnits, fromWei, parseUnits, toWei} from '@/utils/calculate';
import config from '@/config';
import redstone from 'redstone-api';
import {BigNumber, utils} from 'ethers';
import {getBinPrice, mergeArrays, paraSwapRouteToSimpleData, removePaddedTrailingZeros} from '../utils/calculate';
import wrappedAbi from '../../test/abis/WAVAX.json';
import erc20ABI from '../../test/abis/ERC20.json';
import router from '@/router';

import LB_PAIR from '/artifacts/contracts/interfaces/joe-v2/ILBPair.sol/ILBPair.json'

import {constructSimpleSDK, SimpleFetchSDK, SwapSide} from '@paraswap/sdk';
import axios from 'axios';
import LB_TOKEN from '/artifacts/contracts/interfaces/joe-v2/ILBToken.sol/ILBToken.json'
import MULTICALL from '/artifacts/contracts/lib/Multicall3.sol/Multicall3.json'
import IBALANCER_V2_GAUGE from '/artifacts/contracts/interfaces/balancer-v2/IBalancerV2Gauge.sol/IBalancerV2Gauge.json'
import {decodeFunctionData} from 'viem';
import {expect} from 'chai';
import YAK_ROUTER_ABI from '../../test/abis/YakRouter.json';
import {getSwapData} from '../utils/paraSwapUtils';
import {getBurnData} from '../utils/caiUtils';
import {combineLatest, from, map, tap} from 'rxjs';
import ABI_YY_WOMBAT_STRATEGY from '../abis/YYWombatStrategy.json';

const toBytes32 = require('ethers').utils.formatBytes32String;
const fromBytes32 = require('ethers').utils.parseBytes32String;
const ethers = require('ethers');

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
const SUCCESS_DELAY_AFTER_TRANSACTION = 1000;

let SMART_LOAN_FACTORY_TUP;
let DIAMOND_BEACON;
let SMART_LOAN_FACTORY;
let TOKEN_MANAGER;
let TOKEN_MANAGER_TUP;
let TOKEN_ADDRESSES;

let readProvider;
let multicallContract;

export default {
  namespaced: true,
  state: {
    assets: null,
    lpAssets: null,
    concentratedLpAssets: null,
    traderJoeV2LpAssets: null,
    balancerLpAssets: null,
    levelLpAssets: null,
    gmxV2Assets: null,
    supportedAssets: null,
    provider: null,
    readSmartLoanContract: null,
    historicalSmartLoanContract: null,
    smartLoanContract: null,
    smartLoanFactoryContract: null,
    wrappedTokenContract: null,
    multicallContract: null,
    assetBalances: null,
    balancerLpBalances: null,
    lpBalances: null,
    concentratedLpBalances: null,
    levelLpBalances: null,
    gmxV2Balances: null,
    penpieLpBalances: null,
    penpieLpAssets: null,
    wombatLpBalances: null,
    wombatLpAssets: null,
    wombatYYFarmsBalances: null,
    accountApr: null,
    debt: null,
    totalValue: null,
    thresholdWeightedValue: null,
    health: null,
    fullLoanStatus: {},
    noSmartLoan: null,
    protocolPaused: false,
    oracleError: false,
    debtsPerAsset: null,
    apys: null,
  },
  mutations: {
    setSmartLoanContract(state, smartLoanContract) {
      state.smartLoanContract = smartLoanContract;
    },

    setReadSmartLoanContract(state, smartLoanContract) {
      state.readSmartLoanContract = smartLoanContract;
    },

    setHistoricalSmartLoanContract(state, smartLoanContract) {
      state.historicalSmartLoanContract = smartLoanContract;
    },

    setApys(state, apys) {
      state.apys = apys;
    },

    setAssets(state, assets) {
      state.assets = assets;
    },

    setLpAssets(state, assets) {
      state.lpAssets = assets;
    },

    setConcentratedLpAssets(state, assets) {
      state.concentratedLpAssets = assets;
    },

    setPenpieLpAssets(state, assets) {
      state.penpieLpAssets = assets;
    },

    setWombatLpAssets(state, assets) {
      state.wombatLpAssets = assets;
    },

    setTraderJoeV2LpAssets(state, assets) {
      state.traderJoeV2LpAssets = assets;
    },

    setBalancerLpAssets(state, assets) {
      state.balancerLpAssets = assets;
    },

    setLevelLpAssets(state, assets) {
      state.levelLpAssets = assets;
    },

    setGmxV2Assets(state, assets) {
      state.gmxV2Assets = assets;
    },

    setSupportedAssets(state, assets) {
      state.supportedAssets = assets;
    },

    setSmartLoanFactoryContract(state, smartLoanFactoryContract) {
      state.smartLoanFactoryContract = smartLoanFactoryContract;
    },

    setWrappedTokenContract(state, wrappedTokenContract) {
      state.wrappedTokenContract = wrappedTokenContract;
    },

    setMulticallContract(state, multicall) {
      state.multicallContract = multicall;
    },

    setAssetBalances(state, assetBalances) {
      state.assetBalances = assetBalances;
    },

    setSingleAssetBalance(state, assetBalanceChange) {
      state.assetBalances[assetBalanceChange.asset] = assetBalanceChange.balance;
    },

    setSingleAssetCurrentExposure(state, assetExposureChange) {
      state.assets[assetExposureChange.asset].currentExposure += assetExposureChange.exposureChange;
    },

    setLpBalances(state, lpBalances) {
      state.lpBalances = lpBalances;
    },

    setConcentratedLpBalances(state, lpBalances) {
      state.concentratedLpBalances = lpBalances;
    },

    setBalancerLpBalances(state, lpBalances) {
      state.balancerLpBalances = lpBalances;
    },

    setLevelLpBalances(state, lpBalances) {
      state.levelLpBalances = lpBalances;
    },

    setGmxV2Balances(state, balances) {
      state.gmxV2Balances = balances;
    },

    setPenpieLpBalances(state, balances) {
      state.penpieLpBalances = balances;
    },

    setWombatLpBalances(state, balances) {
      state.wombatLpBalances = balances;
    },

    setWombatYYFarmsBalances(state, balances) {
      state.wombatYYFarmsBalances = balances;
    },

    setFullLoanStatus(state, status) {
      state.fullLoanStatus = status;
    },

    setNoSmartLoan(state, noSmartLoan) {
      state.noSmartLoan = noSmartLoan;
    },

    setProtocolPaused(state, paused) {
      state.protocolPaused = paused;
    },

    setOracleError(state, error) {
      state.oracleError = error;
    },

    setDebtsPerAsset(state, debtsPerAsset) {
      state.debtsPerAsset = debtsPerAsset;
    },

    setSingleAssetDebt(state, assetDebtChange) {
      state.debtsPerAsset[assetDebtChange.asset].debt = assetDebtChange.debt;
    },

    setAccountApr(state, apr) {
      state.accountApr = apr;
    },
  },

  getters: {
    getCollateral(state) {
      return state.fullLoanStatus.totalValue - state.fullLoanStatus.debt;
    },
  },

  actions: {
    async fundsStoreSetup({state, rootState, dispatch, commit}) {
      console.log('fundsStoreSetup')
      if (!rootState.network.provider) return;
      await dispatch('loadDeployments');
      await dispatch('setupContracts');
      await dispatch('setupSmartLoanContract');
      await dispatch('setupSupportedAssets');
      await dispatch('setupApys');
      await dispatch('setupAssets');
      await dispatch('setupLpAssets');
      await dispatch('setupConcentratedLpAssets');
      await dispatch('setupTraderJoeV2LpAssets');
      await dispatch('setupWombatLpAssets');
      if (config.BALANCER_LP_ASSETS_CONFIG) await dispatch('setupBalancerLpAssets');
      if (config.LEVEL_LP_ASSETS_CONFIG) await dispatch('setupLevelLpAssets');
      if (config.GMX_V2_ASSETS_CONFIG) await dispatch('setupGmxV2Assets');
      if (config.PENPIE_LP_ASSETS_CONFIG) await dispatch('setupPenpieLpAssets');
      // Avalanche-specific methods
      if (window.chain === 'avalanche') {
        rootState.serviceRegistry.ggpIncentivesService.emitLoadData(state.smartLoanContract.address);
      }
      await dispatch('getAllAssetsApys');
      await dispatch('stakeStore/updateStakedPrices', null, {root: true});
      state.assetBalances = [];

      const diamond = new ethers.Contract(DIAMOND_BEACON.address, DIAMOND_BEACON.abi, provider.getSigner());
      readProvider = new ethers.providers.JsonRpcProvider(config.readRpcUrl);
      multicallContract = new ethers.Contract(config.multicallAddress, MULTICALL.abi, readProvider);

      let isActive = await diamond.getStatus();
      await commit('setProtocolPaused', !isActive);

      if (state.smartLoanContract.address !== NULL_ADDRESS) {
        state.assetBalances = null;
        await dispatch('getAllAssetsBalances');
        await dispatch('stakeStore/updateStakedBalances', null, {root: true});
        await dispatch('getDebtsPerAsset');
        rootState.serviceRegistry.aprService.emitRefreshApr();
        await dispatch('setupAssetExposures');
        try {
          await dispatch('getFullLoanStatus');
        } catch (e) {
          if (isOracleError(e)) await commit('setOracleError', true);
        }

        commit('setNoSmartLoan', false);
      } else {
        commit('setNoSmartLoan', true);
      }

      // Arbitrum-specific methods
      if (window.chain === 'arbitrum') {
        rootState.serviceRegistry.ltipService.emitRefreshPrimeAccountsLtipData(state.smartLoanContract.address, state.assets['ARB'].price, rootState.serviceRegistry.dataRefreshEventService);
        rootState.serviceRegistry.ltipService.emitRefreshPrimeAccountEligibleTvl(wrapContract(state.smartLoanContract));
      }
    },

    async loadDeployments() {
      SMART_LOAN_FACTORY_TUP = await import(`/deployments/${window.chain}/SmartLoansFactoryTUP.json`);
      DIAMOND_BEACON = await import(`/deployments/${window.chain}/SmartLoanDiamondBeacon.json`);
      SMART_LOAN_FACTORY = await import(`/deployments/${window.chain}/SmartLoansFactory.json`);
      TOKEN_MANAGER = await import(`/deployments/${window.chain}/TokenManager.json`);
      TOKEN_MANAGER_TUP = await import(`/deployments/${window.chain}/TokenManagerTUP.json`);
      TOKEN_ADDRESSES = await import(`/common/addresses/${window.chain}/token_addresses.json`);
    },

    async updateFunds({state, dispatch, commit, rootState}) {
      console.log('updateFunds')
      try {
        if (state.smartLoanContract.address !== NULL_ADDRESS) {
          commit('setNoSmartLoan', false);
        }

        await dispatch('setupApys');
        await dispatch('setupAssets');
        await dispatch('setupLpAssets');
        await dispatch('setupConcentratedLpAssets');
        await dispatch('setupTraderJoeV2LpAssets');
        if (config.BALANCER_LP_ASSETS_CONFIG) await dispatch('setupBalancerLpAssets');
        if (config.LEVEL_LP_ASSETS_CONFIG) await dispatch('setupLevelLpAssets');
        if (config.GMX_V2_ASSETS_CONFIG) await dispatch('setupGmxV2Assets');
        if (config.PENPIE_LP_ASSETS_CONFIG) await dispatch('setupPenpieLpAssets');
        if (config.WOMBAT_LP_ASSETS_CONFIG) await dispatch('setupWombatLpAssets');
        await dispatch('getAllAssetsBalances');
        await dispatch('getAllAssetsApys');
        await dispatch('getDebtsPerAsset');
        await dispatch('getFullLoanStatus');
        await dispatch('stakeStore/updateStakedBalances', null, {root: true});

        rootState.serviceRegistry.aprService.emitRefreshApr();
        rootState.serviceRegistry.healthService.emitRefreshHealth();

        if (window.chain === 'arbitrum') {
          rootState.serviceRegistry.ltipService.updateLtipData(state.smartLoanContract.address, state.assets['ARB'].price, rootState.serviceRegistry.dataRefreshEventService);
          rootState.serviceRegistry.ltipService.emitRefreshPrimeAccountEligibleTvl(wrapContract(state.smartLoanContract));
        }

        await dispatch('setupAssetExposures');

        setTimeout(async () => {
          await dispatch('getFullLoanStatus');
        }, 5000);
      } catch (error) {
        console.error(error);
        console.error('ERROR DURING UPDATE FUNDS');
        console.warn('refreshing page in 5s');
        await dispatch('updateFunds');
      }
    },


    async setupSupportedAssets({commit}) {
      const tokenManager = new ethers.Contract(TOKEN_MANAGER_TUP.address, TOKEN_MANAGER.abi, provider.getSigner());
      const whiteListedTokenAddresses = await tokenManager.getSupportedTokensAddresses();
      console.log('state.supportedAssets', whiteListedTokenAddresses);
      const supported = whiteListedTokenAddresses
        .map(address => Object.keys(TOKEN_ADDRESSES).find(symbol => symbol !== 'default' && TOKEN_ADDRESSES[symbol].toLowerCase() === address.toLowerCase()));

      commit('setSupportedAssets', supported);
    },

    async setupApys({commit}) {
      if (window.disableExternalData) {
        commit('setApys', []);
      } else {
        try {
          let params = {
            TableName: 'apys-prod'
          };

          const apyDoc = await (await fetch('https://2t8c1g5jra.execute-api.us-east-1.amazonaws.com/apys')).json();
          const wombatApys = await (await fetch('https://uanma460nl.execute-api.eu-central-1.amazonaws.com/apys')).json();

          const apys = {};

          apyDoc.map(apy => {
            apys[apy.id] = {...apy};
          });
          wombatApys.forEach(apy => {
            apys[apy.id] = {...apy};
          });

          console.log(apys);

          commit('setApys', apys);
        } catch (e) {
          window.disableExternalData = true;
          commit('setApys', []);
        }
      }
    },

    async setupAssets({state, commit, rootState}) {
      const nativeToken = Object.entries(config.ASSETS_CONFIG).find(asset => asset[0] === config.nativeToken);
      console.warn('SETUP ASSETS');
      console.warn(state.assetBalances);

      let assets = {};
      assets[nativeToken[0]] = nativeToken[1];

      Object.values(config.ASSETS_CONFIG).forEach(
        asset => {
          assets[asset.symbol] = asset;
        }
      );

      const redstonePriceDataRequest = await fetch(config.redstoneFeedUrl);
      const redstonePriceData = await redstonePriceDataRequest.json();
      console.log('redstonePriceData', redstonePriceData);
      Object.keys(assets).forEach(assetSymbol => {
        if (redstonePriceData[assetSymbol]) {
          assets[assetSymbol].price = redstonePriceData[assetSymbol][0].dataPoints[0].value;
        } else {
          assets[assetSymbol].price = 0
        }
      });
      commit('setAssets', assets);

      rootState.serviceRegistry.priceService.emitRefreshPrices();

      //Done here to speed up
      Object.keys(assets).forEach(assetSymbol => {
        if (assets[assetSymbol].fetchPrice) {
          fetch(assets[assetSymbol].priceEndpoint).then(
            async resp => {
              let json = await resp.json();
              assets[assetSymbol].price = json.error ? 0 : json[assets[assetSymbol].priceJsonField];
              commit('setAssets', assets);
              rootState.serviceRegistry.priceService.emitRefreshPrices();
            }
          )
        }
      });

    },

    async setupAssetExposures({state, rootState, commit}) {
      const tokenManager = new ethers.Contract(TOKEN_MANAGER_TUP.address, TOKEN_MANAGER.abi, provider.getSigner());
      let allAssets = state.assets;
      let allLevelLpAssets = state.levelLpAssets;
      let allBalancerLpAssets = state.balancerLpAssets;
      let allGmxV2Assets = state.gmxV2Assets;
      let allPenpieAssets = state.penpieLpAssets;
      let allWombatAssets = state.wombatLpAssets;
      const dataRefreshNotificationService = rootState.serviceRegistry.dataRefreshEventService;

      async function setExposures(assets) {
        for (let symbol of Object.keys(assets)) {
          let asset = assets[symbol];

          if (asset.groupIdentifier) {
            const decimals = asset.decimals;

            const exposure = await tokenManager.groupToExposure(toBytes32(asset.groupIdentifier));

            asset.currentExposure = parseFloat(formatUnits(exposure.current, decimals));
            asset.maxExposure = parseFloat(formatUnits(exposure.max, decimals));

            dataRefreshNotificationService.emitAssetUpdatedEvent(asset);
          }
        }
      }

      await setExposures(allAssets);
      commit('setAssets', allAssets);

      if (allBalancerLpAssets) {
        await setExposures(allBalancerLpAssets);
        commit('setBalancerLpAssets', allBalancerLpAssets);
      }

      if (allLevelLpAssets) {
        await setExposures(allLevelLpAssets);
        commit('setLevelLpAssets', allLevelLpAssets);
      }

      if (allGmxV2Assets) {
        await setExposures(allGmxV2Assets);
        commit('setGmxV2Assets', allGmxV2Assets);
      }

      if (allPenpieAssets) {
        await setExposures(allPenpieAssets);
        commit('setPenpieLpAssets', allPenpieAssets);
      }

      if (allWombatAssets) {
        await setExposures(allWombatAssets);
        commit('setWombatLpAssets', allWombatAssets);
      }
    },

    async setupLpAssets({state, rootState, commit}) {
      const lpService = rootState.serviceRegistry.lpService;
      let lpTokens = {};

      Object.values(config.LP_ASSETS_CONFIG).forEach(
        asset => {
          if (state.supportedAssets.includes(asset.symbol)) {
            lpTokens[asset.symbol] = asset;
          }
        }
      );

      const redstonePriceDataRequest = await fetch(config.redstoneFeedUrl);
      const redstonePriceData = await redstonePriceDataRequest.json();

      Object.keys(lpTokens).forEach(async assetSymbol => {
        lpTokens[assetSymbol].price = redstonePriceData[assetSymbol] ? redstonePriceData[assetSymbol][0].dataPoints[0].value : 0;
        lpService.emitRefreshLp();
      });

      commit('setLpAssets', lpTokens);
    },

    async setupConcentratedLpAssets({state, rootState, commit}) {
      const lpService = rootState.serviceRegistry.lpService;
      let lpTokens = {};

      Object.values(config.CONCENTRATED_LP_ASSETS_CONFIG).forEach(
        asset => {
          if (state.supportedAssets.includes(asset.symbol)) {
            lpTokens[asset.symbol] = asset;
          }
        }
      );

      const redstonePriceDataRequest = await fetch(config.redstoneFeedUrl);
      const redstonePriceData = await redstonePriceDataRequest.json();

      Object.keys(lpTokens).forEach(async assetSymbol => {
        lpTokens[assetSymbol].price = redstonePriceData[assetSymbol] ? redstonePriceData[assetSymbol][0].dataPoints[0].value : 0;
        lpService.emitRefreshLp();
      });

      commit('setConcentratedLpAssets', lpTokens);
    },

    async setupWombatLpAssets({state, rootState, commit}) {
      if (!state.smartLoanContract || state.smartLoanContract.address === NULL_ADDRESS) return;
      const lpService = rootState.serviceRegistry.lpService;
      let lpTokens = {};
      Object.entries(config.WOMBAT_LP_ASSETS).forEach(
        ([assetKey, asset]) => {
          lpTokens[assetKey] = asset;
        }
      );

      const redstonePriceDataRequest = await fetch(config.redstoneFeedUrl);
      const redstonePriceData = await redstonePriceDataRequest.json();

      Object.keys(lpTokens).forEach(async assetSymbol => {
        lpTokens[assetSymbol].price = redstonePriceData[assetSymbol] ? redstonePriceData[assetSymbol][0].dataPoints[0].value : 0;
        lpService.emitRefreshLp();
      });

      const loanAssets = mergeArrays([
        (await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG)
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets)

      const getAssetFromAddress = (address) => {
        return Object.entries(TOKEN_ADDRESSES).find(([_, tokenAddress]) => tokenAddress.toLowerCase() === address.toLowerCase())[0]
      }

      combineLatest(
        Object.keys(lpTokens).map(key =>
          from(wrappedContract[lpTokens[key].pendingRewardsMethod]())
            .pipe(
              map((rewards) => {
                const rewardsPerAsset = [];
                rewards.rewardTokenAddresses.forEach((rewardAddress, index) => {
                  const asset = getAssetFromAddress(rewardAddress)
                  const foundIndex = rewardsPerAsset.findIndex(entry => entry.asset === asset)
                  if (foundIndex < 0) {
                    rewardsPerAsset.push({
                      asset: asset,
                      amount: rewards.pendingRewards[index],
                      amountFormatted: fromWei(rewards.pendingRewards[index]),
                    })
                  } else {
                    rewardsPerAsset[foundIndex].amount = rewardsPerAsset[foundIndex].amount.add(rewards.pendingRewards[index]);
                    rewardsPerAsset[foundIndex].amountFormatted += fromWei(rewards.pendingRewards[index]);
                  }
                })
                return rewardsPerAsset.filter(({amount}) => !amount.isZero())
              }),
              map(rewards => ({
                token: key,
                rewards
              })))
        )
      ).subscribe(rewardsArray => {
        rewardsArray.forEach(({token, rewards}) => {
          lpTokens[token]['rewards'] = rewards
        })
        commit('setWombatLpAssets', lpTokens);
        lpService.emitRefreshLp('WOMBAT_LP');
      })
    },

    async setupPenpieLpAssets({state, rootState, commit}) {
      if (!state.smartLoanContract || state.smartLoanContract.address === NULL_ADDRESS) return;
      const lpService = rootState.serviceRegistry.lpService;
      let lpTokens = {};
      Object.values(config.PENPIE_LP_ASSETS_CONFIG).forEach(
        asset => {
          // todo when PENDLE added to supported assets
          // if (state.supportedAssets.includes(asset.symbol)) {
          lpTokens[asset.symbol] = asset;
          // }
        }
      );

      const redstonePriceDataRequest = await fetch(config.redstoneFeedUrl);
      const redstonePriceData = await redstonePriceDataRequest.json();

      Object.keys(lpTokens).forEach(async assetSymbol => {
        lpTokens[assetSymbol].price = redstonePriceData[assetSymbol] ? redstonePriceData[assetSymbol][0].dataPoints[0].value : 0;
        lpService.emitRefreshLp();
      });

      const loanAssets = mergeArrays([
        (await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG)
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets)

      const getAssetFromAddress = (address) => {
        return Object.entries(TOKEN_ADDRESSES).find(([_, tokenAddress]) => tokenAddress === address)[0]
      }


      combineLatest(
        Object.keys(lpTokens).map(key =>
          from(wrappedContract.pendingRewards(lpTokens[key].pendleLpAddress))
            .pipe(
              map((rewards) => ([
                {asset: 'PENPIE', amount: rewards[0]},
                ...rewards[1].map((rewardAddress, index) => ({
                  asset: getAssetFromAddress(rewardAddress),
                  amount: rewards[2][index],
                  amountFormatted: fromWei(rewards[2][index]),
                }))
              ].filter(({amount}) => !amount.isZero()))),
              map(rewards => ({
                token: key,
                rewards
              })))
        )
      ).subscribe(rewardsArray => {
        rewardsArray.forEach(({token, rewards}) => {
          lpTokens[token]['rewards'] = rewards
        })
        commit('setPenpieLpAssets', lpTokens);
        lpService.emitRefreshLp('PENPIE_LP');
      })
    },

    async setupTraderJoeV2LpAssets({state, rootState, commit}) {
      let lpTokens = {};

      Object.values(config.TRADERJOEV2_LP_ASSETS_CONFIG).forEach(async asset => {
        // To-do: check if the assets supported. correct symbols if not.
        lpTokens[asset.symbol] = asset;
      });

      // To-do: request price of TJLB token prices from Redstone

      commit('setTraderJoeV2LpAssets', lpTokens);
    },

    async setupLevelLpAssets({state, rootState, commit}) {
      const lpService = rootState.serviceRegistry.lpService;
      let lpTokens = {};

      Object.values(config.LEVEL_LP_ASSETS_CONFIG).forEach(
        asset => {
          if (state.supportedAssets.includes(asset.symbol)) {
            lpTokens[asset.symbol] = asset;
          }
        }
      );

      const redstonePriceDataRequest = await fetch(config.redstoneFeedUrl);
      const redstonePriceData = await redstonePriceDataRequest.json();

      Object.keys(lpTokens).forEach(async assetSymbol => {
        lpTokens[assetSymbol].price = redstonePriceData[assetSymbol] ? redstonePriceData[assetSymbol][0].dataPoints[0].value : 0;
        lpService.emitRefreshLp();
      });

      commit('setLevelLpAssets', lpTokens);
    },

    async setupBalancerLpAssets({state, rootState, commit}) {
      const lpService = rootState.serviceRegistry.lpService;
      let lpTokens = {};

      Object.values(config.BALANCER_LP_ASSETS_CONFIG).forEach(
        asset => {
          //TODO: bring back
          // if (state.supportedAssets.includes(asset.symbol)) {
          lpTokens[asset.symbol] = asset;
          // }
        }
      );

      const redstonePriceDataRequest = await fetch(config.redstoneFeedUrl);
      const redstonePriceData = await redstonePriceDataRequest.json();

      Object.keys(lpTokens).forEach(async assetSymbol => {
        lpTokens[assetSymbol].price = redstonePriceData[assetSymbol] ? redstonePriceData[assetSymbol][0].dataPoints[0].value : 0;
        lpService.emitRefreshLp();
      });

      commit('setBalancerLpAssets', lpTokens);
    },

    async setupGmxV2Assets({state, rootState, commit}) {
      const lpService = rootState.serviceRegistry.lpService;
      let lpTokens = {};

      Object.values(config.GMX_V2_ASSETS_CONFIG).forEach(
        asset => {
          if (true) {
            lpTokens[asset.symbol] = asset;
          }
        }
      );

      const redstonePriceDataRequest = await fetch(config.redstoneFeedUrl);
      const redstonePriceData = await redstonePriceDataRequest.json();

      Object.keys(lpTokens).forEach(async assetSymbol => {
        lpTokens[assetSymbol].price = redstonePriceData[assetSymbol] ? redstonePriceData[assetSymbol][0].dataPoints[0].value : 0;
        lpService.emitRefreshLp();
      });

      commit('setGmxV2Assets', lpTokens);
    },


    async setupContracts({rootState, commit}) {
      const smartLoanFactoryContract = new ethers.Contract(SMART_LOAN_FACTORY_TUP.address, SMART_LOAN_FACTORY.abi, provider.getSigner());
      const wrappedTokenContract = new ethers.Contract(config.WRAPPED_TOKEN_ADDRESS, wrappedAbi, provider.getSigner());
      let readProvider;
      readProvider = new ethers.providers.JsonRpcProvider(config.readRpcUrl);
      console.log(readProvider);
      const networkResultPromise = readProvider._networkPromise;
      networkResultPromise.catch(networkResultError => {
        console.log(networkResultError);
        if (networkResultError.code === 'NETWORK_ERROR') {
          console.warn('NETWORK ERROR');
          const primaryRpcError = !config.fallbackRpcs.includes(config.readRpcUrl);
          const rpcErrorData = {
            nextRpcToTry: primaryRpcError ? config.fallbackRpcs[0] : config.fallbackRpcs[config.fallbackRpcs.indexOf(config.readRpcUrl) + 1],
            rpcNotWorking: config.readRpcUrl,
            errorDate: new Date(),
          }

          localStorage.setItem('RPC_ERROR_DATA', JSON.stringify(rpcErrorData));
          window.location.reload();
        }
      })

      const multicallContract = new ethers.Contract(config.multicallAddress, MULTICALL.abi, readProvider);

      commit('setSmartLoanFactoryContract', smartLoanFactoryContract);
      commit('setWrappedTokenContract', wrappedTokenContract);
      commit('setMulticallContract', multicallContract);
    },

    async setupSmartLoanContract({state, rootState, commit}) {
      const provider = rootState.network.provider;

      let smartLoanAddress;
      smartLoanAddress = await state.smartLoanFactoryContract.getLoanForOwner(rootState.network.account);

      if (router && router.currentRoute) {
        if (router.currentRoute.query.user) {
          smartLoanAddress = await state.smartLoanFactoryContract.getLoanForOwner(router.currentRoute.query.user);
        } else if (router.currentRoute.query.account) {
          smartLoanAddress = router.currentRoute.query.account;
        }
      }


      const smartLoanContract = new ethers.Contract(smartLoanAddress, SMART_LOAN.abi, provider.getSigner());

      let readProvider = new ethers.providers.JsonRpcProvider(config.readRpcUrl);
      const readSmartLoanContract = new ethers.Contract(smartLoanAddress, SMART_LOAN.abi, readProvider);

      const historicalProvider = new ethers.providers.JsonRpcProvider(config.historicalRpcUrl);
      const historicalSmartLoanContract = new ethers.Contract(smartLoanAddress, SMART_LOAN.abi, historicalProvider);

      commit('setHistoricalSmartLoanContract', historicalSmartLoanContract);
      commit('setReadSmartLoanContract', readSmartLoanContract);
      commit('setSmartLoanContract', smartLoanContract);

      rootState.serviceRegistry.accountService.emitSmartLoanContract(smartLoanContract);
    },

    async createLoanAndDeposit({state, rootState, commit}, {request}) {
      const provider = rootState.network.provider;
      const amountInWei = parseUnits(request.value.toString(), request.assetDecimals);

      const signResult = await signMessage(provider, loanTermsToSign, rootState.network.account);
      if (!signResult) return;

      const transaction = await (await wrapContract(state.smartLoanFactoryContract)).createLoan();

      let tx = await awaitConfirmation(transaction, provider, 'create loan');

      const smartLoanAddress = getLog(tx, SMART_LOAN_FACTORY.abi, 'SmartLoanCreated').args.accountAddress;

      await rootState.serviceRegistry.termsService.saveSignedTerms(smartLoanAddress, rootState.network.account, signResult, 'PRIME_ACCOUNT');

      const fundToken = new ethers.Contract(request.assetAddress, erc20ABI, provider.getSigner());

      const allowance = formatUnits(await fundToken.allowance(rootState.network.account, smartLoanAddress), request.assetDecimals);

      if (parseFloat(allowance) < parseFloat(request.value)) {
        const approveTransaction = await fundToken.connect(provider.getSigner()).approve(smartLoanAddress, amountInWei);

        await awaitConfirmation(approveTransaction, provider, 'approve');
      }

      const smartLoanContract = new ethers.Contract(smartLoanAddress, SMART_LOAN.abi, provider.getSigner());

      const fundTx = request.asset === 'GLP' ?
        await smartLoanContract.fundGLP(
          amountInWei)
        :
        await smartLoanContract.fund(
          toBytes32(request.asset),
          amountInWei);


      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      tx = await awaitConfirmation(fundTx, provider, 'deposit');

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      const depositedAmount = getLog(tx, SMART_LOAN.abi, 'Funded').args.amount;
      const decimals = config.ASSETS_CONFIG[request.asset].decimals;

      const amount = formatUnits(depositedAmount, BigNumber.from(decimals));
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(request.asset, amount, false, true);
      const depositAmountUSD = Number(amount) * state.assets[request.asset].price;
      rootState.serviceRegistry.collateralService.emitCollateral(depositAmountUSD);

      await commit('setSingleAssetBalance', {asset: request.asset, balance: amount});
      commit('setNoSmartLoan', false);
    },

    async createAndFundLoan({state, rootState, commit, dispatch}, {asset, value, isLP}) {
      const provider = rootState.network.provider;
      const nativeAssetOptions = config.NATIVE_ASSET_TOGGLE_OPTIONS;

      const signResult = await signMessage(provider, loanTermsToSign, rootState.network.account);
      if (!signResult) return;

      //TODO: make it more robust
      if (asset === nativeAssetOptions[0]) {
        asset = config.ASSETS_CONFIG[nativeAssetOptions[0]];
        let depositTransaction = await state.wrappedTokenContract.deposit({value: toWei(String(value))});
        await awaitConfirmation(depositTransaction, provider, 'deposit');
      }

      if (asset === nativeAssetOptions[1]) {
        asset = config.ASSETS_CONFIG[nativeAssetOptions[0]];
      }

      const decimals = config.ASSETS_CONFIG[asset.symbol].decimals;
      const amount = parseUnits(String(value), decimals);
      const fundTokenContract = new ethers.Contract(TOKEN_ADDRESSES[asset.symbol], erc20ABI, provider.getSigner());

      const allowance = formatUnits(await fundTokenContract.allowance(rootState.network.account, state.smartLoanFactoryContract.address), decimals);

      if (parseFloat(allowance) < parseFloat(value)) {
        const approveTransaction = await fundTokenContract.approve(state.smartLoanFactoryContract.address, amount);
        await awaitConfirmation(approveTransaction, provider, 'approve');
      }

      const wrappedSmartLoanFactoryContract = await wrapContract(state.smartLoanFactoryContract);

      console.log(config.chainId === 43114);
      console.log(config.chainId);
      const transaction = config.chainId === 43114 ?
        await wrappedSmartLoanFactoryContract.createAndFundLoan(toBytes32(asset.symbol), fundTokenContract.address, amount)
        : await wrappedSmartLoanFactoryContract.createAndFundLoan(toBytes32(asset.symbol), amount);

      console.log(transaction);
      const createTx = await awaitConfirmation(transaction, provider, 'create and fund loan');
      const log = getLog(createTx, SMART_LOAN_FACTORY.abi, 'SmartLoanCreated');
      console.log('SmartLoanCreated LOGGGG', log);

      const smartLoanAddress = log.args.accountAddress;

      await rootState.serviceRegistry.termsService.saveSignedTerms(smartLoanAddress, rootState.network.account, signResult, 'PRIME_ACCOUNT');


      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      const tx = await awaitConfirmation(transaction, provider, 'create Prime Account');

      console.log(tx);

      const log2 = getLog(tx, SMART_LOAN_FACTORY.abi, 'SmartLoanCreated');
      console.log('log2', log2);
      const fundAmount = formatUnits(log2.args.collateralAmount, decimals);
      const fundAmountUSD = Number(fundAmount) * state.assets[asset.symbol].price;

      await commit('setSingleAssetBalance', {asset: asset.symbol, balance: fundAmount});
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(asset, fundAmount, isLP, true);
      rootState.serviceRegistry.collateralService.emitCollateral(fundAmountUSD);

      commit('setNoSmartLoan', false);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      await dispatch('setupSmartLoanContract');
      // TODO check on mainnet

      setTimeout(() => {
        window.location.reload();
      }, 3000);

      setTimeout(async () => {
        await dispatch('network/updateBalance', {}, {root: true});
        rootState.serviceRegistry.healthService.emitRefreshHealth();
      }, 5000);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, 30000);
    },

    async getAllAssetsBalances({state, commit, rootState, dispatch}) {
      let hasDeprecatedAssets = false;
      console.log('getAllAssetsBalances')
      const dataRefreshNotificationService = rootState.serviceRegistry.dataRefreshEventService;
      const balances = {};
      const lpBalances = {};
      const concentratedLpBalances = {};
      const gmxV2Balances = {};
      const balancerLpBalances = {};
      const penpieLpBalances = {};
      let wombatLpBalances = {};
      let wombatFarmsBalances = {};
      const balancerLpAssets = state.balancerLpAssets;
      const levelLpBalances = {};
      const assetBalances = await state.readSmartLoanContract.getAllAssetsBalances();
      assetBalances.forEach(
        asset => {
          let symbol = fromBytes32(asset.name);
          if (config.ASSETS_CONFIG[symbol]) {
            balances[symbol] = formatUnits(asset.balance.toString(), config.ASSETS_CONFIG[symbol].decimals);
            if (config.ASSETS_CONFIG[symbol].droppingSupport && balances[symbol] > 0) {
              console.warn('Has depracated asset' + symbol);
              hasDeprecatedAssets = true;
            }
          }
          if (config.LP_ASSETS_CONFIG[symbol]) {
            lpBalances[symbol] = formatUnits(asset.balance.toString(), config.LP_ASSETS_CONFIG[symbol].decimals);
            if (config.LP_ASSETS_CONFIG[symbol].droppingSupport && balances[symbol] > 0) {
              console.warn('Has depracated asset' + symbol);
              hasDeprecatedAssets = true;
            }
          }
          if (config.CONCENTRATED_LP_ASSETS_CONFIG[symbol]) {
            concentratedLpBalances[symbol] = formatUnits(asset.balance.toString(), config.CONCENTRATED_LP_ASSETS_CONFIG[symbol].decimals);
            if (config.CONCENTRATED_LP_ASSETS_CONFIG[symbol].droppingSupport && balances[symbol] > 0) {
              console.warn('Has depracated asset' + symbol);
              hasDeprecatedAssets = true;
            }
          }
          if (config.BALANCER_LP_ASSETS_CONFIG[symbol]) {
            balancerLpBalances[symbol] = formatUnits(asset.balance.toString(), config.BALANCER_LP_ASSETS_CONFIG[symbol].decimals);
          }
          if (config.GMX_V2_ASSETS_CONFIG[symbol]) {
            gmxV2Balances[symbol] = formatUnits(asset.balance.toString(), config.GMX_V2_ASSETS_CONFIG[symbol].decimals);
          }
          if (config.PENPIE_LP_ASSETS_CONFIG[symbol]) {
            penpieLpBalances[symbol] = formatUnits(asset.balance.toString(), config.PENPIE_LP_ASSETS_CONFIG[symbol].decimals);
          }
        }
      );

      const wombatAssets = Object.keys(config.WOMBAT_LP_ASSETS);
      if (wombatAssets.length) {
        const balanceArray = await Promise.all(wombatAssets.map(asset =>
          state.readSmartLoanContract[config.WOMBAT_LP_ASSETS[asset].balanceMethod]()
        ))
        balanceArray.forEach((balance, index) => {
          const asset = wombatAssets[index]
          wombatLpBalances[asset] = formatUnits(balance.toString(), config.WOMBAT_LP_ASSETS[asset].decimals)
        })
      }

      const wombatFarms = config.WOMBAT_YY_FARMS;
      if (wombatFarms.length) {
        const balanceArray = await Promise.all(wombatFarms.map(farm => {
          return state.readSmartLoanContract[farm.balanceMethod]()
        }))
        wombatFarms.forEach((farm, index) => {
          wombatFarmsBalances[farm.apyKey] = formatUnits(balanceArray[index].toString(), farm.decimals)
        })
        for (const farm of wombatFarms) {
          const contract = await new ethers.Contract(farm.strategyContract, ABI_YY_WOMBAT_STRATEGY, provider.getSigner());
          const YRTBalance = await contract.balanceOf(state.readSmartLoanContract.address);
          wombatFarmsBalances[farm.yrtKey] = formatUnits(YRTBalance.toString(), farm.decimals)
        }
      }

      if (hasDeprecatedAssets) {
        console.warn('hasDeprecatedAssets');
        rootState.serviceRegistry.deprecatedAssetsService.emitHasDeprecatedAssets();
      }

      if (config.LEVEL_LP_ASSETS_CONFIG) {
        let result = await state.multicallContract.callStatic.aggregate(
          Object.entries(config.LEVEL_LP_ASSETS_CONFIG).map(
            ([key, value]) => {
              return {
                target: state.readSmartLoanContract.address,
                callData: state.readSmartLoanContract.interface.encodeFunctionData(value.balanceMethod)
              }
            })
        );

        Object.keys(config.LEVEL_LP_ASSETS_CONFIG).forEach(
          (key, index) => {
            levelLpBalances[key] = fromWei(result.returnData[index]);
          }
        )
        console.warn('MULTICALL result');
        console.log(result);
      }

      if (config.BALANCER_LP_ASSETS_CONFIG) {
        //balances
        let result = await state.multicallContract.callStatic.aggregate(
          Object.entries(config.BALANCER_LP_ASSETS_CONFIG).map(
            ([key, value]) => {
              return {
                target: state.readSmartLoanContract.address,
                callData: state.readSmartLoanContract.interface.encodeFunctionData(value.gaugeBalanceMethod)
              }
            })
        );

        Object.keys(config.BALANCER_LP_ASSETS_CONFIG).forEach(
          (key, index) => {
            balancerLpBalances[key] = fromWei(result.returnData[index]);
          }
        )


        //TODO: optimize
        for (let [k, lpToken] of Object.entries(balancerLpAssets)) {
          let gauge = new ethers.Contract(lpToken.gaugeAddress, IBALANCER_V2_GAUGE.abi, provider.getSigner())

          try {
            let result = await state.multicallContract.callStatic.aggregate(
              lpToken.rewardTokens.map(
                (symbol) => {
                  return {
                    target: gauge.address,
                    callData: gauge.interface.encodeFunctionData('claimable_reward', [state.smartLoanContract.address, TOKEN_ADDRESSES[symbol]])
                  }
                })
            );

            lpToken.rewardBalances = {};

            lpToken.rewardTokens.forEach(
              (symbol, index) => {
                lpToken.rewardBalances[symbol] = formatUnits(result.returnData[index], config.ASSETS_CONFIG[symbol].decimals);
              }
            )
          } catch (e) {
          }
        }
      }

      // TODO remove after removing deprecated assets
      for (let asset of Object.values(state.assets)) {
        if (asset.droppingSupport || asset.unsupported) {
          console.log('droppingSupport', asset.symbol, balances[asset.symbol]);
          let tokenContract = new ethers.Contract(asset.address, erc20ABI, provider.getSigner());
          balances[asset.symbol] = formatUnits(await tokenContract.balanceOf(state.smartLoanContract.address), asset.decimals);
          if (balances[asset.symbol] === undefined || Number(balances[asset.symbol]) === 0) {
            console.warn('deleting', asset.symbol);
            delete state.assets[asset.symbol];
          }
        }
      }

      await commit('setAssets', state.assets);
      await commit('setAssetBalances', balances);
      await commit('setLpBalances', lpBalances);
      await commit('setConcentratedLpBalances', concentratedLpBalances);
      await commit('setBalancerLpBalances', balancerLpBalances);
      await commit('setBalancerLpAssets', balancerLpAssets);
      await commit('setLevelLpBalances', levelLpBalances);
      await commit('setGmxV2Balances', gmxV2Balances);
      await commit('setPenpieLpBalances', penpieLpBalances);
      await commit('setWombatLpBalances', wombatLpBalances);
      await commit('setWombatYYFarmsBalances', wombatFarmsBalances);
      await dispatch('setupConcentratedLpUnderlyingBalances');
      await dispatch('setupTraderJoeV2LpUnderlyingBalancesAndRewardsAndLiquidity');
      const refreshEvent = {assetBalances: balances, lpBalances: lpBalances};
      dataRefreshNotificationService.emitAssetBalancesDataRefresh();
      dataRefreshNotificationService.emitAssetBalancesDataRefreshEvent(refreshEvent);
    },

    async setupConcentratedLpUnderlyingBalances({state, commit, rootState}) {
      const concentratedLpAssets = state.concentratedLpAssets;

      const requests = []
      const abi = ['function getUnderlyingAssets(uint256) public view returns (uint256, uint256)'];
      // noinspection ES6MissingAwait
      Object.keys(state.concentratedLpAssets).forEach(async assetSymbol => {
        const poolContract = await new ethers.Contract(concentratedLpAssets[assetSymbol].address, abi, provider.getSigner());
        const poolBalance = toWei(state.concentratedLpBalances[assetSymbol].toString());
        requests.push({
          target: concentratedLpAssets[assetSymbol].address,
          callData: poolContract.interface.encodeFunctionData('getUnderlyingAssets', [poolBalance])
        })
      })

      const response = await multicallContract.callStatic.aggregate(requests);
      console.log('MULTI RESPONSE LEVEL');
      console.log(response);


      // noinspection ES6MissingAwait
      Object.keys(state.concentratedLpAssets).forEach(async assetSymbol => {
        console.log(assetSymbol);
        const abi = ['function getUnderlyingAssets(uint256) public view returns (uint256, uint256)'];
        const poolContract = await new ethers.Contract(concentratedLpAssets[assetSymbol].address, abi, provider.getSigner());
        const poolBalance = toWei(state.concentratedLpBalances[assetSymbol].toString());

        const balances = await poolContract.getUnderlyingAssets(poolBalance);
        console.log(balances);

        concentratedLpAssets[assetSymbol].primaryBalance = formatUnits(balances[0], state.assets[concentratedLpAssets[assetSymbol].primary].decimals);
        concentratedLpAssets[assetSymbol].secondaryBalance = formatUnits(balances[1], state.assets[concentratedLpAssets[assetSymbol].secondary].decimals);

        const lpService = rootState.serviceRegistry.lpService;
        lpService.emitRefreshLp();
      });
    },

    async fetchTraderJoeV2LpUnderlyingBalances({state}, {lbPairAddress, binIds, lpToken}) {
      const poolContract = new ethers.Contract(lbPairAddress, LB_PAIR.abi, provider.getSigner());

      let cumulativeTokenXAmount = BigNumber.from(0);
      let cumulativeTokenYAmount = BigNumber.from(0);

      let accountBalances = [];
      let accountBalancesPrimary = [];
      let accountBalancesSecondary = [];
      let binBalancePrimary = [];
      let binBalanceSecondary = [];
      let binTotalSupply = [];


      const requests = [];
      // noinspection ES6MissingAwait
      binIds.forEach(async binId => {
        requests.push(...[
          {
            target: poolContract.address,
            callData: poolContract.interface.encodeFunctionData('balanceOf', [state.smartLoanContract.address, binId]),
            name: `${binId}.balanceOf`
          },
          {
            target: poolContract.address,
            callData: poolContract.interface.encodeFunctionData('getBin', [binId]),
            name: `${binId}.getBin`
          },
          {
            target: poolContract.address,
            callData: poolContract.interface.encodeFunctionData('totalSupply', [binId]),
            name: `${binId}.totalSupply`
          }]
        );

      })


      const response = await multicallContract.callStatic.aggregate(requests);

      const binsData = [];
      for (let i = 0; i < response.returnData.length; i += 3) {
        binsData.push({
          lbTokenAmount: decodeOutput(LB_PAIR.abi, 'balanceOf', response.returnData[i]),
          reserves: decodeOutput(LB_PAIR.abi, 'getBin', response.returnData[i + 1]),
          totalSupply: decodeOutput(LB_PAIR.abi, 'totalSupply', response.returnData[i + 2]),
        })
      }

      binsData.forEach((binData, i) => {
        const lbTokenAmount = binData.lbTokenAmount[0];
        const reserves = binData.reserves;
        const totalSupply = binData.totalSupply[0];

        const binTokenXAmount = BigNumber.from(lbTokenAmount).mul(BigNumber.from(reserves[0])).div(BigNumber.from(totalSupply));
        const binTokenYAmount = BigNumber.from(lbTokenAmount).mul(BigNumber.from(reserves[1])).div(BigNumber.from(totalSupply));

        cumulativeTokenXAmount = cumulativeTokenXAmount.add(binTokenXAmount);
        cumulativeTokenYAmount = cumulativeTokenYAmount.add(binTokenYAmount);

        accountBalances[i] = fromWei(lbTokenAmount);
        accountBalancesPrimary[i] = formatUnits(binTokenXAmount, state.assets[lpToken.primary].decimals);
        accountBalancesSecondary[i] = formatUnits(binTokenYAmount, state.assets[lpToken.secondary].decimals);
        binBalancePrimary[i] = formatUnits(reserves[0], state.assets[lpToken.primary].decimals);
        binBalanceSecondary[i] = formatUnits(reserves[1], state.assets[lpToken.secondary].decimals);
        binTotalSupply[i] = fromWei(totalSupply);
      })

      return {
        cumulativeTokenXAmount,
        cumulativeTokenYAmount,
        accountBalances,
        accountBalancesPrimary,
        accountBalancesSecondary,
        binBalancePrimary,
        binBalanceSecondary,
        binTotalSupply
      }
    },

    async refreshTraderJoeV2LpUnderlyingBalancesAndRewardsAndLiquidity({state, dispatch, rootState}, {lpAsset}) {
      const provider = rootState.network.provider;
      const loanAllBins = await state.readSmartLoanContract.getOwnedTraderJoeV2Bins();
      const loanBinsForPair = loanAllBins.filter(bin =>
        bin.pair.toLowerCase() === lpAsset.address.toLowerCase()
      );
      const loanBinIds = loanBinsForPair.map(bin => bin.id);
      loanBinIds.sort((a, b) => a - b);

      const {
        cumulativeTokenXAmount,
        cumulativeTokenYAmount,
        accountBalances,
        accountBalancesPrimary,
        accountBalancesSecondary,
        binBalancePrimary,
        binBalanceSecondary,
        binTotalSupply
      } = await dispatch('fetchTraderJoeV2LpUnderlyingBalances', {
        lbPairAddress: lpAsset.address,
        binIds: loanBinIds,
        lpToken: lpAsset
      });

      let primaryToken = state.assets[lpAsset.primary];
      let secondaryToken = state.assets[lpAsset.secondary];

      let binPrices = loanBinIds.map(id => getBinPrice(id, lpAsset.binStep, primaryToken.decimals, secondaryToken.decimals))

      lpAsset.primaryBalance = formatUnits(cumulativeTokenXAmount, primaryToken.decimals);
      lpAsset.secondaryBalance = formatUnits(cumulativeTokenYAmount, secondaryToken.decimals);

      const isLiquidityValuable = Number(lpAsset.primaryBalance) > 0 || Number(lpAsset.secondaryBalance) > 0;

      console.log('loan bin ids', loanBinIds);

      lpAsset.binIds = isLiquidityValuable ? loanBinIds : []; // bin Ids where loan has liquidity for a LB pair
      lpAsset.accountBalances = isLiquidityValuable ? accountBalances : []; // balances of account owned bins (the same order as binIds)
      lpAsset.accountBalancesPrimary = isLiquidityValuable ? accountBalancesPrimary : []; // balances of account owned bins (the same order as binIds)
      lpAsset.accountBalancesSecondary = isLiquidityValuable ? accountBalancesSecondary : []; // balances of account owned bins (the same order as binIds)
      lpAsset.binPrices = isLiquidityValuable ? binPrices : []; // price assigned to each bin
      lpAsset.binBalancePrimary = isLiquidityValuable ? binBalancePrimary : []; // price assigned to each bin
      lpAsset.binBalanceSecondary = isLiquidityValuable ? binBalanceSecondary : []; // price assigned to each bin
      lpAsset.binTotalSupply = isLiquidityValuable ? binTotalSupply : []; // price assigned to each bin

      const traderJoeService = rootState.serviceRegistry.traderJoeService;

      try {
        const rewardsInfo = lpAsset.version === '2.2'
          ?
          {
            rewards: [
              {
                tokenAddress: config.ASSETS_CONFIG[lpAsset.rewardToken].address,
                amount: await traderJoeService.getRewardsInfoV2_2(lpAsset.hooksSimpleRewarder, state.smartLoanContract.address, lpAsset.binIds, provider)
              }
            ]
          }
          :
          await traderJoeService.getRewardsInfo(state.smartLoanContract.address, lpAsset.address);

        lpAsset.rewardsInfo = rewardsInfo;
      } catch (error) {
        console.log(`fetching climable rewards error: ${error}`);
      }

      const lpService = rootState.serviceRegistry.lpService;
      lpService.emitRefreshLp('TJV2');
    },

    async setupTraderJoeV2LpUnderlyingBalancesAndRewardsAndLiquidity({state, dispatch, rootState}) {
      const traderJoeV2LpAssets = state.traderJoeV2LpAssets;

      Object.keys(traderJoeV2LpAssets).forEach(async assetSymbol => {
        const lpAsset = traderJoeV2LpAssets[assetSymbol];

        await dispatch('refreshTraderJoeV2LpUnderlyingBalancesAndRewardsAndLiquidity', {lpAsset});
      });
    },

    async getAllAssetsApys({state, commit, rootState}) {
      const dataRefreshNotificationService = rootState.serviceRegistry.dataRefreshEventService;

      let assets = state.assets;
      const apys = state.apys;
      console.warn('--------___---__---APYYYYYYYS___--___--___--____--');
      console.log(apys);

      for (let [symbol, asset] of Object.entries(assets)) {
        // we don't use getApy method anymore, but fetch APYs from db
        if (apys[symbol] && apys[symbol].apy) {
          assets[symbol].apy = window.chain == 'arbitrum' ? apys[symbol].arbApy : apys[symbol].apy;
        }
      }

      commit('setAssets', assets);

      let lpAssets = state.lpAssets;

      for (let [symbol, lpAsset] of Object.entries(lpAssets)) {
        // we don't use getApy method anymore, but fetch APYs from db
        if (apys[symbol] && apys[symbol].lp_apy) {
          lpAssets[symbol].apy = apys[symbol].lp_apy;
        }
      }

      commit('setLpAssets', lpAssets);

      let concentratedLpAssets = state.concentratedLpAssets;

      //TODO: replace with for logic
      try {
        concentratedLpAssets['SHLB_AVAX-USDC_B'].apy = apys['AVAX_USDC'].apy * 100;
        concentratedLpAssets['SHLB_USDT.e-USDt_C'].apy = apys['USDT.e_USDt'].apy * 100;
        concentratedLpAssets['SHLB_BTC.b-AVAX_B'].apy = 0;
        concentratedLpAssets['SHLB_EUROC-USDC_V2_1_B'].apy = apys['EUROC_USDC'].apy * 100;
      } catch (e) {
        console.log(e);
      }

      commit('setConcentratedLpAssets', concentratedLpAssets);

      let traderJoeV2LpAssets = state.traderJoeV2LpAssets;

      if (Object.keys(traderJoeV2LpAssets).length !== 0) {
        for (let [symbol, traderJoeV2LpAsset] of Object.entries(traderJoeV2LpAssets)) {
          // we don't use getApy method anymore, but fetch APYs from db
          if (apys[symbol] && apys[symbol].lp_apy) {
            traderJoeV2LpAssets[symbol].apy = apys[symbol].lp_apy * 100;
          }

          if (traderJoeV2LpAssets['TJLB_MAGIC_ETH']) {
            traderJoeV2LpAssets['TJLB_MAGIC_ETH'].apy = 114.81;
          }

          if (traderJoeV2LpAssets[symbol].hardcodeApy) {
            traderJoeV2LpAssets[symbol].apy = traderJoeV2LpAssets[symbol].hardcodeApy;
          }

          console.log(symbol, 'APY: ', traderJoeV2LpAssets[symbol].apy);
        }
      }
      commit('setTraderJoeV2LpAssets', traderJoeV2LpAssets);

      let balancerLpAssets = state.balancerLpAssets;

      if (balancerLpAssets) {
        if (Object.keys(balancerLpAssets).length !== 0) {
          for (let [symbol, asset] of Object.entries(balancerLpAssets)) {
            // we don't use getApy method anymore, but fetch APYs from db
            if (apys[symbol] && apys[symbol].lp_apy) {
              //TODO: correct in AWS
              let appreciation = (apys[asset.primary] && apys[asset.primary].apy) || (apys[asset.secondary] && apys[asset.secondary].apy);

              balancerLpAssets[symbol].apy = (apys[symbol].lp_apy - appreciation / 2 / 100) * 100;
            }
          }
        }

        commit('setBalancerLpAssets', balancerLpAssets);
      }

      let levelLpAssets = state.levelLpAssets;

      if (levelLpAssets) {
        if (Object.keys(levelLpAssets).length !== 0) {
          for (let [symbol, asset] of Object.entries(levelLpAssets)) {
            // we don't use getApy method anymore, but fetch APYs from db
            if (apys[symbol] && apys[symbol][symbol]) {
              levelLpAssets[symbol].apy = apys[symbol][symbol];
            }
          }
        }

        commit('setLevelLpAssets', levelLpAssets);
      }

      let gmxV2Assets = state.gmxV2Assets;

      if (gmxV2Assets) {
        if (Object.keys(gmxV2Assets).length !== 0) {
          for (let [symbol, asset] of Object.entries(gmxV2Assets)) {
            if (apys[symbol] && apys[symbol].lp_apy) {
              gmxV2Assets[symbol].apy = apys[symbol].lp_apy * 100;
            }

            if (gmxV2Assets[symbol].hardcodeApy) {
              gmxV2Assets[symbol].apy = gmxV2Assets[symbol].hardcodeApy;
            }
          }
        }

        commit('setGmxV2Assets', gmxV2Assets);
      }

      dataRefreshNotificationService.emitAssetApysDataRefresh();
    },

    async getDebtsPerAsset({state, commit, rootState}) {
      const dataRefreshNotificationService = rootState.serviceRegistry.dataRefreshEventService;
      const debtsPerAsset = {};
      const debts = await state.readSmartLoanContract.getDebts();
      debts.forEach(debt => {
        const asset = fromBytes32(debt.name);
        if (config.ASSETS_CONFIG[asset]) {
          const debtValue = formatUnits(debt.debt, config.ASSETS_CONFIG[asset].decimals);
          debtsPerAsset[asset] = {asset: asset, debt: debtValue};
        }
      });
      await commit('setDebtsPerAsset', debtsPerAsset);
      dataRefreshNotificationService.emitDebtsPerAssetDataRefreshEvent(debtsPerAsset);
      rootState.serviceRegistry.healthService.emitRefreshHealth();
    },

    async getFullLoanStatus({state, rootState, commit}) {
      let result;

      try {
        result = await state.multicallContract.callStatic.aggregate(
          [
            {
              target: state.smartLoanContract.address,
              callData: state.readSmartLoanContract.interface.encodeFunctionData('getAllOwnedAssets')
            },
            {
              target: state.smartLoanContract.address,
              callData: state.readSmartLoanContract.interface.encodeFunctionData('getStakedPositions')
            }
          ]
        );
      } catch (e) {
        console.log('error')
        console.log(e)
      }

      let owned = decodeOutput(SMART_LOAN.abi, 'getAllOwnedAssets', result.returnData[0])[0];
      let staked = decodeOutput(SMART_LOAN.abi, 'getStakedPositions', result.returnData[1])[0];

      const loanAssets = mergeArrays([
        owned.map(el => fromBytes32(el)),
        staked.map(el => {
          return fromBytes32(el[1])
        }),
        Object.keys(config.POOLS_CONFIG)
      ]);

      const fullLoanStatusResponse = await (await wrapContract(state.readSmartLoanContract, loanAssets)).getFullLoanStatus();

      const fullLoanStatus = {
        totalValue: fromWei(fullLoanStatusResponse[0]),
        debt: fromWei(fullLoanStatusResponse[1]),
        thresholdWeightedValue: fromWei(fullLoanStatusResponse[2]),
        health: fromWei(fullLoanStatusResponse[3]),
      };

      const collateral = fullLoanStatus.totalValue - fullLoanStatus.debt;

      commit('setFullLoanStatus', fullLoanStatus);
      rootState.serviceRegistry.dataRefreshEventService.emitFullLoanStatusRefresh();
      rootState.serviceRegistry.collateralService.emitCollateral(collateral);
      rootState.serviceRegistry.debtService.emitDebt(fullLoanStatus.debt);
    },

    async getAccountApr({state, getters, rootState, commit}, {eligibleTvl, maxBoostApy}) {
      let apr = 0;
      let yearlyDebtInterest = 0;

      if (rootState.poolStore.pools && state.debtsPerAsset) {
        Object.entries(state.debtsPerAsset).forEach(
          ([symbol, debt]) => {
            const pool = rootState.poolStore.pools.find(pool => pool.asset.symbol === symbol);
            if (pool) {
              yearlyDebtInterest += parseFloat(debt.debt) * pool.borrowingAPY * state.assets[symbol].price;
            }
          }
        );

        let yearlyAssetInterest = 0;

        if (state.assets && state.assetBalances) {
          for (let entry of Object.entries(state.assets)) {
            let symbol = entry[0];
            let asset = entry[1];

            //TODO: take from API
            const apy = asset.apy ? asset.apy / 100 : 0;
            if (state.assetBalances[symbol]) {
              yearlyAssetInterest += parseFloat(state.assetBalances[symbol]) * apy * (asset.price ? asset.price : 0);
            }
          }
        }

        let yearlyLpInterest = 0;

        if (state.lpAssets && state.lpBalances) {
          for (let entry of Object.entries(state.lpAssets)) {
            let symbol = entry[0];
            let lpAsset = entry[1];
            if (lpAsset.inactive) break;

            let assetAppreciation = 0;
            //TODO: take from API
            if (state.assets[lpAsset.primary].apy || state.assets[lpAsset.secondary].apy) {
              if (state.assets[lpAsset.primary].apy) assetAppreciation += state.assets[lpAsset.primary].apy / 100 / 2;
              if (state.assets[lpAsset.secondary].apy) assetAppreciation += state.assets[lpAsset.secondary].apy / 100 / 2;
            }
            const apy = lpAsset.apy ? lpAsset.apy / 100 : 0;

            yearlyLpInterest += parseFloat(state.lpBalances[symbol]) * ((1 + apy) * (1 + assetAppreciation) - 1) * lpAsset.price;
          }
        }

        if (state.concentratedLpAssets && state.concentratedLpBalances) {
          for (let entry of Object.entries(state.concentratedLpAssets)) {
            let symbol = entry[0];
            let lpAsset = entry[1];
            if (lpAsset.inactive) break;

            const apy = lpAsset.apy ? lpAsset.apy / 100 : 0;

            yearlyLpInterest += parseFloat(state.concentratedLpBalances[symbol]) * apy * lpAsset.price;
          }
        }

        if (state.balancerLpAssets && state.balancerLpBalances) {
          for (let entry of Object.entries(state.balancerLpAssets)) {
            let symbol = entry[0];
            let lpAsset = entry[1];
            if (lpAsset.inactive) break;

            const apy = lpAsset.apy ? lpAsset.apy / 100 : 0;

            let assetAppreciation = 0;

            yearlyLpInterest += parseFloat(state.balancerLpBalances[symbol]) * ((1 + apy) * (1 + assetAppreciation) - 1) * lpAsset.price;
          }
        }

        if (state.levelLpAssets && state.levelLpBalances) {
          for (let entry of Object.entries(state.levelLpAssets)) {
            let symbol = entry[0];
            let lpAsset = entry[1];
            if (lpAsset.inactive) break;

            const apy = lpAsset.apy ? lpAsset.apy / 100 : 0;

            yearlyLpInterest += parseFloat(state.levelLpBalances[symbol]) * apy * lpAsset.price;
          }
        }

        if (state.penpieLpAssets && state.penpieLpBalances) {
          for (let entry of Object.entries(state.penpieLpAssets)) {
            let symbol = entry[0];
            let lpAsset = entry[1];

            const apy = state.apys[symbol] ? state.apys[symbol].lp_apy : 0;

            yearlyLpInterest += parseFloat(state.penpieLpBalances[symbol]) * apy * lpAsset.price;
          }
        }

        if (state.wombatLpAssets && state.wombatLpBalances) {
          for (let entry of Object.entries(state.wombatLpAssets)) {
            let symbol = entry[0];
            let lpAsset = entry[1];
            let lpSymbol = lpAsset.apyKey;

            const apy = state.apys[lpSymbol] ? state.apys[lpSymbol].lp_apy + (lpAsset.addTokenApy ? state.apys[lpAsset.asset].apy / 100 : 0) : 0;
            yearlyLpInterest += parseFloat(state.wombatLpBalances[symbol]) * apy * lpAsset.price;
          }
        }

        if (state.gmxV2Assets && state.gmxV2Balances) {
          for (let entry of Object.entries(state.gmxV2Assets)) {
            let symbol = entry[0];
            let lpAsset = entry[1];
            if (lpAsset.inactive) break;

            const apy = lpAsset.apy ? lpAsset.apy / 100 : 0;

            yearlyLpInterest += parseFloat(state.gmxV2Balances[symbol]) * apy * lpAsset.price;
          }
        }

        let yearlyTraderJoeV2Interest = 0;

        if (state.traderJoeV2LpAssets) {
          for (let entry of Object.entries(state.traderJoeV2LpAssets)) {
            let symbol = entry[0];
            let lpAsset = entry[1];
            if (lpAsset.inactive) break;

            const apy = lpAsset.apy ? lpAsset.apy / 100 : 0;
            const userValueInPool =
              state.assets[lpAsset.primary].price * lpAsset.primaryBalance
              + state.assets[lpAsset.secondary].price * lpAsset.secondaryBalance;

            yearlyTraderJoeV2Interest += userValueInPool * apy;
          }
        }

        let yearlyWombatYYFarmsInterest = 0;

        if (state.wombatLpAssets && state.wombatYYFarmsBalances) {
          for (let farm of config.WOMBAT_YY_FARMS) {
            const apy = farm.apy ? farm.apy / 100 : 0;
            const userValueInPool =
              state.wombatLpAssets[farm.lpAssetToken].price * state.wombatYYFarmsBalances[farm.apyKey];

            yearlyWombatYYFarmsInterest += userValueInPool * apy;
          }
        }

        let yearlyFarmInterest = 0;

        if (rootState.stakeStore.farms) {
          for (let entry of Object.entries(rootState.stakeStore.farms)) {
            let symbol = entry[0];
            let farms = entry[1];

            for (let farm of farms) {
              if (farm.inactive) break;
              let assetAppretiation = 1;

              if (symbol.includes('sAVAX')) assetAppretiation = 1.036;
              if (symbol === 'sAVAX') assetAppretiation = 1.072;

              let farmApy = 0;

              farmApy = farm.currentApy ? farm.currentApy : 0;

              let asset = rootState.fundsStore.assets[symbol] ? rootState.fundsStore.assets[symbol] : rootState.fundsStore.lpAssets[symbol];
              let assetApy = (asset.apy && symbol !== 'GLP') ? asset.apy / 100 : 0;

              const cumulativeApy = farm.isTokenLp ? (((1 + assetApy + farmApy) * assetAppretiation) - 1) : (1 + assetApy) * (1 + farmApy) - 1;
              yearlyFarmInterest += parseFloat(farm.totalBalance) * cumulativeApy * farm.price;
            }
          }
        }

        const collateral = getters.getCollateral;

        let yearlyGrantInterest = 0;

        if (eligibleTvl) {
          yearlyGrantInterest += eligibleTvl * maxBoostApy / 4.5;
        }

        if (window.chain === 'avalanche') {

          fetch(config.ASSETS_CONFIG['GGP'].priceEndpoint).then(async resp => {
            let json = await resp.json();
            const ggpPrice = json[config.ASSETS_CONFIG['GGP'].priceJsonField];

            yearlyGrantInterest += Math.max(Number(state.wombatLpBalances['WOMBAT_ggAVAX_AVAX_LP_ggAVAX']) * state.wombatLpAssets['WOMBAT_ggAVAX_AVAX_LP_ggAVAX'].price - collateral, 0) * rootState.serviceRegistry.ggpIncentivesService.boostGGPApy$.value.boostApy * ggpPrice
          })
        }

        if (collateral) {
          apr = (
            yearlyAssetInterest
            + yearlyLpInterest
            + yearlyFarmInterest
            + yearlyTraderJoeV2Interest
            + yearlyWombatYYFarmsInterest
            + yearlyGrantInterest
            - yearlyDebtInterest
          ) / collateral;
        }

        commit('setAccountApr', apr);

        rootState.serviceRegistry.aprService.emitRefreshApr();
      }
    },

    async swapToWavax({state, rootState}) {
      const provider = rootState.network.provider;
      await state.wrappedTokenContract.connect(provider.getSigner()).deposit({value: toWei('1000')});
    },

    async fund({state, rootState, commit, dispatch}, {fundRequest}) {
      console.log(fundRequest);
      const provider = rootState.network.provider;
      const amountInWei = parseUnits(fundRequest.value.toString(), fundRequest.assetDecimals);

      const tokenForApprove = (fundRequest.asset === 'GLP' && config.chainId === 43114) ? '0xaE64d55a6f09E4263421737397D1fdFA71896a69' : TOKEN_ADDRESSES[fundRequest.asset];
      const fundToken = new ethers.Contract(tokenForApprove, erc20ABI, provider.getSigner());

      const allowance = formatUnits(await fundToken.allowance(rootState.network.account, state.smartLoanContract.address), fundRequest.assetDecimals);

      if (parseFloat(allowance) < parseFloat(fundRequest.value)) {
        const approveTransaction = await fundToken.connect(provider.getSigner()).approve(state.smartLoanContract.address, amountInWei);
        await awaitConfirmation(approveTransaction, provider, 'approve');
      }

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [fundRequest.asset]
      ]);

      // Note - temporary code to remove 'ARBI' from data feed request to Redstone
      if (window.chain === 'arbitrum') {
        const arbiTokenIndex = loanAssets.indexOf('ARBI');
        loanAssets.splice(arbiTokenIndex, 1);
      }

      const isGlp = fundRequest.asset === 'GLP';
      const isLevel = ['arbJnrLLP', 'arbMzeLLP', 'arbSnrLLP'].includes(fundRequest.asset);

      const transaction =
        isGlp ?
          await (await wrapContract(state.smartLoanContract, loanAssets)).fundGLP(
            amountInWei)
          :
          isLevel ?
            await (await wrapContract(state.smartLoanContract, loanAssets)).depositLLPAndStake(fundRequest.pid, amountInWei)
            :
            await (await wrapContract(state.smartLoanContract, loanAssets)).fund(
              toBytes32(fundRequest.asset),
              amountInWei);


      if (!fundRequest.keepModalOpen) {
        rootState.serviceRegistry.progressBarService.requestProgressBar();
        rootState.serviceRegistry.modalService.closeModal();
      }

      let tx = await awaitConfirmation(transaction, provider, 'fund');

      const depositAmount = formatUnits(getLog(tx, SMART_LOAN.abi, isLevel ? 'DepositedLLP' : 'Funded').args[isLevel ? 'depositAmount' : 'amount'], fundRequest.assetDecimals);

      let price;
      switch (fundRequest.type) {
        case 'ASSET':
          price = state.assets[fundRequest.asset].price;
          break;
        case 'LP':
          price = state.lpAssets[fundRequest.asset].price;
          break;
        case 'CONCENTRATED_LP':
          price = state.concentratedLpAssets[fundRequest.asset].price;
          break;
        case 'LEVEL_LLP':
          price = state.levelLpAssets[fundRequest.asset].price;
          break;
        case 'PENPIE_LP':
          price = state.penpieLpAssets[fundRequest.asset].price;
          break;
        case 'WOMBAT_LP':
          price = state.wombatLpAssets[fundRequest.asset].price;
          break;
        case 'GMX_V2':
          price = state.gmxV2Assets[fundRequest.asset].price;
          break;
      }

      const depositAmountUSD = Number(depositAmount) * price;
      const totalCollateralAfterTransaction = state.fullLoanStatus.totalValue - state.fullLoanStatus.debt + depositAmountUSD;
      let assetBalanceBeforeDeposit;
      switch (fundRequest.type) {
        case 'ASSET':
          assetBalanceBeforeDeposit = state.assetBalances[fundRequest.asset];
          break;
        case 'LP':
          assetBalanceBeforeDeposit = state.lpBalances[fundRequest.asset];
          break;
        case 'CONCENTRATED_LP':
          assetBalanceBeforeDeposit = state.concentratedLpBalances[fundRequest.asset];
          break;
        case 'LEVEL_LLP':
          assetBalanceBeforeDeposit = state.levelLpBalances[fundRequest.asset];
          break;
        case 'PENPIE_LP':
          assetBalanceBeforeDeposit = state.penpieLpBalances[fundRequest.asset];
          break;
        case 'WOMBAT_LP':
          assetBalanceBeforeDeposit = state.wombatLpBalances[fundRequest.asset];
          break;
        case 'GMX_V2':
          assetBalanceBeforeDeposit = state.gmxV2Balances[fundRequest.asset];
          break;
      }
      const assetBalanceAfterDeposit = Number(assetBalanceBeforeDeposit) + Number(depositAmount);

      if (fundRequest.type == 'ASSET') {
        await commit('setSingleAssetBalance', {asset: fundRequest.asset, balance: assetBalanceAfterDeposit});
        commit('setSingleAssetCurrentExposure', {asset: fundRequest.asset, exposureChange: Number(depositAmount)});
      }

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(fundRequest.asset, assetBalanceAfterDeposit, Boolean(fundRequest.isLP), true);
      rootState.serviceRegistry.collateralService.emitCollateral(totalCollateralAfterTransaction);


      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('network/updateBalance', {}, {root: true});
      }, 1000);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async fundNativeToken({state, rootState, commit, dispatch}, {value}) {
      const provider = rootState.network.provider;
      const nativeAssetOptions = config.NATIVE_ASSET_TOGGLE_OPTIONS;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [config.nativeToken]
      ]);

      // Note - temporary code to remove 'ARBI' from data feed request to Redstone
      if (window.chain === 'arbitrum') {
        const arbiTokenIndex = loanAssets.indexOf('ARBI');
        loanAssets.splice(arbiTokenIndex, 1);
      }

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets)).depositNativeToken({
        value: toWei(String(value)),
      });

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();
      let tx = await awaitConfirmation(transaction, provider, 'fund');
      const depositAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'DepositNative').args.amount, config.ASSETS_CONFIG[nativeAssetOptions[0]].decimals);
      const depositAmountUSD = Number(depositAmount) * state.assets[nativeAssetOptions[0]].price;
      const collateralAfterTransaction = state.fullLoanStatus.totalValue - state.fullLoanStatus.debt + depositAmountUSD;
      const assetBalanceAfterDeposit = Number(state.assetBalances[nativeAssetOptions[0]]) + Number(depositAmount);

      await commit('setSingleAssetBalance', {asset: nativeAssetOptions[0], balance: assetBalanceAfterDeposit});
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(nativeAssetOptions[0], assetBalanceAfterDeposit, false, true);
      rootState.serviceRegistry.collateralService.emitCollateral(collateralAfterTransaction);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('network/updateBalance', {}, {root: true});
      }, 1000);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async withdraw({state, rootState, commit, dispatch}, {withdrawRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([
        (await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG)
      ]);

      if (window.chain === 'arbitrum') {
        // Note - temporary code to remove 'ARBI' from data feed request to Redstone
        const arbiTokenIndex = loanAssets.indexOf('ARBI');
        loanAssets.splice(arbiTokenIndex, 1);
      }

      const isGlp = withdrawRequest.asset === 'GLP';
      const isLevel = ['arbJnrLLP', 'arbMzeLLP', 'arbSnrLLP'].includes(withdrawRequest.asset);

      const amountInWei = parseUnits(parseFloat(withdrawRequest.value).toFixed(withdrawRequest.assetDecimals), withdrawRequest.assetDecimals);

      console.log(withdrawRequest)
      const transaction =
        withdrawRequest.assetInactive ?
          await (await wrapContract(state.smartLoanContract, loanAssets)).withdrawUnsupportedToken(withdrawRequest.assetAddress)
          :
          isGlp ?
            await (await wrapContract(state.smartLoanContract, loanAssets)).withdrawGLP(
              parseUnits(String(withdrawRequest.value)))
            :
            isLevel ?
              await (await wrapContract(state.smartLoanContract, loanAssets)).unstakeAndWithdrawLLP(withdrawRequest.pid, amountInWei)
              :
              await (await wrapContract(state.smartLoanContract, loanAssets)).withdraw(
                toBytes32(withdrawRequest.asset),
                amountInWei);

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'withdraw');


      const withdrawAmount = formatUnits(getLog(tx, SMART_LOAN.abi, (withdrawRequest.assetInactive || withdrawRequest.assetInactive) ? 'WithdrawUnsupportedToken' : isLevel ? 'WithdrewLLP' : 'Withdrawn').args[isLevel ? 'depositAmount' : 'amount'], withdrawRequest.assetDecimals);

      let price;
      switch (withdrawRequest.type) {
        case 'ASSET':
          price = state.assets[withdrawRequest.asset].price;
          break;
        case 'LP':
          price = state.lpAssets[withdrawRequest.asset].price;
          break;
        case 'CONCENTRATED_LP':
          price = state.concentratedLpAssets[withdrawRequest.asset].price;
          break;
        case 'LEVEL_LLP':
          price = state.levelLpAssets[withdrawRequest.asset].price;
          break;
        case 'PENPIE_LP':
          price = state.penpieLpAssets[withdrawRequest.asset].price;
          break;
        case 'GMX_V2':
          price = state.gmxV2Assets[withdrawRequest.asset].price;
          break;
      }
      const withdrawAmountUSD = Number(withdrawAmount) * price;

      let assetBalanceBeforeWithdraw;
      switch (withdrawRequest.type) {
        case 'ASSET':
          assetBalanceBeforeWithdraw = state.assetBalances[withdrawRequest.asset];
          break;
        case 'LP':
          assetBalanceBeforeWithdraw = state.lpBalances[withdrawRequest.asset];
          break;
        case 'CONCENTRATED_LP':
          assetBalanceBeforeWithdraw = state.concentratedLpBalances[withdrawRequest.asset];
          break;
        case 'LEVEL_LLP':
          assetBalanceBeforeWithdraw = state.levelLpBalances[withdrawRequest.asset];
          break;
        case 'PENPIE_LP':
          assetBalanceBeforeWithdraw = state.penpieLpBalances[withdrawRequest.asset].price;
          break;
        case 'GMX_V2':
          assetBalanceBeforeWithdraw = state.gmxV2Balances[withdrawRequest.asset];
          break;
      }
      const assetBalanceAfterWithdraw = Number(assetBalanceBeforeWithdraw) - Number(withdrawAmount);
      const totalCollateralAfterTransaction = state.fullLoanStatus.totalValue - state.fullLoanStatus.debt - withdrawAmountUSD;


      if (withdrawRequest.type == 'ASSET') {
        await commit('setSingleAssetBalance', {asset: withdrawRequest.asset, balance: assetBalanceAfterWithdraw});
        commit('setSingleAssetCurrentExposure', {
          asset: withdrawRequest.asset,
          exposureChange: -Number(withdrawAmount)
        });
      }

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(withdrawRequest.asset, assetBalanceAfterWithdraw, withdrawRequest.isLP, true);
      rootState.serviceRegistry.collateralService.emitCollateral(totalCollateralAfterTransaction);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async unstakeAndExportPendleLp({state, rootState, commit, dispatch}, {unstakeRequest}) {
      const provider = rootState.network.provider;
      const amountInWei = parseUnits(parseFloat(unstakeRequest.value).toFixed(unstakeRequest.assetDecimals), unstakeRequest.assetDecimals);

      const loanAssets = mergeArrays([
        (await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [unstakeRequest.targetAsset, unstakeRequest.sourceAsset],
      ]);

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets)).unstakeFromPenpieAndWithdrawPendleLP(
        unstakeRequest.market,
        amountInWei);

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'withdraw');

      const price = state.penpieLpAssets[unstakeRequest.asset].price;
      const withdrawAmountUSD = fromWei(amountInWei) * price;
      const assetBalanceBeforeWithdraw = state.penpieLpBalances[unstakeRequest.asset].price;

      const assetBalanceAfterWithdraw = Number(assetBalanceBeforeWithdraw) - Number(unstakeRequest.value);
      const totalCollateralAfterTransaction = state.fullLoanStatus.totalValue - state.fullLoanStatus.debt - withdrawAmountUSD;

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(unstakeRequest.asset, assetBalanceAfterWithdraw, false, true);
      rootState.serviceRegistry.collateralService.emitCollateral(totalCollateralAfterTransaction);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async claimPenpieRewards({state, rootState, commit, dispatch}, {market}) {
      const loanAssets = mergeArrays([
        (await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
      ]);

      await (await wrapContract(state.smartLoanContract, loanAssets))
        .claimRewards(
          market
        )

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      // let tx = await awaitConfirmation(transaction, provider, 'claimRewards');

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async claimWombatRewards({state, rootState, commit, dispatch}) {
      const loanAssets = mergeArrays([
        (await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
      ]);

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets))
        .claimAllWombatRewards()

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'Claim wombat rewards');

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async withdrawNativeToken({state, rootState, commit, dispatch}, {withdrawRequest}) {
      const provider = rootState.network.provider;
      const nativeAssetOptions = config.NATIVE_ASSET_TOGGLE_OPTIONS;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG)
      ]);

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets))
        .unwrapAndWithdraw(parseUnits(String(withdrawRequest.value), withdrawRequest.assetDecimals));

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'withdraw');
      const withdrawAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'UnwrapAndWithdraw').args.amount, config.ASSETS_CONFIG[nativeAssetOptions[0]].decimals);
      const withdrawAmountUSD = Number(withdrawAmount) * state.assets[nativeAssetOptions[0]].price;

      const assetBalanceAfterWithdraw = Number(state.assetBalances[nativeAssetOptions[0]]) - Number(withdrawAmount);
      const totalCollateralAfterTransaction = state.fullLoanStatus.totalValue - state.fullLoanStatus.debt - withdrawAmountUSD;

      await commit('setSingleAssetBalance', {asset: nativeAssetOptions[0], balance: assetBalanceAfterWithdraw});
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(nativeAssetOptions[0], assetBalanceAfterWithdraw, false, true);
      rootState.serviceRegistry.collateralService.emitCollateral(totalCollateralAfterTransaction);


      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async provideLiquidity({state, rootState, commit, dispatch}, {provideLiquidityRequest}) {
      const provider = rootState.network.provider;

      const firstDecimals = config.ASSETS_CONFIG[provideLiquidityRequest.firstAsset].decimals;
      const secondDecimals = config.ASSETS_CONFIG[provideLiquidityRequest.secondAsset].decimals;
      const lpTokenDecimals = config.LP_ASSETS_CONFIG[provideLiquidityRequest.symbol].decimals;

      let minAmount = 0.99;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [provideLiquidityRequest.symbol]
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);

      const transaction = await wrappedContract[config.DEX_CONFIG[provideLiquidityRequest.dex].addLiquidityMethod](
        toBytes32(provideLiquidityRequest.firstAsset),
        toBytes32(provideLiquidityRequest.secondAsset),
        parseUnits(parseFloat(provideLiquidityRequest.firstAmount).toFixed(firstDecimals), BigNumber.from(firstDecimals.toString())),
        parseUnits(parseFloat(provideLiquidityRequest.secondAmount).toFixed(secondDecimals), BigNumber.from(secondDecimals.toString())),
        parseUnits((minAmount * parseFloat(provideLiquidityRequest.firstAmount)).toFixed(firstDecimals), BigNumber.from(firstDecimals.toString())),
        parseUnits((minAmount * parseFloat(provideLiquidityRequest.secondAmount)).toFixed(secondDecimals), BigNumber.from(secondDecimals.toString()))
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'create LP token');

      const firstAssetAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'AddLiquidity').args.firstAmount, firstDecimals); // how much of tokenA was used
      const secondAssetAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'AddLiquidity').args.secondAmount, secondDecimals); //how much of tokenB was used
      const lpTokenCreated = formatUnits(getLog(tx, SMART_LOAN.abi, 'AddLiquidity').args.liquidity, lpTokenDecimals); //how much LP was created
      const firstAssetBalanceAfterTransaction = Number(state.assetBalances[provideLiquidityRequest.firstAsset]) - Number(firstAssetAmount);
      const secondAssetBalanceAfterTransaction = Number(state.assetBalances[provideLiquidityRequest.secondAsset]) - Number(secondAssetAmount);
      const lpTokenBalanceAfterTransaction = Number(state.lpBalances[provideLiquidityRequest.symbol]) + Number(lpTokenCreated);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(provideLiquidityRequest.firstAsset, firstAssetBalanceAfterTransaction, false, true);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(provideLiquidityRequest.secondAsset, secondAssetBalanceAfterTransaction, false, true);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(provideLiquidityRequest.symbol, lpTokenBalanceAfterTransaction, true, true);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async removeLiquidity({state, rootState, commit, dispatch}, {removeLiquidityRequest}) {

      const provider = rootState.network.provider;

      const firstDecimals = config.ASSETS_CONFIG[removeLiquidityRequest.firstAsset].decimals;
      const secondDecimals = config.ASSETS_CONFIG[removeLiquidityRequest.secondAsset].decimals;
      const lpTokenDecimals = config.LP_ASSETS_CONFIG[removeLiquidityRequest.symbol].decimals;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [removeLiquidityRequest.firstAsset, removeLiquidityRequest.secondAsset]
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);

      const lpContract = new ethers.Contract(config.LP_ASSETS_CONFIG[removeLiquidityRequest.symbol].address, erc20ABI, provider.getSigner());
      const lpBalance = await lpContract.balanceOf(state.smartLoanContract.address);

      let amountWei = toWei(removeLiquidityRequest.value);
      amountWei = amountWei.gt(lpBalance) ? lpBalance : amountWei;

      const transaction = await wrappedContract[config.DEX_CONFIG[removeLiquidityRequest.dex].removeLiquidityMethod](
        toBytes32(removeLiquidityRequest.firstAsset),
        toBytes32(removeLiquidityRequest.secondAsset),
        amountWei,
        parseUnits((removeLiquidityRequest.minFirstAmount), BigNumber.from(firstDecimals.toString())),
        parseUnits((removeLiquidityRequest.minSecondAmount), BigNumber.from(secondDecimals.toString()))
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'unwind LP token');

      const firstAssetAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'RemoveLiquidity').args.firstAmount, firstDecimals); // how much of tokenA was received
      const secondAssetAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'RemoveLiquidity').args.secondAmount, secondDecimals); //how much of tokenB was received
      const lpTokenRemoved = formatUnits(getLog(tx, SMART_LOAN.abi, 'RemoveLiquidity').args.liquidity, lpTokenDecimals); //how much LP was removed
      const firstAssetBalanceAfterTransaction = Number(state.assetBalances[removeLiquidityRequest.firstAsset]) + Number(firstAssetAmount);
      const secondAssetBalanceAfterTransaction = Number(state.assetBalances[removeLiquidityRequest.secondAsset]) + Number(secondAssetAmount);
      const lpTokenBalanceAfterTransaction = Number(state.lpBalances[removeLiquidityRequest.symbol]) - Number(lpTokenRemoved);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(removeLiquidityRequest.firstAsset, firstAssetBalanceAfterTransaction, false, true);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(removeLiquidityRequest.secondAsset, secondAssetBalanceAfterTransaction, false, true);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(removeLiquidityRequest.symbol, lpTokenBalanceAfterTransaction, true, true);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async provideLiquidityAndStakeBalancerV2({state, rootState, commit, dispatch}, {provideLiquidityRequest}) {

      const provider = rootState.network.provider;

      const firstDecimals = config.ASSETS_CONFIG[provideLiquidityRequest.firstAsset].decimals;
      const secondDecimals = config.ASSETS_CONFIG[provideLiquidityRequest.secondAsset].decimals;
      const lpTokenDecimals = config.BALANCER_LP_ASSETS_CONFIG[provideLiquidityRequest.symbol].decimals;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [provideLiquidityRequest.symbol]
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);

      let txData;

      const firstTokenContract = new ethers.Contract(TOKEN_ADDRESSES[provideLiquidityRequest.firstAsset], erc20ABI, provider.getSigner());
      const secondTokenContract = new ethers.Contract(TOKEN_ADDRESSES[provideLiquidityRequest.secondAsset], erc20ABI, provider.getSigner());

      let firstAmountWei = parseUnits(parseFloat(provideLiquidityRequest.firstAmount).toFixed(firstDecimals), BigNumber.from(firstDecimals.toString()));
      let secondAmountWei = parseUnits(parseFloat(provideLiquidityRequest.secondAmount).toFixed(secondDecimals), BigNumber.from(secondDecimals.toString()));
      let firstBalance = await firstTokenContract.balanceOf(state.smartLoanContract.address);
      let secondBalance = await secondTokenContract.balanceOf(state.smartLoanContract.address);

      firstAmountWei = firstAmountWei.gt(firstBalance) ? firstBalance : firstAmountWei;
      secondAmountWei = secondAmountWei.gt(secondBalance) ? secondBalance : secondAmountWei;

      let minAmount = 0.99;
      let gaugeDecimals = config.BALANCER_LP_ASSETS_CONFIG[provideLiquidityRequest.symbol].decimals;
      let minGaugeAmountWei = parseUnits((parseFloat(provideLiquidityRequest.addedLiquidity) * minAmount).toFixed(gaugeDecimals), gaugeDecimals);

      if (config.BALANCER_LP_ASSETS_CONFIG[provideLiquidityRequest.symbol].firstOfTokensIsPool) {
        txData = [
          provideLiquidityRequest.poolId,
          [
            config.BALANCER_LP_ASSETS_CONFIG[provideLiquidityRequest.symbol].address,
            config.ASSETS_CONFIG[provideLiquidityRequest.firstAsset].address,
            config.ASSETS_CONFIG[provideLiquidityRequest.secondAsset].address
          ],
          [
            0,
            firstAmountWei,
            secondAmountWei
          ],
          minGaugeAmountWei
        ];
      } else {
        txData = [
          provideLiquidityRequest.poolId,
          [
            config.ASSETS_CONFIG[provideLiquidityRequest.firstAsset].address,
            config.ASSETS_CONFIG[provideLiquidityRequest.secondAsset].address
          ],
          [
            firstAmountWei,
            secondAmountWei
          ],
          minGaugeAmountWei
        ];
      }

      const transaction = await wrappedContract.joinPoolAndStakeBalancerV2(txData);

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'create LP token');

      const firstAssetAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'StakeBalancerV2').args.depositTokenAmounts[0], firstDecimals); // how much of tokenA was used
      const secondAssetAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'StakeBalancerV2').args.depositTokenAmounts[1], secondDecimals); //how much of tokenB was used
      const lpTokenCreated = formatUnits(getLog(tx, SMART_LOAN.abi, 'StakeBalancerV2').args.receiptTokenAmount, lpTokenDecimals); //how much LP was created

      const firstAssetBalanceAfterTransaction = Number(state.assetBalances[provideLiquidityRequest.firstAsset]) - Number(firstAssetAmount);
      const secondAssetBalanceAfterTransaction = Number(state.assetBalances[provideLiquidityRequest.secondAsset]) - Number(secondAssetAmount);
      const lpTokenBalanceAfterTransaction = Number(state.balancerLpBalances[provideLiquidityRequest.symbol]) + Number(lpTokenCreated);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(provideLiquidityRequest.firstAsset, firstAssetBalanceAfterTransaction, false, true);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(provideLiquidityRequest.secondAsset, secondAssetBalanceAfterTransaction, false, true);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(provideLiquidityRequest.symbol, lpTokenBalanceAfterTransaction, true, true);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async unstakeAndRemoveLiquidityBalancerV2({state, rootState, commit, dispatch}, {removeLiquidityRequest}) {
      console.log(removeLiquidityRequest);

      const targetAssetDecimals = config.ASSETS_CONFIG[removeLiquidityRequest.targetAsset].decimals;
      const lpTokenDecimals = config.BALANCER_LP_ASSETS_CONFIG[removeLiquidityRequest.symbol].decimals;

      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [removeLiquidityRequest.firstAsset, removeLiquidityRequest.secondAsset]
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);

      const gaugeContract = new ethers.Contract(config.BALANCER_LP_ASSETS_CONFIG[removeLiquidityRequest.symbol].gaugeAddress, erc20ABI, provider.getSigner());
      const gaugeBalance = await gaugeContract.balanceOf(state.smartLoanContract.address);

      let amountWei = toWei(removeLiquidityRequest.amount);
      amountWei = amountWei.gt(gaugeBalance) ? gaugeBalance : amountWei;

      let minTargetReceived = removeLiquidityRequest.isFirstUnstaked ? removeLiquidityRequest.minReceivedFirst : removeLiquidityRequest.minReceivedSecond;
      //TODO: now the logic is simplified so we always unstake to the first asset
      let minReceivedWei = parseUnits((parseFloat(minTargetReceived)).toFixed(targetAssetDecimals), targetAssetDecimals);

      const transaction = await wrappedContract.unstakeAndExitPoolBalancerV2(
        [
          removeLiquidityRequest.poolId,
          config.ASSETS_CONFIG[removeLiquidityRequest.targetAsset].address,
          //TODO: slippage
          minReceivedWei,
          amountWei
        ]
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'unwind LP token');

      const targetAssetAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'UnstakeBalancerV2').args.depositTokenAmounts[0], targetAssetDecimals); // how much of tokenA was used
      const lpTokenUnwound = formatUnits(getLog(tx, SMART_LOAN.abi, 'UnstakeBalancerV2').args.receiptTokenAmount, lpTokenDecimals); //how much LP was created

      const targetAssetBalanceAfterTransaction = Number(state.assetBalances[removeLiquidityRequest.targetAsset]) + Number(targetAssetAmount);
      const lpTokenBalanceAfterTransaction = Number(state.balancerLpBalances[removeLiquidityRequest.symbol]) - Number(lpTokenUnwound);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(removeLiquidityRequest.targetAsset, targetAssetBalanceAfterTransaction, false, true);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(removeLiquidityRequest.symbol, lpTokenBalanceAfterTransaction, true, true);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async fundAndStakeBalancerV2({state, rootState, commit, dispatch}, {fundRequest}) {

      const lpTokenDecimals = config.BALANCER_LP_ASSETS_CONFIG[fundRequest.symbol].decimals;
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [fundRequest.symbol]
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);

      const bptToken = new ethers.Contract(config.BALANCER_LP_ASSETS_CONFIG[fundRequest.symbol].address, erc20ABI, provider.getSigner());
      let bptBalance = await bptToken.balanceOf(rootState.network.account);

      const allowance = await bptToken.allowance(rootState.network.account, state.smartLoanContract.address);

      if (fromWei(allowance) < fromWei(bptBalance)) {
        const approveTransaction = await bptToken.connect(provider.getSigner()).approve(state.smartLoanContract.address, bptBalance);
        await awaitConfirmation(approveTransaction, provider, 'approve');
      }

      let fundTx = await wrappedContract.fund(toBytes32(fundRequest.symbol), bptBalance);
      await awaitConfirmation(fundTx, provider, 'fund LP token');

      const transaction = await wrappedContract.stakeBalancerV2(fundRequest.poolId, bptBalance);

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'stake LP token');


      const lpTokenAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'BptStaked').args.receiptTokenAmount, lpTokenDecimals);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(fundRequest.symbol, lpTokenAmount, true, true);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },


    async unstakeAndWithdrawBalancerV2({state, rootState, commit, dispatch}, {withdrawRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [withdrawRequest.symbol]
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);

      const gaugeToken = new ethers.Contract(config.BALANCER_LP_ASSETS_CONFIG[withdrawRequest.symbol].gaugeAddress, erc20ABI, provider.getSigner());
      const gaugeBalance = await gaugeToken.balanceOf(state.smartLoanContract.address);

      let unstakeTx = await wrappedContract.unstakeBalancerV2(withdrawRequest.poolId, gaugeBalance);
      await awaitConfirmation(unstakeTx, provider, 'unstake LP token');

      const bptToken = new ethers.Contract(config.BALANCER_LP_ASSETS_CONFIG[withdrawRequest.symbol].address, erc20ABI, provider.getSigner());
      const bptBalance = await bptToken.balanceOf(state.smartLoanContract.address);

      const transaction = await wrappedContract.withdraw(toBytes32(withdrawRequest.symbol), bptBalance);

      let tx = await awaitConfirmation(transaction, provider, 'withdraw LP token');

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(withdrawRequest.symbol, 0, true, true);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async withdrawBalancerV2({state, rootState, commit, dispatch}, {withdrawRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [withdrawRequest.symbol]
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);

      const bptToken = new ethers.Contract(config.BALANCER_LP_ASSETS_CONFIG[withdrawRequest.symbol].address, erc20ABI, provider.getSigner());
      const bptBalance = await bptToken.balanceOf(state.smartLoanContract.address);

      const transaction = await wrappedContract.withdraw(toBytes32(withdrawRequest.symbol), bptBalance);
      let tx = await awaitConfirmation(transaction, provider, 'withdraw LP token');

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(withdrawRequest.symbol, 0, true, true);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async stakeBalancerV2({state, rootState, commit, dispatch}, {fundRequest}) {
      const lpTokenDecimals = config.BALANCER_LP_ASSETS_CONFIG[fundRequest.symbol].decimals;

      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [fundRequest.symbol]
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);

      const bptToken = new ethers.Contract(config.BALANCER_LP_ASSETS_CONFIG[fundRequest.symbol].address, erc20ABI, provider.getSigner());
      const bptBalance = await bptToken.balanceOf(state.smartLoanContract.address);

      const transaction = await wrappedContract.stakeBalancerV2(fundRequest.poolId, bptBalance);

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'stake LP token');

      const lpTokenBalanceAfterTransaction = formatUnits(bptBalance, lpTokenDecimals)
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(fundRequest.symbol, lpTokenBalanceAfterTransaction, true, true);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async claimRewardsBalancerV2({state, rootState, dispatch}, {claimRequest}) {
      console.log('claimRewardsBalancerV2')
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG)
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);

      const transaction = await wrappedContract.claimRewardsBalancerV2(claimRequest.poolId);
      rootState.serviceRegistry.progressBarService.requestProgressBar();
      const tx = await awaitConfirmation(transaction, provider, 'claim Balancer rewards');

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      rootState.serviceRegistry.modalService.closeModal();

      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
        const lpService = rootState.serviceRegistry.lpService;
        lpService.emitRefreshLp('BALANCER_V2_REWARDS_CLAIMED');
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async provideLiquidityConcentratedPool({state, rootState, commit, dispatch}, {provideLiquidityRequest}) {
      const provider = rootState.network.provider;

      const firstDecimals = config.ASSETS_CONFIG[provideLiquidityRequest.firstAsset].decimals;
      const secondDecimals = config.ASSETS_CONFIG[provideLiquidityRequest.secondAsset].decimals;
      const lpTokenDecimals = config.CONCENTRATED_LP_ASSETS_CONFIG[provideLiquidityRequest.symbol].decimals;

      let minAmount = 0;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [provideLiquidityRequest.symbol]
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);

      const transaction = await wrappedContract[provideLiquidityRequest.method](
        parseUnits(parseFloat(provideLiquidityRequest.firstAmount).toFixed(firstDecimals), BigNumber.from(firstDecimals.toString())),
        parseUnits(parseFloat(provideLiquidityRequest.secondAmount).toFixed(secondDecimals), BigNumber.from(secondDecimals.toString())),
        parseUnits((minAmount * parseFloat(provideLiquidityRequest.firstAmount)).toFixed(firstDecimals), BigNumber.from(firstDecimals.toString())),
        parseUnits((minAmount * parseFloat(provideLiquidityRequest.secondAmount)).toFixed(secondDecimals), BigNumber.from(secondDecimals.toString()))
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'create concentrated LP token');

      const firstAssetAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'Staked').args.depositTokenAmount0, firstDecimals); // how much of tokenA was used
      const secondAssetAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'Staked').args.depositTokenAmount1, secondDecimals); //how much of tokenB was used
      const lpTokenCreated = formatUnits(getLog(tx, SMART_LOAN.abi, 'Staked').args.receiptTokenAmount, lpTokenDecimals); //how much LP was created


      const firstAssetBalanceAfterTransaction = Number(state.assetBalances[provideLiquidityRequest.firstAsset]) - Number(firstAssetAmount);
      const secondAssetBalanceAfterTransaction = Number(state.assetBalances[provideLiquidityRequest.secondAsset]) - Number(secondAssetAmount);
      const lpTokenBalanceAfterTransaction = Number(state.concentratedLpBalances[provideLiquidityRequest.symbol]) + Number(lpTokenCreated);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(provideLiquidityRequest.firstAsset, firstAssetBalanceAfterTransaction, false, true);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(provideLiquidityRequest.secondAsset, secondAssetBalanceAfterTransaction, false, true);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(provideLiquidityRequest.symbol, lpTokenBalanceAfterTransaction, true, true);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async removeLiquidityConcentratedPool({state, rootState, commit, dispatch}, {removeLiquidityRequest}) {

      const provider = rootState.network.provider;

      const firstDecimals = config.ASSETS_CONFIG[removeLiquidityRequest.firstAsset].decimals;
      const secondDecimals = config.ASSETS_CONFIG[removeLiquidityRequest.secondAsset].decimals;
      const lpTokenDecimals = config.CONCENTRATED_LP_ASSETS_CONFIG[removeLiquidityRequest.symbol].decimals;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [removeLiquidityRequest.firstAsset, removeLiquidityRequest.secondAsset]
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);

      const transaction = await wrappedContract[removeLiquidityRequest.method](
        parseUnits(removePaddedTrailingZeros(removeLiquidityRequest.value), BigNumber.from(removeLiquidityRequest.assetDecimals.toString())),
        parseUnits((removeLiquidityRequest.minFirstAmount), BigNumber.from(firstDecimals.toString())),
        parseUnits((removeLiquidityRequest.minSecondAmount), BigNumber.from(secondDecimals.toString()))
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'unwind LP token');

      const firstAssetAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'Unstaked').args.depositTokenAmount0, firstDecimals); // how much of tokenA was received
      const secondAssetAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'Unstaked').args.depositTokenAmount1, secondDecimals); //how much of tokenB was received
      const lpTokenRemoved = formatUnits(getLog(tx, SMART_LOAN.abi, 'Unstaked').args.receiptTokenAmount, lpTokenDecimals); //how much LP was removed
      const firstAssetBalanceAfterTransaction = Number(state.assetBalances[removeLiquidityRequest.firstAsset]) + Number(firstAssetAmount);
      const secondAssetBalanceAfterTransaction = Number(state.assetBalances[removeLiquidityRequest.secondAsset]) + Number(secondAssetAmount);
      const lpTokenBalanceAfterTransaction = Number(state.concentratedLpBalances[removeLiquidityRequest.symbol]) - Number(lpTokenRemoved);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(removeLiquidityRequest.firstAsset, firstAssetBalanceAfterTransaction, false, true);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(removeLiquidityRequest.secondAsset, secondAssetBalanceAfterTransaction, false, true);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(removeLiquidityRequest.symbol, lpTokenBalanceAfterTransaction, true, true);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async fundLiquidityTraderJoeV2Pool({state, rootState, commit, dispatch}, {fundLiquidityRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG)
      ]);

      const lbTokenContract = new ethers.Contract(
        fundLiquidityRequest.pair,
        LB_TOKEN.abi,
        provider.getSigner()
      );

      const isApprovedForAll = await lbTokenContract.isApprovedForAll(rootState.network.account, state.smartLoanContract.address);

      if (!isApprovedForAll) {
        const approveTransaction = await lbTokenContract.approveForAll(state.smartLoanContract.address, true);

        await approveTransaction.wait();
      }

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);

      const transaction = await wrappedContract.fundLiquidityTraderJoeV2(
        fundLiquidityRequest.pair,
        fundLiquidityRequest.ids,
        fundLiquidityRequest.amounts
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'deposit TraderJoe V2 LP token');

      const {cumulativeTokenXAmount, cumulativeTokenYAmount} = await dispatch('fetchTraderJoeV2LpUnderlyingBalances', {
        lbPairAddress: fundLiquidityRequest.pair,
        binIds: fundLiquidityRequest.ids,
        lpToken: fundLiquidityRequest.lpToken
      });

      const firstAssetBalanceAfterTransaction = Number(state.assetBalances[fundLiquidityRequest.firstAsset]) - Number(formatUnits(cumulativeTokenXAmount, state.assets[fundLiquidityRequest.firstAsset].decimals));
      const secondAssetBalanceAfterTransaction = Number(state.assetBalances[fundLiquidityRequest.secondAsset]) - Number(formatUnits(cumulativeTokenYAmount, state.assets[fundLiquidityRequest.secondAsset].decimals));

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(fundLiquidityRequest.firstAsset, firstAssetBalanceAfterTransaction, false, true);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(fundLiquidityRequest.secondAsset, secondAssetBalanceAfterTransaction, false, true);

      const lpAsset = state.traderJoeV2LpAssets[fundLiquidityRequest.lpToken.symbol];
      await dispatch('refreshTraderJoeV2LpUnderlyingBalancesAndRewardsAndLiquidity', {lpAsset});

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },


    async withdrawLiquidityTraderJoeV2Pool({state, rootState, commit, dispatch}, {withdrawLiquidityRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG)
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);

      const transaction = await wrappedContract.withdrawLiquidityTraderJoeV2(
        withdrawLiquidityRequest.pair,
        withdrawLiquidityRequest.ids,
        withdrawLiquidityRequest.amounts
      );

      const lpAsset = state.traderJoeV2LpAssets[withdrawLiquidityRequest.lpToken.symbol];
      await dispatch('refreshTraderJoeV2LpUnderlyingBalancesAndRewardsAndLiquidity', {lpAsset});

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'withdraw TraderJoe V2 LP token');

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },


    async addLiquidityTraderJoeV2Pool({state, rootState, commit, dispatch}, {addLiquidityRequest}) {
      console.log('addLiquidityTraderJoeV2Pool')
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [addLiquidityRequest.symbol]
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);

      console.log('before transaction')
      const transaction = await wrappedContract[addLiquidityRequest.method](
        addLiquidityRequest.routerAddress,
        addLiquidityRequest.addLiquidityInput
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'create TraderJoe v2 LP token');

      const firstAssetBalanceAfterTransaction = Number(state.assetBalances[addLiquidityRequest.firstAsset]) - Number(formatUnits(addLiquidityRequest.firstAmount, addLiquidityRequest.firstAsset.decimals));
      const secondAssetBalanceAfterTransaction = Number(state.assetBalances[addLiquidityRequest.secondAsset]) - Number(formatUnits(addLiquidityRequest.secondAmount, addLiquidityRequest.secondAsset.decimals));

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(addLiquidityRequest.firstAsset, firstAssetBalanceAfterTransaction, false, true);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(addLiquidityRequest.secondAsset, secondAssetBalanceAfterTransaction, false, true);

      // update underlying assets' balances
      const lpAsset = state.traderJoeV2LpAssets[addLiquidityRequest.symbol];
      await dispatch('refreshTraderJoeV2LpUnderlyingBalancesAndRewardsAndLiquidity', {lpAsset});

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async removeLiquidityTraderJoeV2Pool({state, rootState, dispatch}, {removeLiquidityRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [removeLiquidityRequest.firstAsset, removeLiquidityRequest.secondAsset]
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);

      const transaction = await wrappedContract[removeLiquidityRequest.method](
        removeLiquidityRequest.routerAddress,
        removeLiquidityRequest.removeLiquidityInput,
        removeLiquidityRequest.forceTransaction ? {gasLimit: 9999999} : {}
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'unwind traderjoe v2 token');

      const {cumulativeTokenXAmount, cumulativeTokenYAmount} = await dispatch('fetchTraderJoeV2LpUnderlyingBalances', {
        lbPairAddress: removeLiquidityRequest.lbPairAddress,
        binIds: removeLiquidityRequest.remainingBinIds,
        lpToken: removeLiquidityRequest.lpToken
      });
      const firstAssetBalanceAfterTransaction = Number(state.assetBalances[removeLiquidityRequest.firstAsset]) + Number(formatUnits(cumulativeTokenXAmount, state.assets[removeLiquidityRequest.firstAsset].decimals));
      const secondAssetBalanceAfterTransaction = Number(state.assetBalances[removeLiquidityRequest.secondAsset]) + Number(formatUnits(cumulativeTokenYAmount, state.assets[removeLiquidityRequest.secondAsset].decimals));

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(removeLiquidityRequest.firstAsset, firstAssetBalanceAfterTransaction, false, true);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(removeLiquidityRequest.secondAsset, secondAssetBalanceAfterTransaction, false, true);

      const lpAsset = state.traderJoeV2LpAssets[removeLiquidityRequest.symbol];
      await dispatch('refreshTraderJoeV2LpUnderlyingBalancesAndLiquidity', {lpAsset});

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async claimTraderJoeRewards({state, rootState, dispatch}, {claimRewardsRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG)
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);

      const transaction =
        claimRewardsRequest.version === '2.2'
          ?
          await wrappedContract.claimReward(claimRewardsRequest.pair, claimRewardsRequest.ids)
          :
          await wrappedContract.claimReward(claimRewardsRequest.merkleEntries);

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      const tx = await awaitConfirmation(transaction, provider, 'claim rewards from traderjoe v2 pools');

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      rootState.serviceRegistry.modalService.closeModal();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async addLiquidityLevelFinance({state, rootState, commit, dispatch}, {addLiquidityRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [addLiquidityRequest.sourceAsset, addLiquidityRequest.targetAsset]
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);

      let sourceDecimals = config.ASSETS_CONFIG[addLiquidityRequest.sourceAsset].decimals;
      let sourceAmount = parseUnits(parseFloat(addLiquidityRequest.sourceAmount).toFixed(sourceDecimals), sourceDecimals);

      let targetDecimals = config.LEVEL_LP_ASSETS_CONFIG[addLiquidityRequest.targetAsset].decimals;
      let targetAmount = parseUnits(addLiquidityRequest.targetAmount.toFixed(targetDecimals), targetDecimals);

      const transaction = await wrappedContract[addLiquidityRequest.method](
        sourceAmount,
        targetAmount,
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'create Level LLP token');

      const firstAssetBalanceAfterTransaction = Number(state.assetBalances[addLiquidityRequest.sourceAsset]) - Number(addLiquidityRequest.sourceAmount);
      const secondAssetBalanceAfterTransaction = Number(state.levelLpBalances[addLiquidityRequest.targetAsset]) + Number(addLiquidityRequest.targetAmount);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(addLiquidityRequest.sourceAsset, firstAssetBalanceAfterTransaction, false, false);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(addLiquidityRequest.targetAsset, secondAssetBalanceAfterTransaction, true, false);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async removeLiquidityLevelFinance({state, rootState, dispatch}, {removeLiquidityRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [removeLiquidityRequest.sourceAsset, removeLiquidityRequest.targetAsset]
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);

      let sourceDecimals = config.LEVEL_LP_ASSETS_CONFIG[removeLiquidityRequest.sourceAsset].decimals;
      let sourceAmount = parseUnits(parseFloat(removeLiquidityRequest.sourceAmount).toFixed(sourceDecimals), sourceDecimals);

      let targetDecimals = config.ASSETS_CONFIG[removeLiquidityRequest.targetAsset].decimals;
      let targetAmount = parseUnits(removeLiquidityRequest.targetAmount.toFixed(targetDecimals), targetDecimals);

      const transaction = await wrappedContract[removeLiquidityRequest.method](
        sourceAmount,
        targetAmount,
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'remove liquidity from LLp');

      const firstAssetBalanceAfterTransaction = Number(state.levelLpBalances[removeLiquidityRequest.sourceAsset]) - Number(removeLiquidityRequest.sourceAmount);
      const secondAssetBalanceAfterTransaction = Number(state.assetBalances[removeLiquidityRequest.targetAsset]) + Number(removeLiquidityRequest.targetAmount);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(removeLiquidityRequest.sourceAsset, firstAssetBalanceAfterTransaction, true, false);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(removeLiquidityRequest.targetAsset, secondAssetBalanceAfterTransaction, false, false);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async claimLevelRewards({state, rootState, dispatch}, {claimRewardsRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG)
      ]);

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets)).harvestRewards(claimRewardsRequest.lpToken.pid);

      rootState.serviceRegistry.progressBarService.requestProgressBar();

      const tx = await awaitConfirmation(transaction, provider, 'harvestRewards');

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      rootState.serviceRegistry.modalService.closeModal();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async createWombatLpFromLrt({state, rootState, commit, dispatch}, {stakeRequest}) {
      const provider = rootState.network.provider;
      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [stakeRequest.sourceAsset, stakeRequest.targetAsset]
      ]);
      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);
      const transaction = await wrappedContract[stakeRequest.methodName](
        toWei(stakeRequest.amount.toFixed(18)),
        toWei(stakeRequest.minLpOut.toFixed(18)),
      )

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'create Wombat LP');
      const firstAssetBalanceAfterTransaction = Number(state.assetBalances[stakeRequest.sourceAsset]) - Number(stakeRequest.amount);
      const secondAssetBalanceAfterTransaction = Number(state.wombatLpBalances[stakeRequest.targetAsset]) + Number(stakeRequest.minLpOut);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(stakeRequest.sourceAsset, firstAssetBalanceAfterTransaction, false, false);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(stakeRequest.targetAsset, secondAssetBalanceAfterTransaction, true, false);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
        setTimeout(async () => {
          await dispatch('updateFunds');
        }, config.wombatRefreshDelay)
      }, config.refreshDelay);
    },

    async unwindWombatLpToLrt({state, rootState, commit, dispatch}, {unwindRequest}) {
      const provider = rootState.network.provider;
      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [unwindRequest.sourceAsset, unwindRequest.targetAsset]
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);
      const transaction = await wrappedContract[unwindRequest.methodName](
        toWei(unwindRequest.amount.toFixed(18)),
        toWei(unwindRequest.minOut.toFixed(18)),
      )

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'create Wombat LP');
      const firstAssetBalanceAfterTransaction = Number(state.wombatLpBalances[unwindRequest.sourceAsset]) - Number(unwindRequest.amount);
      const secondAssetBalanceAfterTransaction = Number(state.assetBalances[unwindRequest.targetAsset]) + Number(unwindRequest.minLpOut);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(unwindRequest.sourceAsset, firstAssetBalanceAfterTransaction, false, false);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(unwindRequest.targetAsset, secondAssetBalanceAfterTransaction, true, false);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
        setTimeout(async () => {
          await dispatch('updateFunds');
        }, config.wombatRefreshDelay)
      }, config.refreshDelay);
    },

    async createPendleLpFromLrt({state, rootState, commit, dispatch}, {stakeRequest}) {
      const provider = rootState.network.provider;
      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [stakeRequest.sourceAsset, stakeRequest.targetAsset]
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);

      const transaction = await wrappedContract.depositToPendleAndStakeInPenpie(
        toBytes32(stakeRequest.sourceAsset),
        toWei(stakeRequest.amount.toFixed(18)),
        stakeRequest.market,
        toWei(stakeRequest.minLpOut.toFixed(18)),
        stakeRequest.guessPtReceivedFromSy,
        stakeRequest.input,
        stakeRequest.limit
      );
      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'create Pendle LP');
      const firstAssetBalanceAfterTransaction = Number(state.assetBalances[stakeRequest.sourceAsset]) - Number(stakeRequest.amount);
      const secondAssetBalanceAfterTransaction = Number(state.penpieLpBalances[stakeRequest.targetAsset]) + Number(stakeRequest.minLpOut);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(stakeRequest.sourceAsset, firstAssetBalanceAfterTransaction, false, false);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(stakeRequest.targetAsset, secondAssetBalanceAfterTransaction, true, false);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
        setTimeout(async () => {
          await dispatch('updateFunds');
        }, config.penpieRefreshDelay)
      }, config.refreshDelay);
    },

    async unwindPendleLpToLrt({state, rootState, commit, dispatch}, {unwindRequest}) {
      console.log('unwindPendleLpToLrt', unwindRequest);
      const provider = rootState.network.provider;
      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [unwindRequest.sourceAsset, unwindRequest.targetAsset]
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);
      const transaction = await wrappedContract.unstakeFromPenpieAndWithdrawFromPendle(
        toBytes32(unwindRequest.targetAsset),
        toWei(unwindRequest.amount.toFixed(18)),
        unwindRequest.market,
        toWei(unwindRequest.minOut.toFixed(18)),
        unwindRequest.output,
        unwindRequest.limit
      );
      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'unwind Pendle LP');

      const firstAssetBalanceAfterTransaction = Number(state.assetBalances[unwindRequest.sourceAsset]) - Number(unwindRequest.amount);
      const secondAssetBalanceAfterTransaction = Number(state.penpieLpBalances[unwindRequest.targetAsset]) + Number(unwindRequest.minOut);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(unwindRequest.sourceAsset, firstAssetBalanceAfterTransaction, false, false);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(unwindRequest.targetAsset, secondAssetBalanceAfterTransaction, true, false);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
        setTimeout(async () => {
          await dispatch('updateFunds');
        }, config.penpieRefreshDelay)
      }, config.refreshDelay);
    },

    async depositPendleLPAndStake({state, rootState, commit, dispatch}, {depositAndStakeRequest}) {
      const provider = rootState.network.provider;

      const tokenForApprove = depositAndStakeRequest.market;
      const fundToken = new ethers.Contract(tokenForApprove, erc20ABI, provider.getSigner());
      const allowance = formatUnits(await fundToken.allowance(rootState.network.account, state.smartLoanContract.address), depositAndStakeRequest.decimals);

      if (parseFloat(allowance) < parseFloat(depositAndStakeRequest.amount)) {
        const approveTransaction = await fundToken.connect(provider.getSigner()).approve(state.smartLoanContract.address, toWei(depositAndStakeRequest.amount));
        await awaitConfirmation(approveTransaction, provider, 'approve');
      }

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [depositAndStakeRequest.targetAsset, depositAndStakeRequest.sourceAsset]
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);
      const transaction = await wrappedContract.depositPendleLPAndStakeInPenpie(
        depositAndStakeRequest.market,
        toWei(depositAndStakeRequest.amount),
      );
      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'deposit and stake Pendle LP');

      const secondAssetBalanceAfterTransaction = Number(state.gmxV2Balances[depositAndStakeRequest.targetAsset]) + Number(depositAndStakeRequest.amount);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(depositAndStakeRequest.targetAsset, secondAssetBalanceAfterTransaction, true, false);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
        setTimeout(async () => {
          await dispatch('updateFunds');
        }, config.penpieRefreshDelay)
      }, config.refreshDelay);
    },

    async depositWombatLPAndStake({state, rootState, commit, dispatch}, {depositAndStakeRequest}) {
      const provider = rootState.network.provider;

      const tokenForApprove = TOKEN_ADDRESSES[depositAndStakeRequest.asset];
      const fundToken = new ethers.Contract(tokenForApprove, erc20ABI, provider.getSigner());
      const allowance = formatUnits(await fundToken.allowance(rootState.network.account, state.smartLoanContract.address), depositAndStakeRequest.decimals);

      if (parseFloat(allowance) < parseFloat(depositAndStakeRequest.amount)) {
        const approveTransaction = await fundToken.connect(provider.getSigner()).approve(state.smartLoanContract.address, toWei(depositAndStakeRequest.amount));
        await awaitConfirmation(approveTransaction, provider, 'approve');
      }

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [depositAndStakeRequest.asset]
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);
      const transaction = await wrappedContract[depositAndStakeRequest.depositAndStakeMethod](
        toWei(depositAndStakeRequest.amount),
      );
      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'deposit and stake Wombat LP');

      const assetBalanceAfterTransaction = Number(state.gmxV2Balances[depositAndStakeRequest.asset]) + Number(depositAndStakeRequest.amount);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(depositAndStakeRequest.asset, assetBalanceAfterTransaction, true, false);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
        setTimeout(async () => {
          await dispatch('updateFunds');
        }, config.wombatRefreshDelay)
      }, config.refreshDelay);
    },

    async unstakeAndExportWombatLp({state, rootState, commit, dispatch}, {unstakeRequest}) {
      const provider = rootState.network.provider;
      const amountInWei = parseUnits(parseFloat(unstakeRequest.value).toFixed(unstakeRequest.assetDecimals), unstakeRequest.assetDecimals);

      const loanAssets = mergeArrays([
        (await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [unstakeRequest.targetAsset, unstakeRequest.sourceAsset],
      ]);

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets))[unstakeRequest.unstakeAndWithdrawMethod](
        amountInWei
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'withdraw wombat LP');

      const price = state.wombatLpAssets[unstakeRequest.asset].price;
      const withdrawAmountUSD = fromWei(amountInWei) * price;
      const assetBalanceBeforeWithdraw = state.wombatLpBalances[unstakeRequest.asset];

      const assetBalanceAfterWithdraw = Number(assetBalanceBeforeWithdraw) - Number(unstakeRequest.value);
      const totalCollateralAfterTransaction = state.fullLoanStatus.totalValue - state.fullLoanStatus.debt - withdrawAmountUSD;

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(unstakeRequest.asset, assetBalanceAfterWithdraw, false, true);
      rootState.serviceRegistry.collateralService.emitCollateral(totalCollateralAfterTransaction);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async addLiquidityGmxV2({state, rootState, commit, dispatch}, {addLiquidityRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [addLiquidityRequest.sourceAsset, addLiquidityRequest.targetAsset]
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);

      let sourceDecimals = config.ASSETS_CONFIG[addLiquidityRequest.sourceAsset].decimals;
      let sourceAmount = parseUnits(parseFloat(addLiquidityRequest.sourceAmount).toFixed(sourceDecimals), sourceDecimals);

      let targetDecimals = config.GMX_V2_ASSETS_CONFIG[addLiquidityRequest.targetAsset].decimals;

      let minGmAmount = parseUnits(addLiquidityRequest.minGmAmount.toFixed(targetDecimals), targetDecimals);

      let executionFeeWei = toWei(addLiquidityRequest.executionFee.toFixed(18));

      console.log(addLiquidityRequest)
      const transaction = await wrappedContract[addLiquidityRequest.method](
        addLiquidityRequest.isLongToken,
        sourceAmount,
        minGmAmount,
        executionFeeWei,
        {value: executionFeeWei}
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'create GM token');

      const firstAssetBalanceAfterTransaction = Number(state.assetBalances[addLiquidityRequest.sourceAsset]) - Number(addLiquidityRequest.tokenAmount);
      const secondAssetBalanceAfterTransaction = Number(state.gmxV2Balances[addLiquidityRequest.targetAsset]) + Number(addLiquidityRequest.minGmAmount);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(addLiquidityRequest.sourceAsset, firstAssetBalanceAfterTransaction, false, false);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(addLiquidityRequest.targetAsset, secondAssetBalanceAfterTransaction, true, false);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
        setTimeout(async () => {
          await dispatch('updateFunds');
        }, config.gmxV2RefreshDelay)
      }, config.refreshDelay);
    },

    async removeLiquidityGmxV2({state, rootState, dispatch}, {removeLiquidityRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [removeLiquidityRequest.sourceAsset, removeLiquidityRequest.targetAsset]
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);

      let gmDecimals = config.GMX_V2_ASSETS_CONFIG[removeLiquidityRequest.gmToken].decimals;
      let gmAmount = parseUnits(parseFloat(removeLiquidityRequest.gmAmount).toFixed(gmDecimals), gmDecimals);

      let shortDecimals = config.ASSETS_CONFIG[removeLiquidityRequest.shortToken].decimals;
      let minShortAmount = parseUnits(removeLiquidityRequest.minShortAmount.toFixed(shortDecimals), shortDecimals);

      let longDecimals = config.ASSETS_CONFIG[removeLiquidityRequest.longToken].decimals;
      let minLongAmount = parseUnits(removeLiquidityRequest.minLongAmount.toFixed(longDecimals), longDecimals);

      let executionFeeWei = toWei(removeLiquidityRequest.executionFee.toFixed(18));

      const transaction = await wrappedContract[removeLiquidityRequest.method](
        gmAmount,
        minLongAmount,
        minShortAmount,
        executionFeeWei,
        {value: executionFeeWei, gasLimit: 9999999}
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'remove liquidity from LLp');

      const gmBalanceAfterTransaction = Number(state.gmxV2Balances[removeLiquidityRequest.gmToken]) - Number(removeLiquidityRequest.gmAmount);
      const longAssetBalanceAfterTransaction = Number(state.assetBalances[removeLiquidityRequest.longToken]) - Number(removeLiquidityRequest.minLongAmount);
      const shortAssetBalanceAfterTransaction = Number(state.assetBalances[removeLiquidityRequest.shortToken]) + Number(removeLiquidityRequest.minShortAmount);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(removeLiquidityRequest.gmToken, gmBalanceAfterTransaction, false, false);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(removeLiquidityRequest.longToken, longAssetBalanceAfterTransaction, false, false);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(removeLiquidityRequest.shortToken, shortAssetBalanceAfterTransaction, false, false);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
        setTimeout(async () => {
          await dispatch('updateFunds');
        }, config.gmxV2RefreshDelay)
      }, config.refreshDelay);
    },

    async addLiquidityGmxPlus({state, rootState, commit, dispatch}, {addLiquidityRequest}) {
      console.log(addLiquidityRequest);

      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [addLiquidityRequest.sourceAsset, addLiquidityRequest.targetAsset]
      ]);


      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);

      let executionFeeWei = toWei(addLiquidityRequest.executionFee.toFixed(18));

      console.log(wrappedContract);

      let sourceDecimals = config.ASSETS_CONFIG[addLiquidityRequest.sourceAsset].decimals;
      let sourceAmount = parseUnits(parseFloat(addLiquidityRequest.sourceAmount).toFixed(sourceDecimals), sourceDecimals);

      let targetDecimals = config.GMX_V2_ASSETS_CONFIG[addLiquidityRequest.targetAsset].decimals;

      let minGmAmount = parseUnits(addLiquidityRequest.minGmAmount.toFixed(targetDecimals), targetDecimals);

      const transaction = await wrappedContract[addLiquidityRequest.method](sourceAmount, minGmAmount, executionFeeWei, {
        value: executionFeeWei,
        gasLimit: 9999999
      });

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      const tx = await awaitConfirmation(transaction, provider, 'add liquidity to GMXV2+');

      const firstAssetBalanceAfterTransaction = Number(state.assetBalances[addLiquidityRequest.sourceAsset]) - Number(addLiquidityRequest.sourceAmount);
      const secondAssetBalanceAfterTransaction = Number(state.gmxV2Balances[addLiquidityRequest.targetAsset]) + Number(addLiquidityRequest.minGmAmount);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(addLiquidityRequest.sourceAsset, firstAssetBalanceAfterTransaction, false, false);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(addLiquidityRequest.targetAsset, secondAssetBalanceAfterTransaction, true, false);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
        setTimeout(async () => {
          await dispatch('updateFunds');
        }, config.gmxV2RefreshDelay)
      }, config.refreshDelay);

    },


    async removeLiquidityGmxPlus({state, rootState, commit, dispatch}, {removeLiquidityRequest}) {
      console.log(removeLiquidityRequest);

      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [removeLiquidityRequest.sourceAsset, removeLiquidityRequest.targetAsset]
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);

      const executionFeeWei = toWei(removeLiquidityRequest.executionFee.toFixed(18));

      console.log(wrappedContract);

      const sourceDecimals = config.GMX_V2_ASSETS_CONFIG[removeLiquidityRequest.sourceAsset].decimals;
      const sourceAmount = parseUnits(parseFloat(removeLiquidityRequest.sourceAmount).toFixed(sourceDecimals), sourceDecimals);

      const targetDecimals = config.ASSETS_CONFIG[removeLiquidityRequest.targetAsset].decimals;

      const minTargetTokenAmount = parseUnits(parseFloat(removeLiquidityRequest.targetAmount).toFixed(targetDecimals), targetDecimals);
      const minLongTokenAmount = minTargetTokenAmount.div(2);
      const minShortTokenAmount = minTargetTokenAmount.div(2);


      const transaction = await wrappedContract[removeLiquidityRequest.method](sourceAmount, minLongTokenAmount, minShortTokenAmount, executionFeeWei, {
        value: executionFeeWei,
        gasLimit: 9999999
      });

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'add liquidity to GMXV2+');

      const gmBalanceAfterTransaction = Number(state.gmxV2Balances[removeLiquidityRequest.sourceAsset]) - Number(removeLiquidityRequest.sourceAmount);
      const targetAssetBalanceAfterTransaction = Number(state.assetBalances[removeLiquidityRequest.targetAsset]) + Number(removeLiquidityRequest.targetAmount);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(removeLiquidityRequest.sourceAsset, gmBalanceAfterTransaction, false, false);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(removeLiquidityRequest.targetAsset, targetAssetBalanceAfterTransaction, false, false);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
        setTimeout(async () => {
          await dispatch('updateFunds');
        }, config.gmxV2RefreshDelay)
      }, config.refreshDelay);

    },

    async borrow({state, rootState, commit, dispatch}, {borrowRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [borrowRequest.asset, 'PRIME']
      ]);

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets)).borrow(
        toBytes32(borrowRequest.asset),
        parseUnits(String(borrowRequest.amount), config.ASSETS_CONFIG[borrowRequest.asset].decimals));

      if (!borrowRequest.keepModalOpen) {
        rootState.serviceRegistry.progressBarService.requestProgressBar();
        rootState.serviceRegistry.modalService.closeModal();
      }

      let tx = await awaitConfirmation(transaction, provider, 'borrow');
      const borrowedAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'Borrowed').args.amount, config.ASSETS_CONFIG[borrowRequest.asset].decimals);
      const balanceAfterTransaction = Number(state.assetBalances[borrowRequest.asset]) + Number(borrowedAmount);
      const debtAfterTransaction = Number(state.debtsPerAsset[borrowRequest.asset].debt) + Number(borrowedAmount);
      const borrowedAmountUSD = Number(borrowedAmount) * Number(state.assets[borrowRequest.asset].price);
      const totalDebtAfterTransaction = Number(state.fullLoanStatus.debt) + borrowedAmountUSD;

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(borrowRequest.asset, balanceAfterTransaction, false, true);
      rootState.serviceRegistry.assetDebtsExternalUpdateService
        .emitExternalAssetDebtUpdate(borrowRequest.asset, debtAfterTransaction, true);
      rootState.serviceRegistry.debtService.emitDebt(totalDebtAfterTransaction);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('poolStore/setupPools', {}, {root: true});
      }, 1000);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);

      rootState.serviceRegistry.sPrimeService.emitRefreshSPrimeDataWithDefault(provider, rootState.network.account);
      rootState.serviceRegistry.vPrimeService.emitRefreshVPrimeDataWithDefault(rootState.network.account);
    },

    async repay({state, rootState, commit, dispatch}, {repayRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        'PRIME'
      ]);

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets)).repay(
        toBytes32(repayRequest.asset),
        parseUnits(parseFloat(repayRequest.amount).toFixed(repayRequest.decimals), BigNumber.from(repayRequest.decimals)));

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'repay');

      const repayAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'Repaid').args.amount, config.ASSETS_CONFIG[repayRequest.asset].decimals);
      const repayAmountUSD = Number(repayAmount) * Number(state.assets[repayRequest.asset].price);

      const balanceAfterRepay = Number(state.assetBalances[repayRequest.asset]) - Number(repayAmount);
      const debtAfterRepay = repayRequest.isMax ? 0 : Number(state.debtsPerAsset[repayRequest.asset].debt) - Number(repayAmount);
      const totalDebtAfterRepay = Number(state.fullLoanStatus.debt - repayAmountUSD);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(repayRequest.asset, balanceAfterRepay, false, true);
      rootState.serviceRegistry.assetDebtsExternalUpdateService
        .emitExternalAssetDebtUpdate(repayRequest.asset, debtAfterRepay, true);
      rootState.serviceRegistry.debtService.emitDebt(totalDebtAfterRepay);

      commit('setSingleAssetBalance', {asset: repayRequest.asset, balance: balanceAfterRepay});
      commit('setSingleAssetDebt', {asset: repayRequest.asset, debt: debtAfterRepay});

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('poolStore/setupPools', {}, {root: true});
      }, 1000);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);

      rootState.serviceRegistry.sPrimeService.emitRefreshSPrimeDataWithDefault(provider, rootState.network.account);
      rootState.serviceRegistry.vPrimeService.emitRefreshVPrimeDataWithDefault(rootState.network.account);
    },

    async swap({state, rootState, commit, dispatch}, {swapRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [swapRequest.targetAsset]
      ]);

      let sourceDecimals = config.ASSETS_CONFIG[swapRequest.sourceAsset].decimals;
      let sourceAmount = parseUnits(parseFloat(swapRequest.sourceAmount).toFixed(sourceDecimals), sourceDecimals);

      let targetDecimals = config.ASSETS_CONFIG[swapRequest.targetAsset].decimals;
      let targetAmount = parseUnits(swapRequest.targetAmount.toFixed(targetDecimals), targetDecimals);

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets)).yakSwap(
        sourceAmount,
        targetAmount,
        swapRequest.path,
        swapRequest.adapters
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'swap');

      const amountSold = formatUnits(getLog(tx, SMART_LOAN.abi, 'Swap').args.maximumSold, config.ASSETS_CONFIG[swapRequest.sourceAsset].decimals);
      const amountBought = formatUnits(getLog(tx, SMART_LOAN.abi, 'Swap').args.minimumBought, config.ASSETS_CONFIG[swapRequest.targetAsset].decimals);
      const sourceBalanceAfterSwap = Number(state.assetBalances[swapRequest.sourceAsset]) - Number(amountSold);
      const targetBalanceAfterSwap = Number(state.assetBalances[swapRequest.targetAsset]) + Number(amountBought);

      commit('setSingleAssetBalance', {asset: swapRequest.sourceAsset, balance: sourceBalanceAfterSwap});
      commit('setSingleAssetBalance', {asset: swapRequest.targetAsset, balance: targetBalanceAfterSwap});
      commit('setSingleAssetCurrentExposure', {asset: swapRequest.sourceAsset, exposureChange: -Number(amountSold)});
      commit('setSingleAssetCurrentExposure', {asset: swapRequest.targetAsset, exposureChange: Number(amountBought)});

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(swapRequest.sourceAsset, sourceBalanceAfterSwap, false, true);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(swapRequest.targetAsset, targetBalanceAfterSwap, false, true);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async paraSwapV2({state, rootState, commit, dispatch}, {swapRequest}) {
      console.log('paraSwapV2')
      const provider = rootState.network.provider;

      console.log(swapRequest);

      let sourceDecimals = config.ASSETS_CONFIG[swapRequest.sourceAsset].decimals;
      let sourceAmount = parseUnits(parseFloat(swapRequest.sourceAmount).toFixed(sourceDecimals), sourceDecimals);

      let targetDecimals = config.ASSETS_CONFIG[swapRequest.targetAsset].decimals;
      let targetAmount = parseUnits(swapRequest.targetAmount.toFixed(targetDecimals), targetDecimals);

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [swapRequest.targetAsset]
      ]);

      const wrappedLoan = await wrapContract(state.smartLoanContract, loanAssets);

      const paraSwapSDK = constructSimpleSDK({chainId: config.chainId, axios});

      const priceRoute = swapRequest.paraSwapRate;
      console.log('swapRequest.paraSwapRate.srcAmount: ', swapRequest.paraSwapRate.srcAmount)
      console.log(swapRequest.paraSwapRate)
      const txParams = await paraSwapSDK.swap.buildTx({
        srcToken: swapRequest.paraSwapRate.srcToken,
        destToken: swapRequest.paraSwapRate.destToken,
        srcAmount: swapRequest.paraSwapRate.srcAmount,
        slippage: 1000,
        priceRoute,
        userAddress: state.smartLoanContract.address,
        partner: 'anon',
      }, {
        ignoreChecks: true,
      });

      const selector = txParams.data.substr(0, 10);
      const data = '0x' + txParams.data.substr(10);

      const transaction = await wrappedLoan.paraSwapV2(
        selector,
        data,
        swapRequest.paraSwapRate.srcToken,
        sourceAmount,
        swapRequest.paraSwapRate.destToken,
        targetAmount
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      const tx = await awaitConfirmation(transaction, provider, 'paraSwap');

      console.log('SWAP LOG');
      console.log(getLog(tx, SMART_LOAN.abi, 'Swap'));

      const amountSold = formatUnits(getLog(tx, SMART_LOAN.abi, 'Swap').args.maximumSold, config.ASSETS_CONFIG[swapRequest.sourceAsset].decimals);
      const amountBought = formatUnits(getLog(tx, SMART_LOAN.abi, 'Swap').args.minimumBought, config.ASSETS_CONFIG[swapRequest.targetAsset].decimals);
      const sourceBalanceAfterSwap = Number(state.assetBalances[swapRequest.sourceAsset]) - Number(amountSold);
      const targetBalanceAfterSwap = Number(state.assetBalances[swapRequest.targetAsset]) + Number(amountBought);

      commit('setSingleAssetBalance', {asset: swapRequest.sourceAsset, balance: sourceBalanceAfterSwap});
      commit('setSingleAssetBalance', {asset: swapRequest.targetAsset, balance: targetBalanceAfterSwap});

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(swapRequest.sourceAsset, sourceBalanceAfterSwap, false, true);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(swapRequest.targetAsset, targetBalanceAfterSwap, false, true);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      console.log(tx);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async swapDebt({state, rootState, commit, dispatch}, {swapDebtRequest}) {
      const provider = rootState.network.provider;
      console.log('swapDebtRequest', swapDebtRequest);

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [swapDebtRequest.targetAsset]
      ]);

      console.log('loanAssets', loanAssets);

      let sourceDecimals = config.ASSETS_CONFIG[swapDebtRequest.sourceAsset].decimals;
      let sourceAmount = parseUnits(parseFloat(swapDebtRequest.sourceAmount).toFixed(sourceDecimals), sourceDecimals);

      let targetDecimals = config.ASSETS_CONFIG[swapDebtRequest.targetAsset].decimals;
      let targetAmount = parseUnits(parseFloat(swapDebtRequest.targetAmount).toFixed(targetDecimals), targetDecimals);

      console.log('sourceDecimals', sourceDecimals);
      console.log('sourceAmount', sourceAmount);
      console.log('targetDecimals', targetDecimals);
      console.log('targetAmount', targetAmount);

      console.log('toBytes32(swapDebtRequest.sourceAsset));', toBytes32(swapDebtRequest.sourceAsset));
      console.log('toBytes32(swapDebtRequest.targetAsset));', toBytes32(swapDebtRequest.targetAsset));
      console.log('sourceAmount);', sourceAmount);
      console.log('targetAmount);', targetAmount);
      console.log('swapDebtRequest.path);', swapDebtRequest.path);
      console.log('swapDebtRequest.adapters);', swapDebtRequest.adapters);

      console.log('sourceAmount);', formatUnits(sourceAmount, 18));
      console.log('targetAmount);', formatUnits(targetAmount, 6));

      // toBytes32(swapDebtRequest.sourceAsset)
      // toBytes32(swapDebtRequest.targetAsset)
      // sourceAmount
      // targetAmount
      // swapDebtRequest.path
      // swapDebtRequest.adapters
      const path = swapDebtRequest.path.map(token => token.toLowerCase());
      console.log(path);

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets)).swapDebt(
        toBytes32(swapDebtRequest.sourceAsset),
        toBytes32(swapDebtRequest.targetAsset),
        sourceAmount,
        targetAmount,
        path.reverse(),
        [...swapDebtRequest.adapters].reverse()
      );

      console.log(transaction);

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'swap');

      console.log(tx);

      const amountDebtSwappedTo = formatUnits(getLog(tx, SMART_LOAN.abi, 'DebtSwap').args.borrowAmount, config.ASSETS_CONFIG[swapDebtRequest.targetAsset].decimals);
      const amountDebtSwappedFrom = formatUnits(getLog(tx, SMART_LOAN.abi, 'DebtSwap').args.repayAmount, config.ASSETS_CONFIG[swapDebtRequest.sourceAsset].decimals);

      console.log('amountDebtSwappedTo', amountDebtSwappedTo);
      console.log('amountDebtSwappedFrom', amountDebtSwappedFrom);

      const sourceDebtAfterTransaction = Number(state.debtsPerAsset[swapDebtRequest.sourceAsset].debt) - Number(amountDebtSwappedFrom);
      const targetDebtAfterTransaction = Number(state.debtsPerAsset[swapDebtRequest.targetAsset].debt) + Number(amountDebtSwappedTo);

      rootState.serviceRegistry.assetDebtsExternalUpdateService
        .emitExternalAssetDebtUpdate(swapDebtRequest.sourceAsset, sourceDebtAfterTransaction, true);
      rootState.serviceRegistry.assetDebtsExternalUpdateService
        .emitExternalAssetDebtUpdate(swapDebtRequest.targetAsset, targetDebtAfterTransaction, true);

      const borrowedAmountUSD = Number(amountDebtSwappedTo) * Number(state.assets[swapDebtRequest.targetAsset].price);
      const repaidAmountUSD = Number(amountDebtSwappedFrom) * Number(state.assets[swapDebtRequest.sourceAsset].price);

      const totalDebtAfterTransaction = Number(state.fullLoanStatus.debt) + borrowedAmountUSD - repaidAmountUSD;

      rootState.serviceRegistry.debtService.emitDebt(totalDebtAfterTransaction);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async mintAndStakeGlp({state, rootState, commit, dispatch}, {swapRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        ['GLP']
      ]);

      let sourceDecimals = config.ASSETS_CONFIG[swapRequest.sourceAsset].decimals;
      let sourceAmount = parseUnits(parseFloat(swapRequest.sourceAmount).toFixed(sourceDecimals), sourceDecimals);

      const weiDecimals = BigNumber.from('18');
      let minUsdValue = parseUnits(parseFloat(swapRequest.minUsdValue).toFixed(18), weiDecimals);
      let minGlp = parseUnits(parseFloat(swapRequest.minGlp).toFixed(18), weiDecimals);

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets)).mintAndStakeGlp(
        TOKEN_ADDRESSES[swapRequest.sourceAsset],
        sourceAmount,
        minUsdValue,
        minGlp
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'mint GLP');

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      const amountUsed = formatUnits(getLog(tx, SMART_LOAN.abi, 'GLPMint').args.tokenToMintWithAmount, config.ASSETS_CONFIG[swapRequest.sourceAsset].decimals);
      const amountMinted = formatUnits(getLog(tx, SMART_LOAN.abi, 'GLPMint').args.glpOutputAmount, weiDecimals);

      const sourceBalanceAfterMint = Number(state.assetBalances[swapRequest.sourceAsset]) - Number(amountUsed);
      const glpBalanceAfterMint = Number(state.assetBalances['GLP']) + Number(amountMinted);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(swapRequest.sourceAsset, sourceBalanceAfterMint, false, true);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate('GLP', glpBalanceAfterMint, false, true);

      rootState.serviceRegistry.dataRefreshEventService.emitAssetBalancesDataRefresh();

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async unstakeAndRedeemGlp({state, rootState, commit, dispatch}, {swapRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [swapRequest.targetAsset]
      ]);

      const weiDecimals = BigNumber.from('18');
      let targetDecimals = config.ASSETS_CONFIG[swapRequest.targetAsset].decimals;
      let targetAmount = parseUnits(parseFloat(swapRequest.targetAmount).toFixed(targetDecimals), targetDecimals);
      let glpAmount = parseUnits(parseFloat(swapRequest.glpAmount).toFixed(18), weiDecimals);
      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets)).unstakeAndRedeemGlp(
        TOKEN_ADDRESSES[swapRequest.targetAsset],
        glpAmount,
        targetAmount
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'redeem GLP');

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      const amountReceived = formatUnits(getLog(tx, SMART_LOAN.abi, 'GLPRedemption').args.redeemedTokenAmount, config.ASSETS_CONFIG[swapRequest.targetAsset].decimals);
      const amountGlpRedeemed = formatUnits(getLog(tx, SMART_LOAN.abi, 'GLPRedemption').args.glpRedeemedAmount, weiDecimals);

      const targetBalanceAfterMint = Number(state.assetBalances[swapRequest.targetAsset]) + Number(amountReceived);
      const glpBalanceAfterMint = Number(state.assetBalances['GLP']) - Number(amountGlpRedeemed);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(swapRequest.targetAsset, targetBalanceAfterMint, false, true);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate('GLP', glpBalanceAfterMint, false, true);

      rootState.serviceRegistry.dataRefreshEventService.emitAssetBalancesDataRefresh();

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async wrapNativeToken({state, rootState, commit, dispatch}, {wrapRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.smartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.smartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG)
      ]);

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets)).wrapNativeToken(
        parseUnits(parseFloat(wrapRequest.amount).toFixed(wrapRequest.decimals)));

      rootState.serviceRegistry.progressBarService.requestProgressBar();

      let tx = await awaitConfirmation(transaction, provider, 'wrap');

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      rootState.serviceRegistry.modalService.closeModal();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async claimGLPRewards({state, rootState, dispatch}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG)
      ]);

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets)).claimGLpFees();

      rootState.serviceRegistry.progressBarService.requestProgressBar();

      const tx = await awaitConfirmation(transaction, provider, 'claimGLPRewards');
      const wavaxClaimed = formatUnits(getLog(tx, SMART_LOAN.abi, 'GLPFeesClaim').args.wavaxAmountClaimed, config.ASSETS_CONFIG.AVAX.decimals);
      const balanceAfterClaimed = Number(state.assetBalances['AVAX']) + Number(wavaxClaimed);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate('AVAX', balanceAfterClaimed, false, true);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      rootState.serviceRegistry.modalService.closeModal();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async convertGlpToGm({state, rootState, commit, dispatch}, {convertRequest}) {
      console.log('convertGlpToGm');
      const provider = rootState.network.provider;
      const gmMarket = config.GMX_V2_ASSETS_CONFIG[convertRequest.targetMarketSymbol]

      const tokenForApprove = (config.chainId === 43114) ? '0xaE64d55a6f09E4263421737397D1fdFA71896a69' : TOKEN_ADDRESSES['GLP'];
      const glpToken = new ethers.Contract(tokenForApprove, erc20ABI, provider.getSigner());
      const usdcToken = new ethers.Contract(TOKEN_ADDRESSES['USDC'], erc20ABI, provider.getSigner());

      const usdcBalanceBefore = await usdcToken.balanceOf(state.smartLoanContract.address);
      const usdcBalanceBeforeParsed = formatUnits(await usdcToken.balanceOf(state.smartLoanContract.address), config.ASSETS_CONFIG.USDC.decimals);

      const walletAmount = await glpToken.balanceOf(rootState.network.account);

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        ['GLP', convertRequest.targetMarketSymbol, 'USDC']
      ]);

      if (fromWei(walletAmount) > 0) {
        console.log('glp on wallet');
        const allowance = formatUnits(await glpToken.allowance(rootState.network.account, state.smartLoanContract.address), config.ASSETS_CONFIG['GLP'].decimals);
        console.log(allowance);

        if (parseFloat(allowance) < fromWei(walletAmount)) {
          try {
            const approveTransaction = await glpToken.connect(provider.getSigner()).approve(state.smartLoanContract.address, walletAmount);
            await awaitConfirmation(approveTransaction, provider, 'approve');
          } catch (error) {
            rootState.serviceRegistry.progressBarService.emitProgressBarErrorState('Approve transaction failed, please retry the ZAP', 6000);
            rootState.serviceRegistry.modalService.closeModal();
            setTimeout(async () => {
              await dispatch('updateFunds');
            }, config.refreshDelay);
            throw error;
          }
        }

        try {
          const fundTransaction = await (await wrapContract(state.smartLoanContract, loanAssets)).fundGLP(walletAmount);
          await awaitConfirmation(fundTransaction, provider, 'approve');
        } catch (error) {
          rootState.serviceRegistry.progressBarService.emitProgressBarErrorState('Deposit to Prime Account failed, please retry the ZAP', 6000);
          rootState.serviceRegistry.modalService.closeModal();
          setTimeout(async () => {
            await dispatch('updateFunds');
          }, config.refreshDelay);
          throw error;
        }
      }

      const glpAfterDeposit = Number(state.assetBalances['GLP']) + walletAmount;
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate('GLP', glpAfterDeposit, false, true);

      const smartLoanGlpAmount = await glpToken.balanceOf(state.smartLoanContract.address);

      const redStonePriceData = await (await fetch(config.redstoneFeedUrl)).json();
      const glpPrice = redStonePriceData.GLP[0].dataPoints[0].value;
      const usdcPrice = redStonePriceData.USDC[0].dataPoints[0].value;
      const gmPrice = redStonePriceData[convertRequest.targetMarketSymbol][0].dataPoints[0].value;

      const unstakeSlippage = 0.01; // 1%

      const minUnstakedUsdc = parseUnits((fromWei(smartLoanGlpAmount) * glpPrice / usdcPrice * (1 - unstakeSlippage)).toFixed(6), 6)//slippage max. = 1%

      try {
        const txUnstakeGlp = await (await wrapContract(state.smartLoanContract, loanAssets)).unstakeAndRedeemGlp(
          TOKEN_ADDRESSES['USDC'],
          smartLoanGlpAmount,
          minUnstakedUsdc
        );
        await awaitConfirmation(txUnstakeGlp, provider, 'unstake Glp');
      } catch (error) {
        rootState.serviceRegistry.progressBarService.emitProgressBarErrorState('Redemption failed, please retry the ZAP', 6000);
        rootState.serviceRegistry.modalService.closeModal();
        setTimeout(async () => {
          await dispatch('updateFunds');
        }, config.refreshDelay);
        throw error;
      }

      const usdcBalanceAfter = await usdcToken.balanceOf(state.smartLoanContract.address);
      const usdcBalanceAfterParsed = formatUnits(usdcBalanceAfter, config.ASSETS_CONFIG.USDC.decimals);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate('USDC', usdcBalanceAfterParsed, false, true);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate('GLP', 0, false, true);

      const usdcForGm = usdcBalanceAfter.sub(usdcBalanceBefore);

      const addGmSlippage = 0.01; // 1%
      const minReceivedGm = toWei((formatUnits(usdcForGm, 6) * usdcPrice / gmPrice * (1 - addGmSlippage)).toFixed(18))

      let executionFeeWei = toWei(convertRequest.executionFee.toFixed(18));

      let gmBalanceBefore = state.gmxV2Balances[convertRequest.targetMarketSymbol];

      try {
        const txAddGm = await (await wrapContract(state.smartLoanContract, loanAssets))[`deposit${capitalize(gmMarket.longToken)}${capitalize(gmMarket.shortToken)}GmxV2`](
          false,
          usdcForGm,
          minReceivedGm,
          executionFeeWei,
          {value: executionFeeWei}
        );

        await awaitConfirmation(txAddGm, provider, 'deposit to GM');
      } catch (error) {
        rootState.serviceRegistry.progressBarService.emitProgressBarErrorState('GM minting failed, please mint manually on LP', 6000)
        rootState.serviceRegistry.modalService.closeModal();
        setTimeout(async () => {
          await dispatch('updateFunds');
        }, config.refreshDelay);
        throw error;
      }

      commit('setSingleAssetBalance', {asset: 'GLP', balance: 0});

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(convertRequest.targetMarketSymbol, parseFloat(gmBalanceBefore) + fromWei(minReceivedGm), true, false);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate('GLP', 0, false, true);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate('USDC', usdcBalanceBeforeParsed, false, true);


      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      rootState.serviceRegistry.modalService.closeModal();

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('network/updateBalance', {}, {root: true});
      }, 1000);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async mintCAI({state, rootState, commit, dispatch}, {mintCAIRequest}) {
      console.log('window.isMetaMask', window.isMetaMask);
      console.log('mintCAIRequest', mintCAIRequest);
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        ['CAI']
      ]);

      const assetAddress = TOKEN_ADDRESSES[mintCAIRequest.sourceAsset];
      const assetDecimals = config.ASSETS_CONFIG[mintCAIRequest.sourceAsset].decimals;
      const caiDecimals = config.ASSETS_CONFIG.CAI.decimals;

      const wrappedLoan = await wrapContract(state.smartLoanContract, loanAssets);
      console.log(wrappedLoan);
      const transaction = await wrappedLoan
        .mintCai(
          mintCAIRequest.mintData.selector,
          mintCAIRequest.mintData.data,
          assetAddress,
          parseUnits(mintCAIRequest.amount.toFixed(assetDecimals), assetDecimals),
          parseUnits(mintCAIRequest.calculatedTargetAmount.toFixed(caiDecimals), caiDecimals),
        );

      rootState.serviceRegistry.progressBarService.requestProgressBar();

      let tx = await awaitConfirmation(transaction, provider, 'mint CAI');
      // TODO take the values from the event
      // const caiMintedEvent = getLog(tx, SMART_LOAN.abi, 'CaiMinted');
      // console.log('caiMintedEvent', caiMintedEvent);
      // const caiMintedAmount = formatUnits(caiMintedEvent.args.caiBoughtAmount, caiDecimals);
      // const fromTokenAmount = formatUnits(caiMintedEvent.args.fromAmount, assetDecimals);

      const caiMintedAmount = mintCAIRequest.calculatedTargetAmount;
      const fromTokenAmount = mintCAIRequest.amount;

      const caiBalanceAfterTransaction = Number(state.assetBalances['CAI']) + Number(caiMintedAmount);
      const assetBalanceAfterTransaction = Number(state.assetBalances[mintCAIRequest.sourceAsset]) - Number(fromTokenAmount);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate('CAI', caiBalanceAfterTransaction, false, true);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(mintCAIRequest.sourceAsset, assetBalanceAfterTransaction, false, true);

      rootState.serviceRegistry.modalService.closeModal();


      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    },

    async burnCAI({state, rootState, commit, dispatch}, {burnCAIRequest}) {
      console.log('window.isMetaMask', window.isMetaMask);
      console.log('burnCAIRequest', burnCAIRequest);
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [burnCAIRequest.targetAsset]
      ]);

      const assetAddress = TOKEN_ADDRESSES[burnCAIRequest.targetAsset];
      const assetDecimals = config.ASSETS_CONFIG[burnCAIRequest.targetAsset].decimals;
      const caiDecimals = config.ASSETS_CONFIG.CAI.decimals;

      console.log(assetAddress);

      const shares = parseUnits(burnCAIRequest.amount.toFixed(caiDecimals), caiDecimals);

      const burnData = await getBurnData(
        shares,
        assetAddress,
        state.smartLoanContract.address,
        burnCAIRequest.maxSlippage
      )

      const wrappedLoan = await wrapContract(state.smartLoanContract, loanAssets);
      console.log(wrappedLoan);
      const transaction = await wrappedLoan
        .burnCai(
          burnData.selector,
          burnData.data,
          parseUnits(burnCAIRequest.amount.toFixed(caiDecimals), caiDecimals),
          assetAddress,
          parseUnits(burnCAIRequest.calculatedTargetAmount.toFixed(assetDecimals), assetDecimals),
        );

      rootState.serviceRegistry.progressBarService.requestProgressBar();

      let tx = await awaitConfirmation(transaction, provider, 'burn CAI');

      const caiBurnedAmount = burnCAIRequest.amount;
      const toTokenAmount = burnCAIRequest.calculatedTargetAmount;

      const caiBalanceAfterTransaction = Number(state.assetBalances['CAI']) - Number(caiBurnedAmount);
      const assetBalanceAfterTransaction = Number(state.assetBalances[burnCAIRequest.targetAsset]) + Number(toTokenAmount);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate('CAI', caiBalanceAfterTransaction, false, true);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(burnCAIRequest.targetAsset, assetBalanceAfterTransaction, false, true);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      rootState.serviceRegistry.modalService.closeModal();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, config.refreshDelay);
    }

  }
};
