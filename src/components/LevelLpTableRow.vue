<template>
  <div class="lp-table-row-component level" :class="{'expanded': rowExpanded}">
    <div class="table__row" v-if="lpToken">
      <div class="table__cell asset">
        <img class="asset__icon" :src="`src/assets/logo/${lpToken.symbol.toLowerCase()}.svg`" v-on:click="openProfileModal">
        <div class="asset__info">
          <a class="asset__name" :href="lpToken.link" target=”_blank”>{{ lpToken.name }}</a>
          <div class="asset__dex">
            by <a v-on:click="openProfileModal"><b>Level</b></a>
          </div>
        </div>
      </div>

      <div class="table__cell table__cell--double-value balance">
        <template v-if="levelLpBalances && parseFloat(levelLpBalances[lpToken.symbol]) && formatTokenBalance(levelLpBalances[lpToken.symbol], 10, true) > 0">
          <div class="double-value__pieces">
            <span v-if="isLpBalanceEstimated">~</span>
            {{ formatTokenBalance(levelLpBalances[lpToken.symbol], 10, true) }}
          </div>
          <div class="double-value__usd">
            <span v-if="levelLpBalances[lpToken.symbol]">
              {{ levelLpBalances[lpToken.symbol] * lpToken.price | usd }}
            </span>
          </div>
        </template>
        <template v-else>
          <div class="no-value-dash"></div>
        </template>
      </div>

      <div class="table__cell table__cell--double-value rewards">

        <template v-if="rewards">
          <div class="double-value__pieces">
            <img src="src/assets/logo/lvl.png" class="lvl-logo">
            {{ formatTokenBalance(rewards, 6) }}
          </div>
          <div class="double-value__usd">
            {{ rewardsInUsd | usd }}
          </div>
        </template>
        <template v-else>
          <div class="no-value-dash"></div>
        </template>
      </div>

      <div class="table__cell trend-level">
        <div class="trend__chart-change" v-on:click="toggleChart()">
          <SmallChartBeta :data-points="weeklyPrices"
                          :is-stable-coin="false"
                          :line-width="2"
                          :width="60"
                          :height="25"
                          :positive-change="weeklyPriceChange > 0">
          </SmallChartBeta>
        </div>
      </div>

      <div class="table__cell table__cell--double-value tvl">
        {{ formatTvl(tvl) }}
      </div>

      <div class="table__cell capacity">
        <bar-gauge-beta v-if="lpToken.maxExposure" :min="0" :max="lpToken.maxExposure" :value="Math.max(lpToken.currentExposure, 0.001)" v-tooltip="{content: `${lpToken.currentExposure ? lpToken.currentExposure.toFixed(2) : 0} ($${lpToken.currentExposure ? (lpToken.currentExposure * this.lpToken.price).toFixed(2) : 0}) out of ${lpToken.maxExposure} ($${lpToken.maxExposure ? (lpToken.maxExposure * this.lpToken.price).toFixed(2) : 0}) is currently used.`, classes: 'info-tooltip'}" :width="80"></bar-gauge-beta>
      </div>

      <div class="table__cell table__cell--double-value apr" v-bind:class="{'apr--with-warning': lpToken.aprWarning}">
        {{ apr / 100 | percent }}
        <div class="apr-warning" v-if="lpToken.aprWarning">
          <img src="src/assets/icons/warning.svg" v-tooltip="{content: lpToken.aprWarning, classes: 'info-tooltip long'}">
        </div>
      </div>

      <div class="table__cell table__cell--double-value max-apr">
        {{ maxApr | percent }}
      </div>

      <div class="table__cell"></div>

      <div class="table__cell actions">
        <IconButtonMenuBeta
            class="actions__icon-button"
            :config="addActionsConfig"
            v-if="addActionsConfig"
            v-on:iconButtonClick="actionClick"
            :disabled="true">
        </IconButtonMenuBeta>
        <IconButtonMenuBeta
            class="actions__icon-button last"
            :config="removeActionsConfig"
            v-if="removeActionsConfig"
            v-on:iconButtonClick="actionClick"
            :disabled="true">
        </IconButtonMenuBeta>
        <IconButtonMenuBeta
            class="actions__icon-button"
            v-if="moreActionsConfig"
            :config="moreActionsConfig"
            v-on:iconButtonClick="actionClick"
            :disabled="disableAllButtons">
        </IconButtonMenuBeta>
      </div>
    </div>
    <div class="chart-container" v-if="showChart">
      <SmallBlock v-on:close="toggleChart()">
        <Toggle class="chart-container__toggle" v-on:change="weekly = !weekly" :options="['7D', '24h']"
                :initial-option="0"></Toggle>
        <Chart :data-points="weekly ? weeklyPrices : dailyPrices"
               :line-width="3"
               :min-y="weekly ? weeklyMinPrice : dailyMinPrice"
               :max-y="weekly ? weeklyMaxPrice : dailyMaxPrice"
               :positive-change="weekly ? weeklyPriceChange > 0 : dailyPriceChange > 0">
        </Chart>
      </SmallBlock>
    </div>
  </div>
