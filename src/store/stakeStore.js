import SMART_LOAN from '../abis/SmartLoanGigaChadInterface.json';
import erc20ABI from '../abis/ERC20.json';

import {awaitConfirmation, getLog, wrapContract} from '../utils/blockchain';
import config from '../config';
import {formatUnits, parseUnits} from 'ethers/lib/utils';
import {BigNumber} from 'ethers';
import {
  beefyMaxUnstaked,
  mergeArrays,
  penpieMaxUnstaked,
  toWei,
  vectorFinanceMaxUnstaked,
  vectorFinanceRewards,
  yieldYakBalance,
  yieldYakMaxUnstaked,
} from '../utils/calculate';
import {combineLatest, map, of, from} from 'rxjs';

const ethers = require('ethers');
const fromBytes32 = ethers.utils.parseBytes32String;
const toBytes32 = ethers.utils.formatBytes32String;
const SUCCESS_DELAY_AFTER_TRANSACTION = 1000;

let TOKEN_ADDRESSES;

export default {
  namespaced: true,
  state: {
    farms: null,
  },
  mutations: {
    setFarms(state, farms) {
      state.farms = farms;
    },

    setStakedBalanceInFarm(state, stakedBalanceChange) {
      const farm = state.farms[stakedBalanceChange.assetSymbol].find(farm => farm.protocolIdentifier === stakedBalanceChange.protocolIdentifier);
      farm.totalStaked = stakedBalanceChange.totalStaked;
    },

    setReceiptTokenBalanceInFarm(state, receiptTokenBalanceChange) {
      const farm = state.farms[receiptTokenBalanceChange.assetSymbol].find(farm => farm.protocolIdentifier === receiptTokenBalanceChange.protocolIdentifier);
      farm.totalBalance = receiptTokenBalanceChange.totalBalance;
    },
  },
  actions: {
    async stakeStoreSetup({rootState, dispatch}) {
      if (!rootState.network.provider) return;
      await dispatch('loadDeployments');
    },
    async loadDeployments() {
      TOKEN_ADDRESSES = await import(`/common/addresses/${window.chain}/token_addresses.json`);
    },
    async fund({state, rootState, dispatch, commit}, {fundRequest}) {
      const provider = rootState.network.provider;
      const smartLoanContract = rootState.fundsStore.smartLoanContract;
      const amountInWei = parseUnits(fundRequest.value.toString(), fundRequest.farmDecimals);

      let assets = [
        (await smartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await smartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG)
      ];

      const loanAssets = mergeArrays(assets);

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      const fundToken = new ethers.Contract(fundRequest.receiptTokenAddress, erc20ABI, provider.getSigner());

      const allowance = formatUnits(await fundToken.allowance(rootState.network.account, rootState.fundsStore.smartLoanContract.address), fundRequest.farmDecimals);

      if (parseFloat(allowance) < parseFloat(fundRequest.value)) {
        const approveTransaction = await fundToken.connect(provider.getSigner()).approve(rootState.fundsStore.smartLoanContract.address, amountInWei);
        await awaitConfirmation(approveTransaction, provider, 'approve');
      }

      const fundTransaction = await (await wrapContract(smartLoanContract, loanAssets)).fund
      (
        toBytes32(fundRequest.farmSymbol),
        amountInWei
      );

      let tx = await awaitConfirmation(fundTransaction, provider, 'fund');
      //TODO: update after rebase
      const depositTokenAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'Funded').args.amount, fundRequest.farmDecimals);

      const farm = state.farms[fundRequest.assetSymbol].find(farm => farm.protocolIdentifier === fundRequest.protocolIdentifier);

      const totalStakedAfterTransaction = Number(farm.totalStaked) + Number(depositTokenAmount);
      await commit('setStakedBalanceInFarm', {
        assetSymbol: fundRequest.assetSymbol,
        protocolIdentifier: fundRequest.protocolIdentifier,
        totalStaked: totalStakedAfterTransaction
      });
      const totalBalanceAfterTransaction = Number(farm.totalBalance) + Number(depositTokenAmount);
      await commit('setReceiptTokenBalanceInFarm', {
        assetSymbol: fundRequest.assetSymbol,
        protocolIdentifier: fundRequest.protocolIdentifier,
        totalBalance: totalBalanceAfterTransaction
      });

      rootState.serviceRegistry.stakedExternalUpdateService
        .emitExternalStakedBalancesPerFarmUpdate(fundRequest.assetSymbol, fundRequest.protocolIdentifier, totalStakedAfterTransaction, totalBalanceAfterTransaction);

      const assetBalanceBeforeStaking =
        fundRequest.isLP ? rootState.fundsStore.lpBalances[fundRequest.assetSymbol] : rootState.fundsStore.assetBalances[fundRequest.assetSymbol];
      const assetBalanceAfterStaking = Number(assetBalanceBeforeStaking) - Number(depositTokenAmount);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(fundRequest.assetSymbol, assetBalanceAfterStaking, fundRequest.isLP, true);

      rootState.serviceRegistry.stakedExternalUpdateService
        .emitExternalTotalStakedUpdate(fundRequest.assetSymbol, depositTokenAmount, 'STAKE', true);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      rootState.serviceRegistry.farmService.emitRefreshFarm();

      setTimeout(async () => {
        await dispatch('fundsStore/updateFunds', {}, {root: true});
      }, fundRequest.refreshDelay);
    },

    async withdraw({state, rootState, dispatch, commit}, {withdrawRequest}) {
      const smartLoanContract = rootState.fundsStore.smartLoanContract;

      const amountInWei = parseUnits(withdrawRequest.value.toString(), withdrawRequest.farmDecimals);

      const loanAssets = mergeArrays([(
        await smartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await smartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        withdrawRequest.rewardTokens,
        withdrawRequest.assetSymbol,
        Object.keys(config.POOLS_CONFIG)
      ]);

      const withdrawTransaction = await (await wrapContract(smartLoanContract, loanAssets)).withdraw
      (
        toBytes32(withdrawRequest.farmSymbol),
        amountInWei
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(withdrawTransaction, provider, 'withdraw');
      const unstakedTokenAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'Withdrawn').args.amount, withdrawRequest.decimals);
      //TODO: this is simplificaton, unstaked amount is actually different
      const unstakedReceiptTokenAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'Withdrawn').args.amount, 18);

      const farm = state.farms[withdrawRequest.assetSymbol].find(farm => farm.protocolIdentifier === withdrawRequest.protocolIdentifier);

      const totalStakedAfterTransaction = withdrawRequest.isMax ? 0 : Number(farm.totalStaked) - Number(unstakedTokenAmount);
      await commit('setStakedBalanceInFarm', {
        assetSymbol: withdrawRequest.assetSymbol,
        protocolIdentifier: withdrawRequest.protocolIdentifier,
        totalStaked: totalStakedAfterTransaction
      });
      const totalBalanceAfterTransaction = withdrawRequest.isMax ? 0 : Number(farm.totalBalance) - Number(unstakedReceiptTokenAmount);
      await commit('setReceiptTokenBalanceInFarm', {
        assetSymbol: withdrawRequest.assetSymbol,
        protocolIdentifier: withdrawRequest.protocolIdentifier,
        totalBalance: totalBalanceAfterTransaction
      });

      rootState.serviceRegistry.stakedExternalUpdateService
        .emitExternalStakedBalancesPerFarmUpdate(withdrawRequest.assetSymbol, withdrawRequest.protocolIdentifier, totalStakedAfterTransaction, totalBalanceAfterTransaction);

      const assetBalanceBeforeUnstaking =
        withdrawRequest.isLP ? rootState.fundsStore.lpBalances[withdrawRequest.assetSymbol] : rootState.fundsStore.assetBalances[withdrawRequest.assetSymbol];

      const assetBalanceAfterUnstaking = Number(assetBalanceBeforeUnstaking) + Number(unstakedTokenAmount);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(withdrawRequest.assetSymbol, assetBalanceAfterUnstaking, withdrawRequest.isLP, true);

      rootState.serviceRegistry.stakedExternalUpdateService
        .emitExternalTotalStakedUpdate(withdrawRequest.assetSymbol, unstakedTokenAmount, 'WITHDRAW', true);


      //TODO: LeChiffre please check
      rootState.serviceRegistry.farmService.emitRefreshFarm();

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('fundsStore/updateFunds', {}, {root: true});
      }, withdrawRequest.refreshDelay);
    },

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
          BigNumber.from(stakeRequest.decimals.toString()))
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(stakeTransaction, provider, 'stake');
      //TODO: update after rebase
      const depositTokenAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'Staked').args.depositTokenAmount, stakeRequest.decimals);
      const receiptTokenDepositAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'Staked').args.receiptTokenAmount, 18);

      const farm = state.farms[stakeRequest.assetSymbol].find(farm => farm.protocolIdentifier === stakeRequest.protocolIdentifier);

      const totalStakedAfterTransaction = Number(farm.totalStaked) + Number(depositTokenAmount);
      await commit('setStakedBalanceInFarm', {
        assetSymbol: stakeRequest.assetSymbol,
        protocolIdentifier: stakeRequest.protocolIdentifier,
        totalStaked: totalStakedAfterTransaction
      });
      const totalBalanceAfterTransaction = Number(farm.totalBalance) + Number(receiptTokenDepositAmount);
      await commit('setReceiptTokenBalanceInFarm', {
        assetSymbol: stakeRequest.assetSymbol,
        protocolIdentifier: stakeRequest.protocolIdentifier,
        totalBalance: totalBalanceAfterTransaction
      });

      rootState.serviceRegistry.stakedExternalUpdateService
        .emitExternalStakedBalancesPerFarmUpdate(stakeRequest.assetSymbol, stakeRequest.protocolIdentifier, totalStakedAfterTransaction, totalBalanceAfterTransaction);

      const assetBalanceBeforeStaking =
        stakeRequest.isLP ? rootState.fundsStore.lpBalances[stakeRequest.assetSymbol] : rootState.fundsStore.assetBalances[stakeRequest.assetSymbol];

      //TODO: not depositTokenAmount but the underlying token amount
      const assetBalanceAfterStaking = Number(assetBalanceBeforeStaking) - Number(depositTokenAmount);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(stakeRequest.assetSymbol, assetBalanceAfterStaking, stakeRequest.isLP, true);

      rootState.serviceRegistry.stakedExternalUpdateService
        .emitExternalTotalStakedUpdate(stakeRequest.assetSymbol, depositTokenAmount, 'STAKE', true);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      //TODO: LeChiffre please check
      rootState.serviceRegistry.farmService.emitRefreshFarm();

      setTimeout(async () => {
        await dispatch('fundsStore/updateFunds', {}, {root: true});
      }, stakeRequest.refreshDelay);
    },

    async depositToWombatYY({state, rootState, dispatch, commit}, {depositRequest}) {

      const provider = rootState.network.provider;
      const smartLoanContract = rootState.fundsStore.smartLoanContract;

      if (depositRequest.requireApproval) {
        const tokenForApprove = TOKEN_ADDRESSES[depositRequest.sourceAsset];
        const fundToken = new ethers.Contract(tokenForApprove, erc20ABI, provider.getSigner());
        const allowance = formatUnits(await fundToken.allowance(rootState.network.account, smartLoanContract.address), depositRequest.decimals);

        if (parseFloat(allowance) < parseFloat(depositRequest.amount)) {
          const approveTransaction = await fundToken.connect(provider.getSigner()).approve(smartLoanContract.address, toWei(depositRequest.amount.toString()));
          await awaitConfirmation(approveTransaction, provider, 'approve');
        }
      }


      let assets = [
        (await smartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await smartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [depositRequest.lpAssetToken]
      ];

      const loanAssets = mergeArrays(assets);

      const depositTransaction = depositRequest.minLpOut ? await (await wrapContract(smartLoanContract, loanAssets))[depositRequest.depositMethod]
      (
        parseUnits(String(depositRequest.amount),
          BigNumber.from(depositRequest.decimals.toString())),
        parseUnits(String(depositRequest.minLpOut),
          BigNumber.from(depositRequest.decimals.toString())),
        depositRequest.forceTransaction ? {gasLimit: 9999999} : {}
      ) : await (await wrapContract(smartLoanContract, loanAssets))[depositRequest.depositMethod]
      (
        parseUnits(String(depositRequest.amount),
          BigNumber.from(depositRequest.decimals.toString())),
        depositRequest.forceTransaction ? {gasLimit: 9999999} : {}
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();
      let tx = await awaitConfirmation(depositTransaction, provider, 'deposit');
      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('fundsStore/updateFunds', {}, {root: true});
      }, config.refreshDelay);
    },

    async withdrawFromWombatYY({state, rootState, dispatch, commit}, {withdrawRequest}) {

      const provider = rootState.network.provider;
      const smartLoanContract = rootState.fundsStore.smartLoanContract;

      let assets = [
        (await smartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await smartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG)
      ];

      const loanAssets = mergeArrays(assets);

      const withdrawTransaction = withdrawRequest.minOut ? await (await wrapContract(smartLoanContract, loanAssets))[withdrawRequest.withdrawMethod]
      (
        parseUnits(String(withdrawRequest.amount),
          BigNumber.from(withdrawRequest.decimals.toString())),
        parseUnits(String(withdrawRequest.minOut),
          BigNumber.from(withdrawRequest.decimals.toString())),
      ) : await (await wrapContract(smartLoanContract, loanAssets))[withdrawRequest.withdrawMethod]
      (
        parseUnits(String(withdrawRequest.amount),
          BigNumber.from(withdrawRequest.decimals.toString())),
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();
      let tx = await awaitConfirmation(withdrawTransaction, provider, 'withdraw');

      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('fundsStore/updateFunds', {}, {root: true});
      }, config.refreshDelay);
    },

    async migrateWombatToYY({state, rootState, dispatch, commit}, {migrateRequest}) {

      const provider = rootState.network.provider;
      const smartLoanContract = rootState.fundsStore.smartLoanContract;

      let assets = [
        (await smartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await smartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG)
      ];

      const loanAssets = mergeArrays(assets);

      const migrateTransaction = await (await wrapContract(smartLoanContract, loanAssets))[migrateRequest.migrateMethod]()

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();
      let tx = await awaitConfirmation(migrateTransaction, provider, 'migrate');

      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('fundsStore/updateFunds', {}, {root: true});
      }, config.refreshDelay);
    },

    async unstake({state, rootState, dispatch, commit}, {unstakeRequest}) {
      const smartLoanContract = rootState.fundsStore.smartLoanContract;

      const loanAssets = mergeArrays([(
        await smartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await smartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        unstakeRequest.rewardTokens,
        unstakeRequest.assetSymbol,
        Object.keys(config.POOLS_CONFIG)
      ]);

      const unstakeTransaction = unstakeRequest.minReceiptTokenUnstaked ?
        await (await wrapContract(smartLoanContract, loanAssets))[unstakeRequest.method](
          parseUnits(parseFloat(unstakeRequest.receiptTokenUnstaked).toFixed(unstakeRequest.decimals), BigNumber.from(unstakeRequest.decimals.toString())),
          parseUnits(parseFloat(unstakeRequest.minReceiptTokenUnstaked).toFixed(unstakeRequest.decimals), BigNumber.from(unstakeRequest.decimals.toString())))
        :
        await (await wrapContract(smartLoanContract, loanAssets))[unstakeRequest.method](
          parseUnits(parseFloat(unstakeRequest.receiptTokenUnstaked).toFixed(unstakeRequest.decimals), BigNumber.from(unstakeRequest.decimals.toString())));

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(unstakeTransaction, provider, 'unstake');
      const unstakedTokenAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'Unstaked').args.depositTokenAmount, unstakeRequest.decimals);
      const unstakedReceiptTokenAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'Unstaked').args.receiptTokenAmount, 18);

      const farm = state.farms[unstakeRequest.assetSymbol].find(farm => farm.protocolIdentifier === unstakeRequest.protocolIdentifier);

      const totalStakedAfterTransaction = unstakeRequest.isMax ? 0 : Number(farm.totalStaked) - Number(unstakedTokenAmount);
      await commit('setStakedBalanceInFarm', {
        assetSymbol: unstakeRequest.assetSymbol,
        protocolIdentifier: unstakeRequest.protocolIdentifier,
        totalStaked: totalStakedAfterTransaction
      });
      const totalBalanceAfterTransaction = unstakeRequest.isMax ? 0 : Number(farm.totalBalance) - Number(unstakedReceiptTokenAmount);
      await commit('setReceiptTokenBalanceInFarm', {
        assetSymbol: unstakeRequest.assetSymbol,
        protocolIdentifier: unstakeRequest.protocolIdentifier,
        totalBalance: totalBalanceAfterTransaction
      });

      rootState.serviceRegistry.stakedExternalUpdateService
        .emitExternalStakedBalancesPerFarmUpdate(unstakeRequest.assetSymbol, unstakeRequest.protocolIdentifier, totalStakedAfterTransaction, totalBalanceAfterTransaction);

      const assetBalanceBeforeUnstaking =
        unstakeRequest.isLP ? rootState.fundsStore.lpBalances[unstakeRequest.assetSymbol] : rootState.fundsStore.assetBalances[unstakeRequest.assetSymbol];

      const assetBalanceAfterUnstaking = Number(assetBalanceBeforeUnstaking) + Number(unstakedTokenAmount);
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(unstakeRequest.assetSymbol, assetBalanceAfterUnstaking, unstakeRequest.isLP, true);

      rootState.serviceRegistry.stakedExternalUpdateService
        .emitExternalTotalStakedUpdate(unstakeRequest.assetSymbol, unstakedTokenAmount, 'UNSTAKE', true);


      //TODO: LeChiffre please check
      rootState.serviceRegistry.farmService.emitRefreshFarm();

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('fundsStore/updateFunds', {}, {root: true});
      }, unstakeRequest.refreshDelay);
    },

    async migrateToAutoCompoundingPool({rootState, state, commit}, {migrateRequest}) {
      const smartLoanContract = rootState.fundsStore.smartLoanContract;
      const loanAssets = mergeArrays([(
        await smartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await smartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG)
      ]);

      const migrateTransaction = await (await wrapContract(smartLoanContract, loanAssets))[migrateRequest.migrateMethod]();

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(migrateTransaction, provider, 'migrate');

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      const migratedTokenAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'Migrated').args.migratedAmount, migrateRequest.decimals);

      const migratedReceiptTokenAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'Migrated').args.migratedAmount, 18);

      const migrationSourceFarm = state.farms[migrateRequest.assetSymbol].find(farm => farm.protocolIdentifier === migrateRequest.protocolIdentifier);
      const migrationTargetFarm = state.farms[migrateRequest.assetSymbol].find(farm => farm.protocolIdentifier === migrationSourceFarm.migrateToProtocolIdentifier);

      const totalStakedAfterTransactionInMigrationSourceProtocol = Number(migrationSourceFarm.totalStaked) - Number(migratedTokenAmount);
      const totalStakedAfterTransactionInMigrationTargetProtocol = Number(migrationTargetFarm.totalStaked) + Number(migratedTokenAmount);

      await commit('setStakedBalanceInFarm', {
        assetSymbol: migrateRequest.assetSymbol,
        protocolIdentifier: migrationSourceFarm.protocolIdentifier,
        totalStaked: totalStakedAfterTransactionInMigrationSourceProtocol
      });

      await commit('setStakedBalanceInFarm', {
        assetSymbol: migrateRequest.assetSymbol,
        protocolIdentifier: migrationTargetFarm.protocolIdentifier,
        totalStaked: totalStakedAfterTransactionInMigrationTargetProtocol
      });


      const totalBalanceAfterTransactionInMigrationSourceProtocol = Number(migrationSourceFarm.totalBalance) - Number(migratedTokenAmount);
      const totalBalanceAfterTransactionInMigrationTargetProtocol = Number(migrationTargetFarm.totalBalance) + Number(migratedTokenAmount);

      await commit('setReceiptTokenBalanceInFarm', {
        assetSymbol: migrateRequest.assetSymbol,
        protocolIdentifier: migrationSourceFarm.protocolIdentifier,
        totalBalance: totalBalanceAfterTransactionInMigrationSourceProtocol
      });

      await commit('setReceiptTokenBalanceInFarm', {
        assetSymbol: migrateRequest.assetSymbol,
        protocolIdentifier: migrationTargetFarm.protocolIdentifier,
        totalBalance: totalBalanceAfterTransactionInMigrationTargetProtocol
      });

      rootState.serviceRegistry.stakedExternalUpdateService
        .emitExternalStakedBalancesPerFarmUpdate(
          migrateRequest.assetSymbol,
          migrationSourceFarm.protocolIdentifier,
          totalStakedAfterTransactionInMigrationSourceProtocol,
          totalBalanceAfterTransactionInMigrationSourceProtocol
        );

      rootState.serviceRegistry.stakedExternalUpdateService
        .emitExternalStakedBalancesPerFarmUpdate(
          migrateRequest.assetSymbol,
          migrationTargetFarm.protocolIdentifier,
          totalStakedAfterTransactionInMigrationTargetProtocol,
          totalBalanceAfterTransactionInMigrationTargetProtocol
        );
    },

    async updateStakedBalances({rootState, state, commit}) {
      console.warn('______________updateStakedBalances____________');
      const smartLoanContract = rootState.fundsStore.smartLoanContract;
      const readSmartLoanContract = rootState.fundsStore.readSmartLoanContract;

      const farmService = rootState.serviceRegistry.farmService;
      let farms;
      if (!state.farms) {
        farms = config.FARMED_TOKENS_CONFIG;
      } else {
        farms = state.farms;
      }

      const apys = rootState.fundsStore.apys;

      const loanAssets = mergeArrays([(
        await readSmartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await readSmartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG)
      ]);

      const wrappedSmartLoanContract = await wrapContract(smartLoanContract, loanAssets);
      const smartLoanContractAddress = rootState.fundsStore.smartLoanContract.address;

      if (Object.values(config.FARMED_TOKENS_CONFIG).length == 0) {
        rootState.serviceRegistry.healthService.emitRefreshHealth();
        farmService.emitRefreshFarm();
      } else {
        combineLatest(
          Object.values(config.FARMED_TOKENS_CONFIG).map(tokenFarms => {
            console.log(tokenFarms);
            console.log(tokenFarms.balanceMethod);
            return combineLatest(tokenFarms.map(farm => {
              const assetDecimals = config.ASSETS_CONFIG[farm.token] ? config.ASSETS_CONFIG[farm.token].decimals : 18;
              return combineLatest([
                of(farm.token),
                of(farm.protocolIdentifier),
                of(farm.protocol),
                farm.balanceMethod ? from(wrappedSmartLoanContract[farm.balanceMethod]())
                  .pipe(map(balanceWei => formatUnits(balanceWei, assetDecimals))) : farm.balance(smartLoanContractAddress),
                of((apys && apys[farm.token]) ? apys[farm.token][farm.protocolIdentifier] : 0),
                farm.stakingContractAddress.toLowerCase() === '0xb8f531c0d3c53B1760bcb7F57d87762Fd25c4977'.toLowerCase() ? yieldYakBalance(farm.stakingContractAddress, smartLoanContractAddress, assetDecimals) :
                  farm.protocol === 'YIELD_YAK' ? yieldYakMaxUnstaked(farm.stakingContractAddress, smartLoanContractAddress, assetDecimals, 'from stakeStore') :
                    farm.protocol === 'BEEFY_FINANCE' ? beefyMaxUnstaked(farm.stakingContractAddress, smartLoanContractAddress, assetDecimals) :
                      farm.protocol === 'PENPIE' ? penpieMaxUnstaked(farm.stakingContractAddress, smartLoanContractAddress, assetDecimals) :
                        farm.autoCompounding ? vectorFinanceMaxUnstaked(farm.token, farm.stakingContractAddress, smartLoanContractAddress) :
                          vectorFinanceRewards(farm.stakingContractAddress, smartLoanContractAddress)
              ]);
            }));
          })
        ).subscribe(farmsDataPerToken => {
          const farmsDataPerFarm = farmsDataPerToken.flat();

          Object.values(config.FARMED_TOKENS_CONFIG).forEach(tokenFarms => {
            console.log(tokenFarms);
            tokenFarms.forEach(farm => {
              const farmData = farmsDataPerFarm.find(data => data[1] === farm.protocolIdentifier);
              farm.totalBalance = farmData[3];
              farm.currentApy = farmData[4];

              if (['YIELD_YAK', 'BEEFY_FINANCE'].includes(farm.protocol)) {
                farm.totalStaked = farmData[5];
                if (farm.stakingContractAddress.toLowerCase() === '0xb8f531c0d3c53B1760bcb7F57d87762Fd25c4977'.toLowerCase()) farm.totalStaked *= 0;
              } else if (farm.protocol === 'VECTOR_FINANCE') {
                if (farm.autoCompounding) {
                  farm.totalStaked = farmData[5];

                  if (farm.protocolIdentifier === 'VF_SAVAX_MAIN_AUTO') {
                    farm.totalBalance = farm.totalStaked;
                  }

                } else {
                  farm.rewards = farmData[5];
                  farm.totalStaked = farm.totalBalance;
                }
              }
            });
          });
          farmService.emitRefreshFarm();
          commit('setFarms', farms);
          farmService.emitRefreshFarm();
          farmService.emitFarms(farms);
          rootState.serviceRegistry.healthService.emitRefreshHealth();
        });
      }
    },

    async updateStakedPrices({state, rootState, commit}) {
      //TODO: optimize, it's used in other place as well
      const redstonePriceDataRequest = await fetch(config.redstoneFeedUrl);
      const redstonePriceData = await redstonePriceDataRequest.json();

      let farms;
      if (!state.farms) {
        farms = config.FARMED_TOKENS_CONFIG;
      } else {
        farms = state.farms;
      }
      for (const [symbol, tokenFarms] of Object.entries(farms)) {
        const asset = rootState.fundsStore.assets[symbol] ?
          rootState.fundsStore.assets[symbol]
          :
          rootState.fundsStore.lpAssets[symbol];

        if (asset) {
          for (let farm of tokenFarms) {
            try {
              let feedSymbol = farm.feedSymbol ? farm.feedSymbol : symbol;

              farm.price = redstonePriceData[feedSymbol] ? redstonePriceData[feedSymbol][0].dataPoints[0].value : 0;
            } catch (e) {
              console.log('farm price error');
            }

          }
        }
      }
      commit('setFarms', farms);
    },
  }
};
