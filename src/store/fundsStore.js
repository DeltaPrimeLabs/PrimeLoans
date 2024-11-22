import {
  awaitConfirmation,
  isOracleError,
  signMessage,
  loanTermsToSign,
  wrapContract, getLog
} from '../utils/blockchain';
import SMART_LOAN from '@artifacts/contracts/interfaces/SmartLoanGigaChadInterface.sol/SmartLoanGigaChadInterface.json';
import DIAMOND_BEACON from '@contracts/SmartLoanDiamondBeacon.json';
import SMART_LOAN_FACTORY_TUP from '@contracts/SmartLoansFactoryTUP.json';
import SMART_LOAN_FACTORY from '@contracts/SmartLoansFactory.json';
import TOKEN_MANANGER from '@contracts/TokenManager.json';
import TOKEN_MANANGER_TUP from '@contracts/TokenManagerTUP.json';
import {formatUnits, fromWei, parseUnits, toWei} from '@/utils/calculate';
import config from '@/config';
import redstone from 'redstone-api';
import {BigNumber, utils} from 'ethers';
import TOKEN_ADDRESSES from '../../common/addresses/avax/token_addresses.json';
import {mergeArrays, removePaddedTrailingZeros} from '../utils/calculate';
import wavaxAbi from '../../test/abis/WAVAX.json';
import erc20ABI from '../../test/abis/ERC20.json';
import router from '@/router'


const toBytes32 = require('ethers').utils.formatBytes32String;
const fromBytes32 = require('ethers').utils.parseBytes32String;

const ethers = require('ethers');

const wavaxTokenAddress = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';
const usdcTokenAddress = '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e';

const tokenAddresses = TOKEN_ADDRESSES;

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

const SUCCESS_DELAY_AFTER_TRANSACTION = 1000;
const HARD_REFRESH_DELAY = 60000;