</template>

<script>
import DoubleAssetIcon from './DoubleAssetIcon';
import LoadedValue from './LoadedValue';
import SmallBlock from './SmallBlock';
import Chart from './Chart';
import IconButtonMenuBeta from './IconButtonMenuBeta';
import ColoredValueBeta from './ColoredValueBeta';
import SmallChartBeta from './SmallChartBeta';
import AddFromWalletModal from './AddFromWalletModal';
import config from '../config';
import {mapActions, mapState} from 'vuex';
import ProvideLiquidityModal from './ProvideLiquidityModal';
import RemoveLiquidityModal from './RemoveLiquidityModal';
import WithdrawModal from './WithdrawModal';

const ethers = require('ethers');
import erc20ABI from '../../test/abis/ERC20.json';
import {calculateMaxApy, chartPoints, fromWei, toWei} from '../utils/calculate';
import addresses from '../../common/addresses/avalanche/token_addresses.json';
import {formatUnits, parseUnits} from 'ethers/lib/utils';
import DeltaIcon from "./DeltaIcon.vue";
import SwapModal from "./SwapModal.vue";
import redstone from "redstone-api";
import Toggle from "./Toggle.vue";
import TradingViewChart from "./TradingViewChart.vue";
import LIQUIDITY_CALCULATOR from '/artifacts/contracts/interfaces/level/ILiquidityCalculator.sol/ILiquidityCalculator.json'
import {BigNumber} from "ethers";
import BarGaugeBeta from "./BarGaugeBeta.vue";
import ClaimLevelRewardsModal from "./ClaimLevelRewardsModal.vue";
import PartnerInfoModal from "./PartnerInfoModal.vue";
import moment from "moment/moment";
import {ActionSection} from "../services/globalActionsDisableService";

const FARMING_CONTRACT_ADDRESS = '0xC18c952F800516E1eef6aB482F3d331c84d43d38';
const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

const FARMING_ABI = [
  'function pendingReward(uint256 _pid, address _user) public view returns (uint256)'
];

