import {awaitConfirmation, getLog, wrapContract} from '../utils/blockchain';
import config from '../config';
import {formatUnits, parseUnits} from 'ethers/lib/utils';
import {BigNumber} from 'ethers';
import {fromWei, mergeArrays, vectorFinanceRewards, yieldYakStaked} from '../utils/calculate';
import SMART_LOAN from '@artifacts/contracts/interfaces/SmartLoanGigaChadInterface.sol/SmartLoanGigaChadInterface.json';

const fromBytes32 = require('ethers').utils.parseBytes32String;
const SUCCESS_DELAY_AFTER_TRANSACTION = 1000;

export default {
  namespaced: true,
  state: {
    farms: config.FARMED_TOKENS_CONFIG,
  },
  mutations: {
    setFarms(state, farms) {
      console.log('STAKE STORE FARMS +++++++');
      console.log(farms);
      state.farms = farms;
    },

    setStakedBalanceInFarm(state, stakedBalanceChange) {
      const farm = state.farms[stakedBalanceChange.assetSymbol].find(farm => farm.protocol === stakedBalanceChange.protocol);
      console.log('found farm', farm);
      farm.totalStaked = stakedBalanceChange.totalStaked;
    },

    setReceiptTokenBalanceInFarm(state, receiptTokenBalanceChange) {
      const farm = state.farms[receiptTokenBalanceChange.assetSymbol].find(farm => farm.protocol === receiptTokenBalanceChange.protocol);
      console.log('found farm', farm);
      farm.totalBalance = receiptTokenBalanceChange.totalBalance;
    },
  },
  actions: {

    //TODO: stakeRequest
    async stake({state, rootState, dispatch, commit}, {stakeRequest}) {

      const provider = rootState.network.provider;
      const smartLoanContract = rootState.fundsStore.smartLoanContract;

      let assets = [
        (await smartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await smartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG)
      ];

      if (stakeRequest.feedSymbol) assets.push([stakeRequest.feedSymbol]);

      const loanAssets = mergeArrays(assets);

      const stakeTransaction = await (await wrapContract(smartLoanContract, loanAssets))[stakeRequest.method]
      (
        parseUnits(String(stakeRequest.amount),
          BigNumber.from(stakeRequest.decimals.toString())),
        {gasLimit: stakeRequest.gas ? stakeRequest.gas : 8000000}
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(stakeTransaction, provider, 'stake');
      //TODO: update after rebase
      const depositTokenAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'Staked').args.depositTokenAmount, stakeRequest.decimals);
      console.log('depositTokenAmount', depositTokenAmount); //how much of token was staked
      const receiptTokenDepositAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'Staked').args.receiptTokenAmount, 18);
      console.log('receiptTokenDepositAmount', receiptTokenDepositAmount); //how much of vault token was obtained

      const farm = state.farms[stakeRequest.assetSymbol].find(farm => farm.protocol === stakeRequest.protocol);
      console.log(farm);

      const totalStakedAfterTransaction = Number(farm.totalStaked) + Number(depositTokenAmount);
      await commit('setStakedBalanceInFarm', {
        assetSymbol: stakeRequest.assetSymbol,
        protocol: stakeRequest.protocol,
        totalStaked: totalStakedAfterTransaction
      });
      const totalBalanceAfterTransaction = Number(farm.totalBalance) + Number(receiptTokenDepositAmount);
      await commit('setReceiptTokenBalanceInFarm', {
        assetSymbol: stakeRequest.assetSymbol,
        protocol: stakeRequest.protocol,
        totalBalance: totalBalanceAfterTransaction
      });

      rootState.serviceRegistry.stakedExternalUpdateService
        .emitExternalStakedBalancesPerFarmUpdate(stakeRequest.assetSymbol, stakeRequest.protocol, totalStakedAfterTransaction, totalBalanceAfterTransaction);

      const assetBalanceBeforeStaking =
        stakeRequest.isLP ? rootState.fundsStore.lpBalances[stakeRequest.assetSymbol] : rootState.fundsStore.assetBalances[stakeRequest.assetSymbol];
      const assetBalanceAfterStaking = Number(assetBalanceBeforeStaking) - Number(depositTokenAmount);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(stakeRequest.assetSymbol, assetBalanceAfterStaking, stakeRequest.isLP, true);

      rootState.serviceRegistry.stakedExternalUpdateService
        .emitExternalTotalStakedUpdate(stakeRequest.assetSymbol, depositTokenAmount, 'STAKE', true);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('fundsStore/updateFunds', {}, {root: true});
      }, stakeRequest.refreshDelay);
    },

    async unstake({state, rootState, dispatch, commit}, {unstakeRequest}) {
      const smartLoanContract = rootState.fundsStore.smartLoanContract;

      console.log('unstakeRequest')
      console.log(unstakeRequest)

      const loanAssets = mergeArrays([(
        await smartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await smartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        unstakeRequest.rewardTokens,
        unstakeRequest.assetSymbol,
        Object.keys(config.POOLS_CONFIG)
      ]);



      console.log('loanAssets')
      console.log(loanAssets)

      const unstakeTransaction = unstakeRequest.minUnderlyingTokenUnstaked ?
        await (await wrapContract(smartLoanContract, loanAssets))[unstakeRequest.method](
          parseUnits(parseFloat(unstakeRequest.underlyingTokenUnstaked).toFixed(unstakeRequest.decimals), BigNumber.from(unstakeRequest.decimals.toString())),
          parseUnits(parseFloat(unstakeRequest.minUnderlyingTokenUnstaked).toFixed(unstakeRequest.decimals), BigNumber.from(unstakeRequest.decimals.toString())),
          {gasLimit: unstakeRequest.gas ? unstakeRequest.gas : 8000000})
        :
        await (await wrapContract(smartLoanContract, loanAssets))[unstakeRequest.method](
            parseUnits(parseFloat(unstakeRequest.underlyingTokenUnstaked).toFixed(unstakeRequest.decimals), BigNumber.from(unstakeRequest.decimals.toString())),
            {gasLimit: unstakeRequest.gas ? unstakeRequest.gas : 8000000});

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(unstakeTransaction, provider, 'unstake');
      const unstakedTokenAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'Unstaked').args.depositTokenAmount, unstakeRequest.decimals);
      console.log(unstakedTokenAmount); //how much of token was unstaked
      const unstakedReceiptTokenAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'Unstaked').args.receiptTokenAmount, 18);
      console.log(unstakedReceiptTokenAmount); //how much of vault token was used (unstaked/burned)

      const farm = state.farms[unstakeRequest.assetSymbol].find(farm => farm.protocol === unstakeRequest.protocol);

      const totalStakedAfterTransaction = unstakeRequest.isMax ? 0 : Number(farm.totalStaked) - Number(unstakedTokenAmount);
      await commit('setStakedBalanceInFarm', {
        assetSymbol: unstakeRequest.assetSymbol,
        protocol: unstakeRequest.protocol,
        totalStaked: totalStakedAfterTransaction
      });
      const totalBalanceAfterTransaction = unstakeRequest.isMax ? 0 : Number(farm.totalBalance) - Number(unstakedReceiptTokenAmount);
      await commit('setReceiptTokenBalanceInFarm', {
        assetSymbol: unstakeRequest.assetSymbol,
        protocol: unstakeRequest.protocol,
        totalBalance: totalBalanceAfterTransaction
      });

      rootState.serviceRegistry.stakedExternalUpdateService
        .emitExternalStakedBalancesPerFarmUpdate(unstakeRequest.assetSymbol, unstakeRequest.protocol, totalStakedAfterTransaction, totalBalanceAfterTransaction);

      const assetBalanceBeforeUnstaking =
        unstakeRequest.isLP ? rootState.fundsStore.lpBalances[unstakeRequest.assetSymbol] : rootState.fundsStore.assetBalances[unstakeRequest.assetSymbol];

      const assetBalanceAfterUnstaking = Number(assetBalanceBeforeUnstaking) + Number(unstakedTokenAmount);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(unstakeRequest.assetSymbol, assetBalanceAfterUnstaking, unstakeRequest.isLP, true);

      rootState.serviceRegistry.stakedExternalUpdateService
        .emitExternalTotalStakedUpdate(unstakeRequest.assetSymbol, unstakedTokenAmount, 'UNSTAKE', true);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('fundsStore/updateFunds', {}, {root: true});
      }, unstakeRequest.refreshDelay);
    },

    async updateStakedBalances({rootState, state, commit}) {
      const farmService = rootState.serviceRegistry.farmService;
      let farms = state.farms;

      const stakedInYieldYak = await yieldYakStaked(rootState.fundsStore.smartLoanContract.address);

      for (const [symbol, tokenFarms] of Object.entries(config.FARMED_TOKENS_CONFIG)) {
        for (let farm of tokenFarms) {
          farm.totalBalance = await farm.balance(rootState.fundsStore.smartLoanContract.address);
          try {
            farm.currentApy = await farm.apy();
          } catch(e) {
            console.log('Error fetching farm APY');
          }

          if (farm.protocol === 'YIELD_YAK') {
            const token = farm.isTokenLp ? config.LP_ASSETS_CONFIG[farm.token] : config.ASSETS_CONFIG[farm.token]
            const decimals = token.decimals;
            farm.totalStaked = formatUnits(stakedInYieldYak[farm.feedSymbol], decimals);

            farm.rewards = farm.totalBalance * farm.price - farm.totalStaked * token.price;
          } else if (farm.protocol === 'VECTOR_FINANCE') {
            farm.totalStaked = farm.totalBalance;
            farm.rewards = await vectorFinanceRewards(farm.stakingContractAddress, rootState.fundsStore.smartLoanContract.address);
          }
        }
      }

      farmService.emitRefreshFarm();

      commit('setFarms', farms);

      farmService.emitRefreshFarm();
    },

    async updateStakedPrices({state, rootState, commit}) {
      //TODO: optimize, it's used in other place as well
      const redstonePriceDataRequest = await fetch('https://oracle-gateway-1.a.redstone.finance/data-packages/latest/redstone-avalanche-prod');
      const redstonePriceData = await redstonePriceDataRequest.json();

      let farms = state.farms;
      for (const [symbol, tokenFarms] of Object.entries(farms)) {
        const asset = rootState.fundsStore.assets[symbol] ?
            rootState.fundsStore.assets[symbol]
            :
            rootState.fundsStore.lpAssets[symbol];

        if (asset) {
          for (let farm of tokenFarms) {
            let feedSymbol = farm.feedSymbol ? farm.feedSymbol : symbol;

            farm.price = redstonePriceData[feedSymbol][0].dataPoints[0].value;
          }
        }
      }
      commit('setFarms', farms);
    },
  }
};