export default {
  namespaced: true,
  state: {
    assets: null,
    lpAssets: null,
    supportedAssets: null,
    provider: null,
    smartLoanContract: null,
    smartLoanFactoryContract: null,
    wavaxTokenContract: null,
    usdcTokenContract: null,
    assetBalances: null,
    lpBalances: null,
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
  },
  mutations: {
    setSmartLoanContract(state, smartLoanContract) {
      state.smartLoanContract = smartLoanContract;
    },

    setAssets(state, assets) {
      state.assets = assets;
    },

    setLpAssets(state, assets) {
      state.lpAssets = assets;
    },

    setSupportedAssets(state, assets) {
      state.supportedAssets = assets;
    },

    setSmartLoanFactoryContract(state, smartLoanFactoryContract) {
      state.smartLoanFactoryContract = smartLoanFactoryContract;
    },

    setWavaxTokenContract(state, wavaxTokenContract) {
      state.wavaxTokenContract = wavaxTokenContract;
    },

    setUsdcTokenContract(state, usdcTokenContract) {
      state.usdcTokenContract = usdcTokenContract;
    },

    setAssetBalances(state, assetBalances) {
      state.assetBalances = assetBalances;
    },

    setSingleAssetBalance(state, assetBalanceChange) {
      console.log('fundsStore.setSingleAssetBalance', assetBalanceChange.asset, assetBalanceChange.balance);
      state.assetBalances[assetBalanceChange.asset] = assetBalanceChange.balance;
    },

    setLpBalances(state, lpBalances) {
      state.lpBalances = lpBalances;
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
      console.log('fundsStore.setSingleAssetDebt', assetDebtChange.asset, assetDebtChange.debt);
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

    async getAccountApr(state, getters, rootState, commit){
      let apr = 0;
      let yearlyDebtInterest = 0;


      let yearlyAssetInterest = 0
      if (state.assets && state.assetBalances) {
        for (let entry of Object.entries(state.assets)) {
          let symbol = entry[0];
          let asset = entry[1];
          let assetAppretiation = symbol === 'sAVAX' ? 1.072 : 1;

          yearlyAssetInterest += parseFloat(state.assetBalances[symbol]) * (assetAppretiation - 1) * asset.price;
        }
      }

      if (rootState.poolStore.pools && state.debtsPerAsset) {
        Object.entries(state.debtsPerAsset).forEach(
          ([symbol, debt]) => {
            yearlyDebtInterest += parseFloat(debt.debt) * rootState.poolStore.pools.find(pool => pool.asset.symbol === symbol).borrowingAPY * state.assets[symbol].price;
          }
        );

        let yearlyLpInterest = 0;

        if (state.lpAssets && state.lpBalances) {
          for (let entry of Object.entries(state.lpAssets)) {
            let symbol = entry[0]
            let lpAsset = entry[1]

            //TODO: take from API
            let assetAppretiation = symbol.includes('sAVAX') ? 1 + 0.072 / 2 : 1;
            yearlyLpInterest += parseFloat(state.lpBalances[symbol]) * (((1 + await lpAsset.apr()) * assetAppretiation) - 1) * lpAsset.price;
          }
        }

        let yearlyFarmInterest = 0;

        if (rootState.stakeStore.farms) {
          for (let entry of Object.entries(rootState.stakeStore.farms)) {
            let symbol = entry[0];
            let farms = entry[1];

            for (let farm of farms) {

              let assetAppretiation;

              if (symbol.includes('sAVAX')) {
                if (symbol === 'sAVAX') {
                  assetAppretiation = 1.072;
                } else {
                  assetAppretiation = 1 + 0.072 / 2;
                }
              } else {
                assetAppretiation = 1;
              }

              let apy = 0;

              try {
                apy = await farm.apy();
              } catch(e) {
                console.log('apy')
              }

              yearlyFarmInterest += parseFloat(farm.totalBalance) * (((1 + apy) * assetAppretiation) - 1) * farm.price;

            }
          }
        }

        const collateral = getters.getCollateral;

        if (collateral) {
          apr = (yearlyLpInterest + yearlyFarmInterest + yearlyAssetInterest - yearlyDebtInterest) / collateral;
        }
        console.log('APR:', apr);
        return apr;
      }
    }
  },

  actions: {
    async fundsStoreSetup({state, rootState, dispatch, commit}) {
      if (!rootState.network.provider) return;
      await dispatch('setupContracts');
      await dispatch('setupSmartLoanContract');
      await dispatch('setupSupportedAssets');
      await dispatch('setupAssets');
      await dispatch('setupLpAssets');
      await dispatch('stakeStore/updateStakedPrices', null, {root: true});
      state.assetBalances = [];

      const diamond = new ethers.Contract(DIAMOND_BEACON.address, DIAMOND_BEACON.abi, provider.getSigner());
      let isActive = await diamond.getStatus();
      await commit('setProtocolPaused', !isActive);

      if (state.smartLoanContract.address !== NULL_ADDRESS) {
        state.assetBalances = null;
        await dispatch('getAllAssetsBalances');
        await dispatch('stakeStore/updateStakedBalances', null, {root: true});
        await dispatch('getDebtsPerAsset');
        rootState.serviceRegistry.aprService.emitRefreshApr();
        try {
          await dispatch('getFullLoanStatus');
        } catch (e) {
          if (isOracleError(e)) await commit('setOracleError', true);
        }

        commit('setNoSmartLoan', false);
      } else {
        commit('setNoSmartLoan', true);
      }
      rootState.serviceRegistry.healthService.emitRefreshHealth();
    },

    async updateFunds({state, dispatch, commit, rootState}) {
      try {
        if (state.smartLoanContract.address !== NULL_ADDRESS) {
          commit('setNoSmartLoan', false);
        }
        await dispatch('setupAssets');
        await dispatch('setupLpAssets');
        await dispatch('getAllAssetsBalances');
        await dispatch('getDebtsPerAsset');
        await dispatch('getFullLoanStatus');
        await dispatch('stakeStore/updateStakedBalances', null, {root: true});
        rootState.serviceRegistry.aprService.emitRefreshApr();
        rootState.serviceRegistry.healthService.emitRefreshHealth();
        setTimeout(async () => {
          await dispatch('getFullLoanStatus');
        }, 5000);
      } catch (error) {
        // console.error(error);
        // console.error('ERROR DURING UPDATE FUNDS');
        // console.log('refreshing page in 5s');
        // setTimeout(() => {
        //   window.location.reload();
        // }, 5000);
      }
    },


    async setupSupportedAssets({commit}) {
      const tokenManager = new ethers.Contract(TOKEN_MANANGER_TUP.address, TOKEN_MANANGER.abi, provider.getSigner());
      const whiteListedTokenAddresses = await tokenManager.getSupportedTokensAddresses();

      const supported = whiteListedTokenAddresses.map(address => Object.keys(tokenAddresses).find(symbol => tokenAddresses[symbol].toLowerCase() === address.toLowerCase()));

      commit('setSupportedAssets', supported);
    },

    async setupAssets({state, commit, rootState}) {
      const nativeToken = Object.entries(config.ASSETS_CONFIG).find(asset => asset[0] === config.nativeToken);

      let assets = {};
      assets[nativeToken[0]] = nativeToken[1];

      Object.values(config.ASSETS_CONFIG).forEach(
        asset => {
          if (state.supportedAssets.includes(asset.symbol)) {
            assets[asset.symbol] = asset;
          }
        }
      );

      await redstone.getPrice(Object.keys(assets)).then(prices => {
        Object.keys(assets).forEach(assetSymbol => {
          assets[assetSymbol].price = prices[assetSymbol].value;
        });
      });
      commit('setAssets', assets);
      console.log('set assets')

      rootState.serviceRegistry.priceService.emitRefreshPrices();
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

      await redstone.getPrice(Object.keys(lpTokens)).then(prices => {
        Object.keys(lpTokens).forEach(async assetSymbol => {
          lpTokens[assetSymbol].price = prices[assetSymbol].value;
          lpTokens[assetSymbol].currentApr = await lpTokens[assetSymbol].apr();
          lpService.emitRefreshLp();
        });
      });
      commit('setLpAssets', lpTokens);
    },

    async setupContracts({rootState, commit}) {
      const provider = rootState.network.provider;

      const smartLoanFactoryContract = new ethers.Contract(SMART_LOAN_FACTORY_TUP.address, SMART_LOAN_FACTORY.abi, provider.getSigner());
      const wavaxTokenContract = new ethers.Contract(wavaxTokenAddress, wavaxAbi, provider.getSigner());
      const usdcTokenContract = new ethers.Contract(usdcTokenAddress, erc20ABI, provider.getSigner());

      commit('setSmartLoanFactoryContract', smartLoanFactoryContract);
      commit('setWavaxTokenContract', wavaxTokenContract);
      commit('setUsdcTokenContract', usdcTokenContract);
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

      commit('setSmartLoanContract', smartLoanContract);
    },

    async createLoan({state, rootState}) {
      const provider = rootState.network.provider;

      if (!(await signMessage(provider, loanTermsToSign, rootState.network.account))) return;

      const transaction = (await wrapContract(state.smartLoanFactoryContract)).createLoan({gasLimit: 8000000});

      await awaitConfirmation(transaction, provider, 'createLoan');
    },

    async createAndFundLoan({state, rootState, commit, dispatch}, {asset, value}) {
      const provider = rootState.network.provider;

      if (!(await signMessage(provider, loanTermsToSign, rootState.network.account))) return;

      //TODO: make it more robust
      if (asset === 'AVAX') {
        asset = config.ASSETS_CONFIG['AVAX'];
        let depositTransaction = await state.wavaxTokenContract.deposit({value: toWei(String(value))});
        await awaitConfirmation(depositTransaction, provider, 'deposit');
      }

      if (asset === 'WAVAX') {
        asset = config.ASSETS_CONFIG['AVAX'];
      }

      const decimals = config.ASSETS_CONFIG[asset.symbol].decimals;
      const amount = parseUnits(String(value), decimals);
      const fundTokenContract = new ethers.Contract(tokenAddresses[asset.symbol], erc20ABI, provider.getSigner());

      const allowance = formatUnits(await fundTokenContract.allowance(rootState.network.account, state.smartLoanFactoryContract.address), decimals);

      if (parseFloat(allowance) < parseFloat(value)) {
        const approveTransaction = await fundTokenContract.approve(state.smartLoanFactoryContract.address, amount);
        await awaitConfirmation(approveTransaction, provider, 'approve');
      }

      const wrappedSmartLoanFactoryContract = await wrapContract(state.smartLoanFactoryContract);

      const transaction = await wrappedSmartLoanFactoryContract.createAndFundLoan(toBytes32(asset.symbol), amount, {gasLimit: 1000000});

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      await awaitConfirmation(transaction, provider, 'create Prime Account');
      await dispatch('setupSmartLoanContract');
      // TODO check on mainnet
      setTimeout(async () => {
        await dispatch('network/updateBalance', {}, {root: true});
      }, 5000);

      setTimeout(async () => {
        await dispatch('updateFunds');
        console.log('update funds after loan creation finished');
      }, 30000);
    },

    async getAllAssetsBalances({state, commit, rootState}) {
      const dataRefreshNotificationService = rootState.serviceRegistry.dataRefreshEventService;
      const balances = {};
      const lpBalances = {};
      const assetBalances = await state.smartLoanContract.getAllAssetsBalances();
      assetBalances.forEach(
        asset => {
          let symbol = fromBytes32(asset.name);
          if (config.ASSETS_CONFIG[symbol]) {
            balances[symbol] = formatUnits(asset.balance.toString(), config.ASSETS_CONFIG[symbol].decimals);
          }
          if (config.LP_ASSETS_CONFIG[symbol]) {
            lpBalances[symbol] = formatUnits(asset.balance.toString(), config.LP_ASSETS_CONFIG[symbol].decimals);
          }
        }
      );

      await commit('setAssetBalances', balances);
      await commit('setLpBalances', lpBalances);
      const refreshEvent = {assetBalances: balances, lpBalances: lpBalances};
      dataRefreshNotificationService.emitAssetBalancesDataRefreshEvent(refreshEvent);
    },

    async getDebtsPerAsset({state, commit, rootState}) {
      const dataRefreshNotificationService = rootState.serviceRegistry.dataRefreshEventService;
      const debtsPerAsset = {};
      const debts = await state.smartLoanContract.getDebts();
      debts.forEach(debt => {
        const asset = fromBytes32(debt.name);
        const debtValue = formatUnits(debt.debt, config.ASSETS_CONFIG[asset].decimals);
        debtsPerAsset[asset] = {asset: asset, debt: debtValue};
      });
      await commit('setDebtsPerAsset', debtsPerAsset);
      dataRefreshNotificationService.emitDebtsPerAssetDataRefreshEvent(debtsPerAsset);
    },

    async getFullLoanStatus({state, commit}) {
      const loanAssets = mergeArrays([
        (await state.smartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.smartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG)
      ]);

      const fullLoanStatusResponse = await (await wrapContract(state.smartLoanContract, loanAssets)).getFullLoanStatus();
      const fullLoanStatus = {
        totalValue: fromWei(fullLoanStatusResponse[0]),
        debt: fromWei(fullLoanStatusResponse[1]),
        thresholdWeightedValue: fromWei(fullLoanStatusResponse[2]),
        health: fromWei(fullLoanStatusResponse[3]),
      };
      commit('setFullLoanStatus', fullLoanStatus);
    },

    async getAccountApr({state, getters, rootState, commit}){
      let apr = 0;
      let yearlyDebtInterest = 0;

      if (rootState.poolStore.pools && state.debtsPerAsset) {
        Object.entries(state.debtsPerAsset).forEach(
            ([symbol, debt]) => {
              yearlyDebtInterest += parseFloat(debt.debt) * rootState.poolStore.pools.find(pool => pool.asset.symbol === symbol).borrowingAPY * state.assets[symbol].price;
            }
        );

        let yearlyAssetInterest = 0;


        if (state.assetBalances) {
          yearlyAssetInterest = state.assetBalances['sAVAX'] * state.assets['sAVAX'].price * 0.072;
        }

        let yearlyLpInterest = 0;

        if (state.lpAssets && state.lpBalances) {
          for (let entry of Object.entries(state.lpAssets)) {
            let symbol = entry[0]
            let lpAsset = entry[1]

            //TODO: take from API
            let assetAppretiation = (lpAsset.primary === 'sAVAX' || lpAsset.secondary === 'sAVAX') ? 1.036 : 1;
            yearlyLpInterest += parseFloat(state.lpBalances[symbol]) * (((1 + lpAsset.currentApr) * assetAppretiation) - 1) * lpAsset.price;
          }
        }

        let yearlyFarmInterest = 0;

        if (rootState.stakeStore.farms) {
          for (let entry of Object.entries(rootState.stakeStore.farms)) {
            let symbol = entry[0];
            let farms = entry[1];

            for (let farm of farms) {
              let assetAppretiation = 1;

              if (symbol.includes('sAVAX')) assetAppretiation =  1.036;
              if (symbol === 'sAVAX') assetAppretiation =  1.072;

              let apy = 0;

              apy = farm.currentApy;

              yearlyFarmInterest += parseFloat(farm.totalBalance) * (((1 + apy) * assetAppretiation) - 1) * farm.price;

            }
          }
        }

        const collateral = getters.getCollateral;

        if (collateral) {
          apr = (yearlyAssetInterest + yearlyLpInterest + yearlyFarmInterest - yearlyDebtInterest) / collateral;
        }

        commit('setAccountApr', apr);
      }
    },

    async swapToWavax({state, rootState}) {
      const provider = rootState.network.provider;
      await state.wavaxTokenContract.connect(provider.getSigner()).deposit({value: toWei('1000')});
    },

    async fund({state, rootState, commit, dispatch}, {fundRequest}) {
      const provider = rootState.network.provider;
      const amountInWei = parseUnits(fundRequest.value.toString(), fundRequest.assetDecimals);
      const fundToken = new ethers.Contract(tokenAddresses[fundRequest.asset], erc20ABI, provider.getSigner());

      const allowance = formatUnits(await fundToken.allowance(rootState.network.account, state.smartLoanContract.address), fundRequest.assetDecimals);

      if (parseFloat(allowance) < parseFloat(fundRequest.value)) {
        const approveTransaction = await fundToken.connect(provider.getSigner()).approve(state.smartLoanContract.address, amountInWei);
        await awaitConfirmation(approveTransaction, provider, 'approve');
      }

      const loanAssets = mergeArrays([(
        await state.smartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.smartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [fundRequest.asset]
      ]);

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets)).fund(
          toBytes32(fundRequest.asset),
          amountInWei,
          {gasLimit: 500000});

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'fund');

      const depositAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'Funded').args.amount, fundRequest.assetDecimals);
      const assetBalanceBeforeDeposit = fundRequest.isLP ? state.lpBalances[fundRequest.asset] : state.assetBalances[fundRequest.asset];
      const assetBalanceAfterDeposit = Number(assetBalanceBeforeDeposit) + Number(depositAmount);

      await commit('setSingleAssetBalance', {asset: fundRequest.asset, balance: assetBalanceAfterDeposit});
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(fundRequest.asset, assetBalanceAfterDeposit, Boolean(fundRequest.isLP), true);

      console.log(depositAmount);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('network/updateBalance', {}, {root: true});
      }, 1000);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, HARD_REFRESH_DELAY);
    },

    async fundNativeToken({state, rootState, commit, dispatch}, {value}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.smartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.smartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [config.nativeToken]
      ]);

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets)).depositNativeToken({
        value: toWei(String(value)),
        gasLimit: 500000
      });

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();
      let tx = await awaitConfirmation(transaction, provider, 'fund');
      console.log(getLog(tx, SMART_LOAN.abi, 'DepositNative'));
      const depositAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'DepositNative').args.amount, config.ASSETS_CONFIG['AVAX'].decimals);
      const assetBalanceAfterDeposit = Number(state.assetBalances['AVAX']) + Number(depositAmount);
      console.log(depositAmount);
      console.log(assetBalanceAfterDeposit);

      await commit('setSingleAssetBalance', {asset: 'AVAX', balance: assetBalanceAfterDeposit});
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate('AVAX', assetBalanceAfterDeposit, false, true);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('network/updateBalance', {}, {root: true});
      }, 1000);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, HARD_REFRESH_DELAY);
    },

    async withdraw({state, rootState, commit, dispatch}, {withdrawRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.smartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.smartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG)
      ]);

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets)).withdraw(
          toBytes32(withdrawRequest.asset),
        parseUnits(String(withdrawRequest.value), withdrawRequest.assetDecimals),
          {gasLimit: 3000000});

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'withdraw');

      const withdrawAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'Withdrawn').args.amount, withdrawRequest.assetDecimals);
      const assetBalanceBeforeWithdraw = withdrawRequest.isLP ? state.lpBalances[withdrawRequest.asset] : state.assetBalances[withdrawRequest.asset];
      const assetBalanceAfterWithdraw = Number(assetBalanceBeforeWithdraw) - Number(withdrawAmount);

      await commit('setSingleAssetBalance', {asset: withdrawRequest.asset, balance: assetBalanceAfterWithdraw});
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(withdrawRequest.asset, assetBalanceAfterWithdraw, withdrawRequest.isLP, true);

      console.log(withdrawAmount);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, HARD_REFRESH_DELAY);
    },

    async withdrawNativeToken({state, rootState, commit, dispatch}, {withdrawRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.smartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.smartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG)
      ]);

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets)).unwrapAndWithdraw(toWei(String(withdrawRequest.value)));

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'withdraw');
      console.log(getLog(tx, SMART_LOAN.abi, 'UnwrapAndWithdraw'));
      const withdrawAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'UnwrapAndWithdraw').args.amount, config.ASSETS_CONFIG['AVAX'].decimals);
      const assetBalanceAfterWithdraw = Number(state.assetBalances['AVAX']) - Number(withdrawAmount);
      console.log('assetBalanceAfterWithdraw', assetBalanceAfterWithdraw);

      await commit('setSingleAssetBalance', {asset: 'AVAX', balance: assetBalanceAfterWithdraw});
      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate('AVAX', assetBalanceAfterWithdraw, false, true);

      console.log(assetBalanceAfterWithdraw);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, HARD_REFRESH_DELAY);
    },

    async provideLiquidity({state, rootState, commit, dispatch}, {provideLiquidityRequest}) {
      console.log(provideLiquidityRequest);
      const provider = rootState.network.provider;

      const firstDecimals = config.ASSETS_CONFIG[provideLiquidityRequest.firstAsset].decimals;
      const secondDecimals = config.ASSETS_CONFIG[provideLiquidityRequest.secondAsset].decimals;
      const lpTokenDecimals = config.LP_ASSETS_CONFIG[provideLiquidityRequest.symbol].decimals;

      let minAmount = 0.9;

      const loanAssets = mergeArrays([(
        await state.smartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.smartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
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
        parseUnits((minAmount * parseFloat(provideLiquidityRequest.secondAmount)).toFixed(secondDecimals), BigNumber.from(secondDecimals.toString())),
        {gasLimit: 4000000}
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'create LP token');

      const firstAssetAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'AddLiquidity').args.firstAmount, firstDecimals);
      const secondAssetAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'AddLiquidity').args.secondAmount, secondDecimals);
      const lpTokenCreated = formatUnits(getLog(tx, SMART_LOAN.abi, 'AddLiquidity').args.liquidity, lpTokenDecimals);
      const firstAssetBalanceAfterTransaction = Number(state.assetBalances[provideLiquidityRequest.firstAsset]) - Number(firstAssetAmount);
      const secondAssetBalanceAfterTransaction = Number(state.assetBalances[provideLiquidityRequest.secondAsset]) - Number(secondAssetAmount);
      const lpTokenBalanceAfterTransaction = Number(state.lpBalances[provideLiquidityRequest.symbol]) + Number(lpTokenCreated);
      console.log(firstAssetAmount); // how much of tokenA was used
      console.log(secondAssetAmount); //how much of tokenB was used
      console.log(lpTokenCreated); //how much LP was created

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
      }, HARD_REFRESH_DELAY);
    },

    async removeLiquidity({state, rootState, commit, dispatch}, {removeLiquidityRequest}) {

      const provider = rootState.network.provider;

      const firstDecimals = config.ASSETS_CONFIG[removeLiquidityRequest.firstAsset].decimals;
      const secondDecimals = config.ASSETS_CONFIG[removeLiquidityRequest.secondAsset].decimals;
      const lpTokenDecimals = config.LP_ASSETS_CONFIG[removeLiquidityRequest.symbol].decimals;

      const loanAssets = mergeArrays([(
        await state.smartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.smartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [removeLiquidityRequest.firstAsset, removeLiquidityRequest.secondAsset]
      ]);

      const wrappedContract = await wrapContract(state.smartLoanContract, loanAssets);

      const transaction = await wrappedContract[config.DEX_CONFIG[removeLiquidityRequest.dex].removeLiquidityMethod](
        toBytes32(removeLiquidityRequest.firstAsset),
        toBytes32(removeLiquidityRequest.secondAsset),
        parseUnits(removePaddedTrailingZeros(removeLiquidityRequest.value), BigNumber.from(removeLiquidityRequest.assetDecimals.toString())),
        parseUnits((removeLiquidityRequest.minFirstAmount), BigNumber.from(firstDecimals.toString())),
        parseUnits((removeLiquidityRequest.minSecondAmount), BigNumber.from(secondDecimals.toString())),
        {gasLimit: 4000000}
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'unwind LP token');

      const firstAssetAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'RemoveLiquidity').args.firstAmount, firstDecimals);
      const secondAssetAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'RemoveLiquidity').args.secondAmount, secondDecimals);
      const lpTokenRemoved = formatUnits(getLog(tx, SMART_LOAN.abi, 'RemoveLiquidity').args.liquidity, lpTokenDecimals);
      const firstAssetBalanceAfterTransaction = Number(state.assetBalances[removeLiquidityRequest.firstAsset]) + Number(firstAssetAmount);
      const secondAssetBalanceAfterTransaction = Number(state.assetBalances[removeLiquidityRequest.secondAsset]) + Number(secondAssetAmount);
      const lpTokenBalanceAfterTransaction = Number(state.lpBalances[removeLiquidityRequest.symbol]) - Number(lpTokenRemoved);
      console.log(firstAssetAmount); // how much of tokenA was received
      console.log(secondAssetAmount); //how much of tokenB was received
      console.log(lpTokenRemoved); //how much LP was removed

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
      }, HARD_REFRESH_DELAY);
    },

    async borrow({state, rootState, commit, dispatch}, {borrowRequest}) {
      console.log(state.debtsPerAsset);
      console.log(Number(state.debtsPerAsset[borrowRequest.asset].debt));
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.smartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.smartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [borrowRequest.asset]
      ]);

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets)).borrow(
          toBytes32(borrowRequest.asset),
          parseUnits(String(borrowRequest.amount), config.ASSETS_CONFIG[borrowRequest.asset].decimals),
          {gasLimit: 3000000});

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'borrow');
      const borrowedAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'Borrowed').args.amount, config.ASSETS_CONFIG[borrowRequest.asset].decimals);
      console.log(borrowedAmount);
      const balanceAfterTransaction = Number(state.assetBalances[borrowRequest.asset]) + Number(borrowedAmount);
      const debtAfterTransaction = Number(state.debtsPerAsset[borrowRequest.asset].debt) + Number(borrowedAmount);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(borrowRequest.asset, balanceAfterTransaction, false, true);
      rootState.serviceRegistry.assetDebtsExternalUpdateService
        .emitExternalAssetDebtUpdate(borrowRequest.asset, debtAfterTransaction, true);

      rootState.serviceRegistry.progressBarService.emitProgressBarInProgressState();
      setTimeout(() => {
        rootState.serviceRegistry.progressBarService.emitProgressBarSuccessState();
      }, SUCCESS_DELAY_AFTER_TRANSACTION);

      setTimeout(async () => {
        await dispatch('poolStore/setupPools', {}, {root: true});
      }, 1000);

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, HARD_REFRESH_DELAY);
    },

    async repay({state, rootState, commit, dispatch}, {repayRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.smartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.smartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG)
      ]);

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets)).repay(
          toBytes32(repayRequest.asset),
          parseUnits(parseFloat(repayRequest.amount).toFixed(repayRequest.decimals), BigNumber.from(repayRequest.decimals)),
          {gasLimit: 3000000});

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'repay');

      const repayAmount = formatUnits(getLog(tx, SMART_LOAN.abi, 'Repaid').args.amount, config.ASSETS_CONFIG[repayRequest.asset].decimals);

      const balanceAfterRepay = Number(state.assetBalances[repayRequest.asset]) - Number(repayAmount);
      const debtAfterRepay = repayRequest.isMax ? 0 : Number(state.debtsPerAsset[repayRequest.asset].debt) - Number(repayAmount);

      rootState.serviceRegistry.assetBalancesExternalUpdateService
        .emitExternalAssetBalanceUpdate(repayRequest.asset, balanceAfterRepay, false, true);
      rootState.serviceRegistry.assetDebtsExternalUpdateService
        .emitExternalAssetDebtUpdate(repayRequest.asset, debtAfterRepay, true);

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
      }, HARD_REFRESH_DELAY);
    },

    async swap({state, rootState, commit, dispatch}, {swapRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.smartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.smartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG),
        [swapRequest.targetAsset]
      ]);

      let sourceDecimals = config.ASSETS_CONFIG[swapRequest.sourceAsset].decimals;
      console.log(sourceDecimals);
      let sourceAmount = parseUnits(Number(swapRequest.sourceAmount).toFixed(sourceDecimals), sourceDecimals);

      let targetDecimals = config.ASSETS_CONFIG[swapRequest.targetAsset].decimals;
      let targetAmount = parseUnits(swapRequest.targetAmount.toFixed(targetDecimals), targetDecimals);

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets)).yakSwap(
        sourceAmount,
        targetAmount,
        swapRequest.path,
        swapRequest.adapters,
        {gasLimit: 4000000}
      );

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'swap');

      console.log(getLog(tx, SMART_LOAN.abi, 'Swap'));

      const amountSold = formatUnits(getLog(tx, SMART_LOAN.abi, 'Swap').args.maximumSold, config.ASSETS_CONFIG[swapRequest.sourceAsset].decimals);
      console.log('amountSold', amountSold);
      const amountBought = formatUnits(getLog(tx, SMART_LOAN.abi, 'Swap').args.minimumBought, config.ASSETS_CONFIG[swapRequest.targetAsset].decimals);
      console.log('amountBought', amountBought);
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

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, HARD_REFRESH_DELAY);
    },

    async wrapNativeToken({state, rootState, commit, dispatch}, {wrapRequest}) {
      const provider = rootState.network.provider;

      const loanAssets = mergeArrays([(
        await state.smartLoanContract.getAllOwnedAssets()).map(el => fromBytes32(el)),
        (await state.smartLoanContract.getStakedPositions()).map(position => fromBytes32(position.symbol)),
        Object.keys(config.POOLS_CONFIG)
      ]);

      const transaction = await (await wrapContract(state.smartLoanContract, loanAssets)).wrapNativeToken(
        parseUnits(parseFloat(wrapRequest.amount).toFixed(wrapRequest.decimals)),
        {gasLimit: 3000000});

      rootState.serviceRegistry.progressBarService.requestProgressBar();
      rootState.serviceRegistry.modalService.closeModal();

      let tx = await awaitConfirmation(transaction, provider, 'wrap');

      console.log(fromWei(getLog(tx, SMART_LOAN.abi, 'WrapNative').args.amount));

      setTimeout(async () => {
        await dispatch('updateFunds');
      }, HARD_REFRESH_DELAY);
    },
  }
};