export default {
  name: 'LevelLpTableRow',
  components: {
    BarGaugeBeta,
    TradingViewChart, Toggle,
    DeltaIcon,
    DoubleAssetIcon,
    LoadedValue,
    SmallBlock,
    Chart,
    IconButtonMenuBeta,
    ColoredValueBeta,
    SmallChartBeta
  },
  props: {
    lpToken: null
  },

  async mounted() {
    this.setupAddActionsConfiguration();
    this.setupRemoveActionsConfiguration();
    this.watchAssetBalancesDataRefreshEvent();
    this.watchHardRefreshScheduledEvent();
    this.watchHealth();
    this.watchProgressBarState();
    this.watchAssetApysRefresh();
    this.watchExternalAssetBalanceUpdate();
    this.watchAsset();
    this.fetchHistoricalPrices();
    this.setupTvl();
    await this.setupApr();
    this.watchActionDisabling();
  },

  data() {
    return {
      addActionsConfig: null,
      removeActionsConfig: null,
      moreActionsConfig: null,
      rowExpanded: false,
      poolBalance: 0,
      rewards: 0,
      rewardsInUsd: 0,
      lvlPrice: 0,
      apr: 0,
      tvl: 0,
      weekly: true,
      weeklyPrices: [],
      weeklyPriceChange: 0,
      weeklyMinPrice: 0,
      weeklyMaxPrice: 0,
      dailyPrices: [],
      dailyPriceChange: 0,
      dailyMinPrice: 0,
      dailyMaxPrice: 0,
      lpTokenBalances: [],
      isLpBalanceEstimated: false,
      disableAllButtons: false,
      healthLoaded: false,
      showChart: false,
      isActionDisabledRecord: {},
    };
  },

  computed: {
    ...mapState('fundsStore', [
      'health',
      'levelLpBalances',
      'lpBalances',
      'smartLoanContract',
      'fullLoanStatus',
      'assetBalances',
      'assets',
      'debtsPerAsset',
      'lpAssets',
      'concentratedLpAssets',
      'levelLpAssets',
      'traderJoeV2LpAssets',
      'balancerLpAssets',
      'balancerLpBalances',
      'penpieLpBalances',
      'penpieLpAssets',
      'wombatLpAssets',
      'wombatLpBalances',
      'wombatYYFarmsBalances',
    ]),
    ...mapState('poolStore', ['pools']),
    ...mapState('network', ['account', 'provider']),
    ...mapState('serviceRegistry', [
      'assetBalancesExternalUpdateService',
      'dataRefreshEventService',
      'progressBarService',
      'lpService',
      'healthService',
      'globalActionsDisableService',
    ]),
    ...mapState('stakeStore', ['farms']),

    hasSmartLoanContract() {
      return this.smartLoanContract && this.smartLoanContract.address !== NULL_ADDRESS;
    },

    maxApr() {
      return calculateMaxApy(this.pools, this.apr / 100);
    },
  },

  watch: {
    smartLoanContract: {
      handler(smartLoanContract) {
        if (smartLoanContract) {
          this.setupAddActionsConfiguration();
          this.setupRemoveActionsConfiguration();
          this.setupMoreActionsConfiguration();
          this.setupLevelPriceAndRewards();
        }
      },
    },
    provider: {
      async handler(provider) {
        if (provider) {
          await this.setupPoolBalance();
          this.setupLevelPriceAndRewards();
        }
      }
    }
  },

  methods: {
    ...mapActions('fundsStore', [
      'fund',
      'withdraw',
      'addLiquidityLevelFinance',
      'removeLiquidityLevelFinance',
      'claimLevelRewards'
    ]),
    setupAddActionsConfiguration() {
      this.addActionsConfig =
          {
            iconSrc: 'src/assets/icons/plus.svg',
            tooltip: 'Add',
            menuOptions: [
              {
                key: 'ADD_FROM_WALLET',
                name: 'Import existing LLP position',
                disabled: this.isActionDisabledRecord['ADD_FROM_WALLET'] || !this.hasSmartLoanContract || !this.lpTokenBalances,
                disabledInfo: this.isActionDisabledRecord['ADD_FROM_WALLET'] ? '' : 'To create LLP token, you need to add some funds from you wallet first'
              },
              {
                key: 'PROVIDE_LIQUIDITY',
                name: 'Create LLP position',
                disabled: this.isActionDisabledRecord['PROVIDE_LIQUIDITY'] || !this.hasSmartLoanContract || !this.lpTokenBalances,
                disabledInfo: this.isActionDisabledRecord['PROVIDE_LIQUIDITY'] ? '' : 'To create LLP token, you need to add some funds from you wallet first'
              }
            ]
          }
    },

    setupRemoveActionsConfiguration() {
      this.removeActionsConfig =
          {
            iconSrc: 'src/assets/icons/minus.svg',
            tooltip: 'Remove',
            menuOptions: [
              {
                key: 'WITHDRAW',
                name: 'Export LLP position',
                disabled: this.isActionDisabledRecord['WITHDRAW'] || !this.hasSmartLoanContract || !this.lpTokenBalances,
                disabledInfo: this.isActionDisabledRecord['WITHDRAW'] ? '' : 'To create LLP token, you need to add some funds from you wallet first'
              },
              {
                key: 'REMOVE_LIQUIDITY',
                name: 'Remove LLP position',
                disabled: this.isActionDisabledRecord['REMOVE_LIQUIDITY'] || !this.hasSmartLoanContract || !this.lpTokenBalances,
                disabledInfo: this.isActionDisabledRecord['REMOVE_LIQUIDITY'] ? '' : 'To create LLP token, you need to add some funds from you wallet first'
              }
            ]
          }
    },

    setupMoreActionsConfiguration() {
      this.moreActionsConfig = {
        iconSrc: 'src/assets/icons/icon_a_more.svg',
        tooltip: 'More',
        menuOptions: [
          {
            key: 'CLAIM_LEVEL_REWARDS',
            name: 'Claim Level rewards',
            disabled: this.isActionDisabledRecord['CLAIM_LEVEL_REWARDS'],
          },
          {
            key: 'PARTNER_PROFILE',
            name: 'Show profile',
            disabled: this.isActionDisabledRecord['PARTNER_PROFILE'],
          }
        ]
      };
    },

    async setupApr() {
      if (!this.lpToken.apy) return;
      this.apr = this.lpToken.apy;
    },

    toggleChart() {
      if (this.rowExpanded) {
        this.showChart = false;
        this.rowExpanded = false;
      } else {
        this.rowExpanded = true;
        setTimeout(() => {
          this.showChart = true;
        }, 200);
      }
    },

    actionClick(key) {
      if (!this.isActionDisabledRecord[key] && !this.disableAllButtons) {
        switch (key) {
          case 'ADD_FROM_WALLET':
            this.openAddFromWalletModal();
            break;
          case 'PROVIDE_LIQUIDITY':
            this.openProvideLiquidityModal();
            break;
          case 'WITHDRAW':
            this.openWithdrawModal();
            break;
          case 'REMOVE_LIQUIDITY':
            this.openRemoveLiquidityModal();
            break;
          case 'CLAIM_LEVEL_REWARDS':
            this.openClaimRewardsModal();
            break;
          case 'PARTNER_PROFILE':
            this.openProfileModal();
            break;
        }
      }
    },

    levelFinanceQuery() {
      const calculator = new ethers.Contract(config.levelLiquidityCalculatorAddress, LIQUIDITY_CALCULATOR.abi, provider.getSigner());
      const llpContract = new ethers.Contract(this.lpToken.address, erc20ABI, provider.getSigner());

      return async (sourceAsset, targetAsset, amountIn) => {
        if (config.LEVEL_LP_ASSETS_CONFIG[sourceAsset]) {
          const llp = config.LEVEL_LP_ASSETS_CONFIG[sourceAsset];
          const trancheValue = await calculator.getTrancheValue(llp.address, false);
          const llpSupply = await llpContract.totalSupply();
          const llpSellPrice = formatUnits(trancheValue.div(llpSupply), 12);

          const target = config.ASSETS_CONFIG[targetAsset];
          const targetPrice = target.price;
          const ratio = llpSellPrice / targetPrice;
          const amountOut = ratio * formatUnits(amountIn, 18);

          return parseUnits(amountOut.toFixed(target.decimals), target.decimals);
        } else {
          const llp = config.LEVEL_LP_ASSETS_CONFIG[targetAsset];
          const trancheValue = await calculator.getTrancheValue(llp.address, true);
          const llpSupply = await llpContract.totalSupply();
          const llpBuyPrice = formatUnits(trancheValue.div(llpSupply), 12);
          const source = config.ASSETS_CONFIG[sourceAsset];
          const sourcePrice = source.price;
          const ratio = sourcePrice / llpBuyPrice;
          const amountOut = ratio * formatUnits(amountIn, source.decimals);

          return parseUnits(amountOut.toFixed(18), 18);
        }
      }
    },

    levelFinanceFee() {
      console.log('levelFinanceFee');
      const calculator = new ethers.Contract(config.levelLiquidityCalculatorAddress, LIQUIDITY_CALCULATOR.abi, provider.getSigner());
      console.log(calculator);

      return async (sourceAsset, targetAsset, amountIn, amountOut) => {
        const isBuyingLevel = this.lpToken.symbol === targetAsset;
        const otherAsset = config.ASSETS_CONFIG[isBuyingLevel ? sourceAsset : targetAsset];
        const price = BigNumber.from(Math.ceil(otherAsset.price.toString() * 100000).toString() + "0".repeat(30 - otherAsset.decimals - 5)); //we multiply by 1e5 for accuracy and then remove these 5 zeroes
        const otherAmount = isBuyingLevel ? amountIn : amountOut;

       return parseUnits((await calculator.calcAddRemoveLiquidityFee(otherAsset.address, price, otherAmount, isBuyingLevel)).toString(), 8);
      }
    },

    async openAddFromWalletModal() {
      const modalInstance = this.openModal(AddFromWalletModal);
      modalInstance.asset = this.lpToken;
      modalInstance.assetBalance = this.levelLpBalances && this.levelLpBalances[this.lpToken.symbol] ? this.levelLpBalances[this.lpToken.symbol] : 0;
      modalInstance.assets = this.assets;
      modalInstance.assetBalances = this.assetBalances;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.lpBalances = this.lpBalances;
      modalInstance.levelLpAssets = this.levelLpAssets;
      modalInstance.levelLpBalances = this.levelLpBalances;
      modalInstance.traderJoeV2LpAssets = this.traderJoeV2LpAssets;
      modalInstance.concentratedLpAssets = this.concentratedLpAssets;
      modalInstance.concentratedLpBalances = this.concentratedLpBalances;
      modalInstance.balancerLpBalances = this.balancerLpBalances;
      modalInstance.balancerLpAssets = this.balancerLpAssets;
      modalInstance.penpieLpAssets = this.penpieLpAssets;
      modalInstance.penpieLpBalances = this.penpieLpBalances;
      modalInstance.wombatLpAssets = this.wombatLpAssets;
      modalInstance.wombatLpBalances = this.wombatLpBalances;
      modalInstance.farms = this.farms;
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.loan = this.debt;
      modalInstance.thresholdWeightedValue = this.thresholdWeightedValue;
      modalInstance.isLP = false;
      modalInstance.logo = `${this.lpToken.symbol.toLowerCase()}.svg`;
      modalInstance.walletAssetBalance = await this.getWalletLpTokenBalance();
      modalInstance.$on('ADD_FROM_WALLET', addFromWalletEvent => {
        if (this.smartLoanContract) {
          const fundRequest = {
            value: addFromWalletEvent.value.toString(),
            asset: this.lpToken.symbol,
            assetDecimals: config.LEVEL_LP_ASSETS_CONFIG[this.lpToken.symbol].decimals,
            pid: this.lpToken.pid,
            type: 'LEVEL_LLP',
          };
          this.handleTransaction(this.fund, {fundRequest: fundRequest}, () => {
            this.$forceUpdate();
          }, (error) => {
            this.handleTransactionError(error);
          }).then(() => {
          });
        }
      });
    },

    //TODO: duplicated code
    openWithdrawModal() {
      const modalInstance = this.openModal(WithdrawModal);
      modalInstance.asset = this.lpToken;
      modalInstance.assetBalance = this.levelLpBalances[this.lpToken.symbol];
      modalInstance.assets = this.assets;
      modalInstance.assetBalances = this.assetBalances;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.concentratedLpAssets = this.concentratedLpAssets;
      modalInstance.traderJoeV2LpAssets = this.traderJoeV2LpAssets;
      modalInstance.levelLpAssets = this.levelLpAssets;
      modalInstance.levelLpBalances = this.levelLpBalances;
      modalInstance.lpBalances = this.lpBalances;
      modalInstance.concentratedLpBalances = this.concentratedLpBalances;
      modalInstance.balancerLpBalances = this.balancerLpBalances;
      modalInstance.balancerLpAssets = this.balancerLpAssets;
      modalInstance.penpieLpAssets = this.penpieLpAssets;
      modalInstance.penpieLpBalances = this.penpieLpBalances;
      modalInstance.wombatLpAssets = this.wombatLpAssets;
      modalInstance.wombatLpBalances = this.wombatLpBalances;
      modalInstance.wombatYYFarmsBalances = this.wombatYYFarmsBalances;
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.farms = this.farms;
      modalInstance.health = this.health;
      modalInstance.isLP = false;
      modalInstance.logo = `${this.lpToken.symbol.toLowerCase()}.svg`;
      modalInstance.$on('WITHDRAW', withdrawEvent => {
        const withdrawRequest = {
          value: withdrawEvent.value.toString(),
          asset: this.lpToken.symbol,
          assetDecimals: config.LEVEL_LP_ASSETS_CONFIG[this.lpToken.symbol].decimals,
          pid: this.lpToken.pid,
          type: 'LEVEL_LLP',
        };
        this.handleTransaction(this.withdraw, {withdrawRequest: withdrawRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
        });
      });
    },

    openProvideLiquidityModal() {
      console.log('openProvideLiquidityModal')
      const modalInstance = this.openModal(SwapModal);
      const swapDexsConfig = {
        Level: {
          availableAssets: [...this.lpToken.underlyingAssets]
        }
      }
      let initSourceAsset = [...this.lpToken.underlyingAssets][0];
      modalInstance.title = 'Create LLP position';
      modalInstance.swapDex = 'Level';
      modalInstance.dexOptions = ['Level'];
      modalInstance.swapDebtMode = false;
      modalInstance.slippageMargin = 0.1;
      modalInstance.sourceAsset = initSourceAsset;
      modalInstance.sourceAssetBalance = this.assetBalances[initSourceAsset];
      modalInstance.assets = { ...this.assets, ...this.levelLpAssets };
      modalInstance.sourceAssets = [...this.lpToken.underlyingAssets];
      modalInstance.swapDexsConfig = swapDexsConfig;
      modalInstance.targetAssetsConfig = config.LEVEL_LP_ASSETS_CONFIG;
      modalInstance.targetAssets = [this.lpToken.symbol];
      modalInstance.assetBalances = { ...this.assetBalances, ...this.levelLpBalances };
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.concentratedLpAssets = this.concentratedLpAssets;
      modalInstance.traderJoeV2LpAssets = this.traderJoeV2LpAssets;
      modalInstance.levelLpAssets = this.levelLpAssets;
      modalInstance.levelLpBalances = this.levelLpBalances;
      modalInstance.lpBalances = this.lpBalances;
      modalInstance.concentratedLpBalances = this.concentratedLpBalances;
      modalInstance.balancerLpBalances = this.balancerLpBalances;
      modalInstance.balancerLpAssets = this.balancerLpAssets;
      modalInstance.penpieLpAssets = this.penpieLpAssets;
      modalInstance.penpieLpBalances = this.penpieLpBalances;
      modalInstance.wombatLpAssets = this.wombatLpAssets;
      modalInstance.wombatLpBalances = this.wombatLpBalances;
      modalInstance.wombatYYFarmsBalances = this.wombatYYFarmsBalances;
      modalInstance.farms = this.farms;
      modalInstance.targetAsset = this.lpToken.symbol;
      modalInstance.debt = this.fullLoanStatus.debt;
      modalInstance.thresholdWeightedValue = this.fullLoanStatus.thresholdWeightedValue ? this.fullLoanStatus.thresholdWeightedValue : 0;
      modalInstance.health = this.fullLoanStatus.health;

      modalInstance.queryMethods = {
        Level: this.levelFinanceQuery(),
      };

      modalInstance.feeMethods = {
        Level: this.levelFinanceFee(),
      };

      modalInstance.$on('SWAP', swapEvent => {

        const addLiquidityRequest = {
          sourceAsset: swapEvent.sourceAsset,
          sourceAmount: swapEvent.sourceAmount,
          targetAsset: swapEvent.targetAsset,
          targetAmount: swapEvent.targetAmount,
          method: `levelStake${swapEvent.sourceAsset.charAt(0) + swapEvent.sourceAsset.toLowerCase().slice(1)}${this.lpToken.short}`
        };
        console.log(addLiquidityRequest)

        this.handleTransaction(this.addLiquidityLevelFinance, {addLiquidityRequest: addLiquidityRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
        });
      });

      modalInstance.initiate();
    },

    openRemoveLiquidityModal() {
      const modalInstance = this.openModal(SwapModal);
      const swapDexsConfig = {
        Level: {
          availableAssets: [...this.lpToken.underlyingAssets]
        }
      }
      modalInstance.title = 'Unwind LLP position';
      modalInstance.swapDex = 'Level';
      modalInstance.dexOptions = ['Level'];
      modalInstance.swapDebtMode = false;
      modalInstance.slippageMargin = 0.1;
      modalInstance.sourceAsset = this.lpToken.symbol;
      modalInstance.sourceAssetBalance = this.levelLpBalances[this.lpToken.symbol];
      modalInstance.sourceAssetsConfig = config.LEVEL_LP_ASSETS_CONFIG;
      modalInstance.assets = { ...this.assets, ...this.levelLpAssets };
      modalInstance.sourceAssets = [this.lpToken.symbol];
      modalInstance.targetAssets = [...this.lpToken.underlyingAssets];
      modalInstance.swapDexsConfig = swapDexsConfig;
      modalInstance.assetBalances = { ...this.assetBalances, ...this.levelLpBalances };
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.concentratedLpAssets = this.concentratedLpAssets;
      modalInstance.traderJoeV2LpAssets = this.traderJoeV2LpAssets;
      modalInstance.levelLpAssets = this.levelLpAssets;
      modalInstance.levelLpBalances = this.levelLpBalances;
      modalInstance.lpBalances = this.lpBalances;
      modalInstance.concentratedLpBalances = this.concentratedLpBalances;
      modalInstance.balancerLpBalances = this.balancerLpBalances;
      modalInstance.balancerLpAssets = this.balancerLpAssets;
      modalInstance.penpieLpAssets = this.penpieLpAssets;
      modalInstance.penpieLpBalances = this.penpieLpBalances;
      modalInstance.wombatLpAssets = this.wombatLpAssets;
      modalInstance.wombatLpBalances = this.wombatLpBalances;
      modalInstance.wombatYYFarmsBalances = this.wombatYYFarmsBalances;
      modalInstance.farms = this.farms;
      modalInstance.targetAsset = this.lpToken.underlyingAssets[0];
      modalInstance.debt = this.fullLoanStatus.debt;
      modalInstance.thresholdWeightedValue = this.fullLoanStatus.thresholdWeightedValue ? this.fullLoanStatus.thresholdWeightedValue : 0;
      modalInstance.health = this.fullLoanStatus.health;
      modalInstance.info = `This action will additionally harvest rewards to your wallet.`;
      modalInstance.queryMethods = {
        Level: this.levelFinanceQuery(),
      };
      modalInstance.feeMethods = {
        Level: this.levelFinanceFee(),
      };
      modalInstance.swapDex = 'Level';
      modalInstance.$on('SWAP', swapEvent => {

        const removeLiquidityRequest = {
          sourceAsset: swapEvent.sourceAsset,
          sourceAmount: swapEvent.sourceAmount,
          targetAsset: swapEvent.targetAsset,
          targetAmount: swapEvent.targetAmount,
          method: `levelUnstake${swapEvent.targetAsset.charAt(0).toUpperCase() + swapEvent.targetAsset.toLowerCase().slice(1)}${this.lpToken.short}`
        };

        this.handleTransaction(this.removeLiquidityLevelFinance, {removeLiquidityRequest: removeLiquidityRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
        });
      });

      modalInstance.initiate();
    },

    async openClaimRewardsModal() {
      const modalInstance = this.openModal(ClaimLevelRewardsModal);
      modalInstance.lpToken = this.lpToken;
      modalInstance.rewardsToClaim = this.rewards;
      modalInstance.levelRewardsAsset = 'PreLVL';

      const claimRewardsRequest = {
        lpToken: this.lpToken
      }

      modalInstance.$on('CLAIM', addFromWalletEvent => {
        if (this.smartLoanContract) {
          this.handleTransaction(this.claimLevelRewards, { claimRewardsRequest: claimRewardsRequest }, () => {
            this.rewards = 0;
            this.$forceUpdate();
          }, (error) => {
            this.handleTransactionError(error);
          }).then(() => {
          });
        }
      });
    },

    openProfileModal() {
      const modalInstance = this.openModal(PartnerInfoModal);
      modalInstance.partner = {
        name: 'Level',
        iconSrc: 'src/assets/logo/lvl.png',
        launchDate: moment(Date.parse('23 Nov 2022')).format('DD.MM.YYYY'),
        introduction: 'Level Finance is the only Perpetual Derivatives exchange on Arbitrum with a Tranching system. With 5.59M TVL, they are currently the 42nd biggest protocol on Arbitrum.',
        banner: 'src/assets/images/level-banner.jpg',
        mainFeatures: [
            'Perpetual Derivative Trading',
            'Leveraged Trading',
            'Basket LPing'
        ],
        securityMeasures: [
          {name: 'Upgradeability', state: 'ENABLED'},
          {name: 'Timelock (12h)', state: 'ENABLED'},
          {name: 'Multisig', state: 'ENABLED'},
          {name: `Audits `, state: 'ENABLED', tooltip:
                `
                 - <a href="https://obeliskauditing.com/audits/level-finance-trading?openPdf=true" target="_blank">Obelisk Trading</a>, Jan&nbsp;2023<br>
                 - <a href="https://obeliskauditing.com/audits/level-finance-core" target="_blank">Obelisk Core</a>,&nbsp;Jan&nbsp;2023<br>
                 - <a href="https://certificate.quantstamp.com/full/level-finance/929d1708-a464-476d-86f3-7d7942faa4d2/index.html" target="_blank">Quantstamp</a>, April 2023
          `},
          {name: 'Doxxed team', state: 'DISABLED', tooltip: `The team is anonymous and has not performed KYC <br>with the DeltaPrime team.<br><br>
            Comment from the Level team: <br>"Although the team is not doxxed, <br>multiple reputable investors have taken exposure on LVL.<br> An article from one of these investors, <br>Arthur Hayes, can be found <a href="https://level-finance.medium.com/hear-ye-hear-ye-73b0423c9b98" target="_blank">here</a>."`},
        ],
        chainImpact: 'Level Finance gives perpetual derivative traders increased control over their exposure to the DEX and underlying assets through their Tranching system, while providing traders with 0% price impact swaps.',
        yieldCalculation: 'Level Finance calculates its APY as: 7D (Trading fees + counterparty PnL + LVL minting fees + incentives) / Assets under Management * 52.',
        chartData: [{x: new Date(), y: 5}, {x: new Date(), y: 15}, {x: new Date(), y: 25}, {x: new Date(), y: 20}, {x: new Date(), y: 15}, {x: new Date(), y: 25}, {x: new Date(), y: 5}]
      }
    },

    async setupPoolBalance() {
      const lpTokenContract = new ethers.Contract(this.lpToken.address, erc20ABI, this.provider.getSigner());
      this.poolBalance = fromWei(await lpTokenContract.totalSupply());
    },

    async setupTvl() {
      this.tvl = (await (await fetch(`https://2t8c1g5jra.execute-api.us-east-1.amazonaws.com/levelTvl/${this.lpToken.symbol}`)).json()).tvl;
    },

    async setupRewards() {
      if (!this.smartLoanContract || !this.provider) return;

      const farmingContract = new ethers.Contract(FARMING_CONTRACT_ADDRESS, FARMING_ABI, this.provider.getSigner());
      this.rewards = fromWei(await farmingContract.pendingReward(this.lpToken.pid, this.smartLoanContract.address));

      this.rewardsInUsd = this.rewards * this.lvlPrice;
    },

    async setupLevelPriceAndRewards() {
      const redstonePriceDataRequest = await fetch(config.redstoneFeedUrl);
      const redstonePriceData = await redstonePriceDataRequest.json();

      this.lvlPrice = redstonePriceData['LVL'][0].dataPoints[0].value;

      this.setupRewards();
    },

    async getWalletLpTokenBalance() {
      const tokenContract = new ethers.Contract(this.lpToken.address, erc20ABI, this.provider.getSigner());

      return await this.getWalletTokenBalance(this.account, this.lpToken.symbol, tokenContract, this.lpToken.decimals);
    },

    watchAssetBalancesDataRefreshEvent() {
      this.dataRefreshEventService.assetBalancesDataRefreshEvent$.subscribe(() => {
        this.isLpBalanceEstimated = false;
        this.disableAllButtons = false;
        this.$forceUpdate();
      });
    },

    watchHardRefreshScheduledEvent() {
      this.dataRefreshEventService.hardRefreshScheduledEvent$.subscribe(() => {
        this.disableAllButtons = true;
        this.$forceUpdate();
      });
    },

    watchHealth() {
      this.healthService.observeHealth().subscribe(health => {
        this.healthLoaded = true;
      });
    },

    watchAssetApysRefresh() {
      this.dataRefreshEventService.observeAssetApysDataRefresh().subscribe(async () => {
        await this.setupApr();
      })
    },

    watchExternalAssetBalanceUpdate() {
      this.assetBalancesExternalUpdateService.observeExternalAssetBalanceUpdate().subscribe(updateEvent => {
        if (updateEvent.assetSymbol === this.lpToken.symbol) {
          this.levelLpBalances[this.lpToken.symbol] = updateEvent.balance;
          this.isLpBalanceEstimated = !updateEvent.isTrueData;
          this.$forceUpdate();
        }
      })
    },

    watchAsset() {
      this.dataRefreshEventService.observeAssetUpdatedEvent().subscribe(asset => {
        if (asset.symbol === this.lpToken.symbol) this.lpToken = asset;
        this.$forceUpdate();
      });
    },

    scheduleHardRefresh() {
      setTimeout(() => {
        this.progressBarService.emitProgressBarInProgressState();
        this.dataRefreshEventService.emitHardRefreshScheduledEvent();
      }, 3000)
    },

    watchProgressBarState() {
      this.progressBarService.progressBarState$.subscribe((state) => {
        switch (state) {
          case 'MINING' : {
            this.disableAllButtons = true;
            break;
          }
          case 'SUCCESS': {
            this.disableAllButtons = false;
            break;
          }
          case 'ERROR' : {
            this.disableAllButtons = false;
            this.isLpBalanceEstimated = false;
            break;
          }
          case 'CANCELLED' : {
            this.disableAllButtons = false;
            this.isLpBalanceEstimated = false;
            break;
          }
        }
      })
    },

    async fetchHistoricalPrices() {
      [this.weeklyPrices, this.weeklyMinPrice, this.weeklyMaxPrice, this.weeklyPriceChange] = await this.fetchPricesForInterval(3600 * 1000 * 7 * 24, 6 * 3600 * 1000);
      [this.dailyPrices, this.dailyMinPrice, this.dailyMaxPrice, this.dailyPriceChange] = await this.fetchPricesForInterval(3600 * 1000 * 24, 3600 * 1000);
    },

    async fetchPricesForInterval(period, interval) {
      const response = await redstone.getHistoricalPrice(this.lpToken.symbol, {
        startDate: Date.now() - period,
        interval: interval,
        endDate: Date.now(),
        provider: config.dataProviderHistoricalPrices
      });

      const [prices, minPrice, maxPrice] = chartPoints(
          response
      );

      const priceChange = prices && (prices[prices.length - 1].y - prices[0].y) / prices[prices.length - 1].y;

      return [prices, minPrice, maxPrice, priceChange];
    },

    handleTransactionError(error) {
      if (error.code === 404) {
        this.progressBarService.emitProgressBarErrorState('Action is currently disabled')
      }
      if (error.code === 4001 || error.code === -32603) {
        this.progressBarService.emitProgressBarCancelledState();
      } else {
        this.progressBarService.emitProgressBarErrorState();
      }
      this.closeModal();
      this.disableAllButtons = false;
      this.isLpBalanceEstimated = false;
    },

    watchActionDisabling() {
      this.globalActionsDisableService.getSectionActions$(ActionSection.LEVEL_LP)
          .subscribe(isActionDisabledRecord => {
            this.isActionDisabledRecord = isActionDisabledRecord;
            this.setupAddActionsConfiguration();
            this.setupRemoveActionsConfiguration();
            this.setupMoreActionsConfiguration();
          })
    },
  },
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.lp-table-row-component {
  height: 60px;
  transition: all 200ms;

  &.expanded {
    height: 477px;
  }

  .table__row {
    display: grid;
    grid-template-columns: repeat(6, 1fr) 120px 120px 60px 80px 22px;
    height: 60px;
    border-style: solid;
    border-width: 0 0 2px 0;
    border-image-source: var(--asset-table-row__border);
    border-image-slice: 1;
    padding-left: 6px;

    .table__cell {
      display: flex;
      flex-direction: row;

      &.asset {
        align-items: center;

        .asset__icon {
          cursor: pointer;
        }

        .asset__name {
          color: var(--default-text-color);
        }

        .asset__info {
          display: flex;
          flex-direction: column;
          justify-content: center;
          margin-left: 8px;
          font-weight: 500;
        }

        .asset__dex {
          font-size: $font-size-xxs;
          color: var(--asset-table-row__asset-loan-color);

          a {
            cursor: pointer;
          }
        }
      }

      &.balance, &.trend-level, &.rewards {
        align-items: flex-end;
      }

      &.capacity, &.rewards {
        flex-direction: column;
        justify-content: center;
        align-items: flex-end;
      }

      &.rewards {
        .lvl-logo {
          width: 20px;
          height: 20px;
          opacity: var(--asset-table-row__icon-opacity);
        }
      }

      &.trend-level {
        cursor: pointer;
        justify-content: center;
        align-items: center;
        margin-left: 66px;
      }

      &.apr, &.max-apr, &.tvl {
        align-items: flex-end;
      }

      &.max-apr {
        font-weight: 600;
      }

      &.actions {
        align-items: center;

        .actions__icon-button {
          &:not(:last-child) {
            margin-right: 12px;
          }
        }
      }

      &.table__cell--double-value {
        flex-direction: column;
        justify-content: center;

        .double-value__pieces {
          font-size: $font-size-xsm;
          font-weight: 600;
        }

        .double-value__usd {
          font-size: $font-size-xxs;
          color: var(--asset-table-row__double-value-color);
          font-weight: 500;
        }

        &.loan {
          .double-value__pieces {
            font-weight: 500;
          }
        }
      }

      .no-value-dash {
        height: 1px;
        width: 15px;
        background-color: var(--asset-table-row__no-value-dash-color);
      }
    }
  }

  .chart-container {
    margin: 2rem 0;

    .small-block-wrapper {
      height: unset;
    }
  }
}

.action-button {
  cursor: pointer;
  background: var(--icon-button-menu-beta__icon-color--default);

  &:not(:last-child) {
    margin-right: 12px;
  }

  &:hover {
    background: var(--icon-button-menu-beta__icon-color-hover--default);
  }

  &.action-button--disabled {
    background: var(--icon-button-menu-beta__icon-color--disabled);
    cursor: default;
    pointer-events: none;
  }
}

</style>
<style lang="scss">
.level {
  .table__row {
    .bar-gauge-beta-component .bar-gauge .bar {
      width: 80px;
    }
  }
}
</style>
