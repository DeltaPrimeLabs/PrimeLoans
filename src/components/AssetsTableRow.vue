<template>
  <div class="fund-table-row-component"
       :class="{'expanded': rowExpanded, 'expanded--trading-view': selectedChart === 'TradingView'}">
    <div class="table__row" v-if="asset" :class="{'inactive': asset.inactive}">
      <div class="table__cell asset">
        <img class="asset__icon" :src="getAssetIcon(asset.symbol)">
        <div class="asset__info">
          <div class="asset__name">
            {{ asset.symbol }}
            <img v-if="asset.droppingSupport && assetBalances[asset.symbol] > 0"
                 src="src/assets/icons/warning.svg"
                 v-tooltip="{content: `We will drop support to this asset soon. Please withdraw or swap to another token.`, classes: 'info-tooltip long'}">
            <img v-if="asset.warning"
                 src="src/assets/icons/warning.svg"
                 v-tooltip="{content: `${asset.warning}`, classes: 'info-tooltip long'}">
          </div>
          <div class="asset__loan" v-if="borrowApyPerPool && borrowApyPerPool[asset.symbol] !== undefined">
            Borrow&nbsp;APY:&nbsp;{{ borrowApyPerPool[asset.symbol] | percent }}
          </div>
          <div class="asset__loan" v-if="asset.apy">
            APY:&nbsp;{{ asset.apy / 100 | percent }}<span
            v-if="asset.hasIncentives + boostApy"><br>up to {{ 4.5 * asset.apy / 100 + boostApy | percent }}<img
            v-if="boostApy"
            v-tooltip="{content: `This pool is incentivized!<br>⁃ up to ${asset.apy ? (4.5 * asset.apy).toFixed(2) : 0}% Pool APR<br>⁃ up to ${boostApy ? (boostApy * 100).toFixed(2) : 0}% ${chain === 'arbitrum' ? 'ARB' : 'AVAX'} incentives`, classes: 'info-tooltip'}"
            src="src/assets/icons/stars.png" class="stars-icon"></span>
          </div>
        </div>
      </div>

      <div class="table__cell table__cell--double-value balance">
        <template
          v-if="assetBalances !== null && assetBalances !== undefined && parseFloat(assetBalances[asset.symbol]) && Number(smartRound(assetBalances[asset.symbol], 8, true)) > 0">
          <div class="double-value__pieces">
            <span v-if="isBalanceEstimated">~</span>{{ smartRound(assetBalances[asset.symbol], 8, true) }}
          </div>
          <div class="double-value__usd">
            <span v-if="assetBalances[asset.symbol]">{{ assetBalances[asset.symbol] * asset.price | usd }}</span>
          </div>
        </template>
        <template v-else>
          <div class="no-value-dash"></div>
        </template>
      </div>

      <div class="table__cell table__cell--double-value farmed">
        <template
          v-if="totalStaked">
          <div class="double-value__pieces">
            {{ totalStaked | smartRound }}
          </div>
          <div class="double-value__usd">
            <span v-if="totalStaked">{{ totalStaked * asset.price | usd }}</span>
          </div>
        </template>
        <template v-else>
          <div class="no-value-dash"></div>
        </template>
      </div>

      <div class="table__cell table__cell--double-value loan">
        <template v-if="debtsPerAsset && debtsPerAsset[asset.symbol] && parseFloat(debtsPerAsset[asset.symbol].debt)">
          <div class="double-value__pieces">
            <span v-if="isDebtEstimated">~</span>{{ debtsPerAsset[asset.symbol].debt | smartRound(8, true) }}
          </div>
          <div class="double-value__usd">{{ debtsPerAsset[asset.symbol].debt * asset.price | usd }}</div>
        </template>
        <template v-else>
          <div class="no-value-dash"></div>
        </template>
      </div>

      <div class="table__cell impact">
        <span>{{ Math.round((1 / (1 - asset.debtCoverage) - 1)) }}x</span>
      </div>

      <div class="table__cell trend">
        <div class="trend__chart-change" v-on:click="toggleChart()">
          <SmallChartBeta :data-points="asset.prices"
                          :is-stable-coin="asset.isStableCoin"
                          :line-width="2"
                          :width="60"
                          :height="25"
                          :positive-change="todayPriceChange > 0">
          </SmallChartBeta>
          <ColoredValueBeta v-if="todayPriceChange" :value="todayPriceChange" :formatting="'percent'"
                            :percentage-rounding-precision="2" :show-sign="true"></ColoredValueBeta>
        </div>
      </div>

      <div class="table__cell price">
        {{ asset.price | usd }}
      </div>

      <div></div>

      <div class="table__cell actions">
        <IconButton class="action-button"
                    :disabled="isActionDisabledRecord['ADD_FROM_WALLET'] || ((disableAllButtons) && (!(asset.debtCoverage > 0 && noSmartLoan)) || asset.inactive || asset.unsupported || asset.droppingSupport)"
                    :icon-src="'src/assets/icons/plus.svg'" :size="26"
                    v-tooltip="{content: 'Deposit collateral', classes: 'button-tooltip'}"
                    v-on:click="actionClick('ADD_FROM_WALLET')">
          <template
            v-if="(asset.symbol === nativeAssetOptions[0] && noSmartLoan && !isActionDisabledRecord['ADD_FROM_WALLET'])"
            v-slot:bubble>
            To create your Prime Account, click one of the
            <DeltaIcon class="icon-button__icon" :icon-src="'src/assets/icons/plus-white.svg'"
                       :size="26"
            ></DeltaIcon>
            buttons and deposit collateral.
          </template>
        </IconButton>
        <IconButton
          :disabled="isActionDisabledRecord['SWAP'] || disableAllButtons || asset.inactive || asset.unsupported || noSmartLoan"
          class="action-button"
          :icon-src="'src/assets/icons/swap.svg'" :size="26"
          v-tooltip="{content: 'Swap', classes: 'button-tooltip'}"
          v-on:click="actionClick('SWAP')">
        </IconButton>
        <IconButtonMenuBeta
          class="actions__icon-button"
          :config="moreActionsConfig"
          v-on:iconButtonClick="actionClick"
          :disabled="disableAllButtons || asset.inactive || noSmartLoan">
        </IconButtonMenuBeta>
      </div>
    </div>

    <div class="chart-container" v-if="rowExpanded">
      <SmallBlock v-on:close="toggleChart()">
        <Toggle class="chart-container__toggle" v-if="asset.tradingViewSymbol" v-on:change="onOptionChange"
                :options="['TradingView', 'Chart']"
                :initial-option="0"></Toggle>
        <Chart :data-points="asset.prices"
               :line-width="3"
               :min-y="asset.minPrice"
               :max-y="asset.maxPrice"
               :positive-change="todayPriceChange > 0"
               v-if="selectedChart === 'Chart'">
        </Chart>
        <TradingViewChart :trading-view-symbol="asset.tradingViewSymbol"
                          :index="index"
                          v-if="selectedChart === 'TradingView'"
                          class="trading-view-chart"
                          :class="{'trading-view-chart--visible': showTradingViewChart}"></TradingViewChart>
      </SmallBlock>
    </div>

  </div>
</template>

<script>
import SmallChartBeta from './SmallChartBeta';
import ColoredValueBeta from './ColoredValueBeta';
import IconButtonMenuBeta from './IconButtonMenuBeta';
import Chart from './Chart';
import SmallBlock from './SmallBlock';
import LoadedValue from './LoadedValue';
import config from '../config';
import {mapActions, mapState} from 'vuex';
import BorrowModal from './BorrowModal';
import SwapModal from './SwapModal';
import AddFromWalletModal from './AddFromWalletModal';
import WithdrawModal from './WithdrawModal';
import RepayModal from './RepayModal';
import erc20ABI from '../../test/abis/ERC20.json';
import WrapModal from './WrapModal';
import YAK_ROUTER_ABI
  from '../../test/abis/YakRouter.json';
import YAK_WRAP_ROUTER
  from '../../artifacts/contracts/interfaces/IYakWrapRouter.sol/IYakWrapRouter.json';
import {formatUnits, fromWei, parseUnits, smartRound} from '../utils/calculate';
import GLP_REWARD_ROUTER
  from '../../artifacts/contracts/interfaces/facets/avalanche/IRewardRouterV2.sol/IRewardRouterV2.json';
import GLP_REWARD_TRACKER
  from '../../artifacts/contracts/interfaces/facets/avalanche/IRewardTracker.sol/IRewardTracker.json';
import ClaimGLPRewardsModal from './ClaimGLPRewardsModal';
import DeltaIcon from './DeltaIcon.vue';
import IconButton from './IconButton.vue';
import {constructSimpleSDK, ContractMethod, SwapSide} from '@paraswap/sdk';
import axios from 'axios';
import TradingViewChart from './TradingViewChart.vue';
import Toggle from './Toggle.vue';
import {BigNumber} from 'ethers';
import SwapDebtModal from './SwapDebtModal.vue';
import MintCAIModal from './MintCAIModal.vue';
import {ActionSection} from '../services/globalActionsDisableService';
import AddToWithdrawQueueModal from './AddToWithdrawQueueModal.vue';

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

const ethers = require('ethers');
let TOKEN_ADDRESSES;

export default {
  name: 'AssetsTableRow',
  components: {
    Toggle,
    TradingViewChart,
    IconButton,
    DeltaIcon, LoadedValue, SmallBlock, Chart, IconButtonMenuBeta, ColoredValueBeta, SmallChartBeta
  },
  props: {
    asset: {},
    index: null,
  },
  async mounted() {
    this.chain = window.chain;
    await this.setupFiles();
    this.setupBorrowable();
    this.setupAvailableFarms();
    this.setupActionsConfiguration();
    this.watchExternalAssetBalanceUpdate();
    this.watchExternalAssetDebtUpdate();
    this.watchAssetBalancesDataRefreshEvent();
    this.watchDebtsPerAssetDataRefreshEvent();
    this.watchHardRefreshScheduledEvent();
    this.watchHealth();
    this.watchAssetApysRefreshScheduledEvent();
    this.watchProgressBarState();
    this.setupPoolsApy();
    this.watchExternalTotalStakedUpdate();
    this.watchFarmRefreshEvent();
    this.watchLtipMaxBoostUpdate();
    this.watchActionDisabling();
    this.watchWithdrawalIntents();

  },
  data() {
    return {
      chain: null,
      borrowable: [],
      moreActionsConfig: null,
      rowExpanded: false,
      isBalanceEstimated: false,
      isDebtEstimated: false,
      disableAllButtons: false,
      borrowApyPerPool: {},
      healthLoaded: false,
      totalStaked: null,
      availableFarms: [],
      nativeAssetOptions: config.NATIVE_ASSET_TOGGLE_OPTIONS,
      selectedChart: 'TradingView',
      showTradingViewChart: false,
      avalancheChain: window.avalancheChain,
      currentlyOpenModalInstance: null,
      boostApy: 0,
      isActionDisabledRecord: {},
      intents: null,
    };
  },
  computed: {
    ...mapState('fundsStore', [
      'smartLoanContract',
      'health',
      'assetBalances',
      'assetAvailableBalances',
      'fullLoanStatus',
      'debtsPerAsset',
      'assets',
      'lpAssets',
      'concentratedLpAssets',
      'levelLpAssets',
      'lpBalances',
      'levelLpBalances',
      'concentratedLpBalances',
      'traderJoeV2LpAssets',
      'traderJoeV2LpAssets',
      'traderJoeV2LpAssets',
      'balancerLpAssets',
      'balancerLpBalances',
      'gmxV2Assets',
      'gmxV2Balances',
      'penpieLpBalances',
      'penpieLpAssets',
      'wombatLpAssets',
      'wombatLpBalances',
      'wombatYYFarmsBalances',
      'noSmartLoan',
    ]),
    ...mapState('stakeStore', ['farms']),
    ...mapState('poolStore', ['pools']),
    ...mapState('network', ['provider', 'account', 'accountBalance']),
    ...mapState('serviceRegistry', [
      'assetBalancesExternalUpdateService',
      'dataRefreshEventService',
      'progressBarService',
      'assetDebtsExternalUpdateService',
      'poolService',
      'healthService',
      'stakedExternalUpdateService',
      'farmService',
      'ltipService',
      'globalActionsDisableService',
      'paWithdrawQueueService'
    ]),

    loanValue() {
      return this.formatTokenBalance(this.debt);
    },

    hasSmartLoanContract() {
      return this.smartLoanContract && this.smartLoanContract.address !== NULL_ADDRESS;
    },

    todayPriceChange() {
      return this.asset.prices && (this.asset.prices[this.asset.prices.length - 1].y - this.asset.prices[0].y) / this.asset.prices[this.asset.prices.length - 1].y;
    }
  },
  methods: {
    ...mapActions('fundsStore',
      [
        'swap',
        'paraSwapV2',
        'swapDebt',
        'fund',
        'borrow',
        'withdraw',
        'withdrawNativeToken',
        'repay',
        'createAndFundLoan',
        'createLoanAndDeposit',
        'fundNativeToken',
        'wrapNativeToken',
        'mintAndStakeGlp',
        'unstakeAndRedeemGlp',
        'claimGLPRewards',
        'mintCAI',
        'burnCAI',
      ]),
    ...mapActions('network', ['updateBalance']),
    async setupFiles() {
      TOKEN_ADDRESSES = await import(`/common/addresses/${window.chain}/token_addresses.json`);
    },
    smartRound(value, precision = 8, toFixed = false) {
      return smartRound(value, precision, toFixed)
    },
    setupBorrowable() {
      this.borrowable = Object.entries(config.POOLS_CONFIG).filter(([asset, info]) => !info.disabled).map(el => el[0]);
    },
    onOptionChange(selected) {
      this.selectedChart = selected
      if (this.selectedChart === 'TradingView') {
        setTimeout(() => {
          this.showTradingViewChart = true
        }, 300)
      } else {
        this.showTradingViewChart = false
      }
    },
    setupActionsConfiguration() {
      this.moreActionsConfig = {
        iconSrc: 'src/assets/icons/icon_a_more.svg',
        tooltip: 'More',
        menuOptions: [
          ...(this.borrowable.includes(this.asset.symbol) ?
            [
              {
                key: 'BORROW',
                name: 'Borrow',
                disabled: this.isActionDisabledRecord['BORROW'] || this.borrowDisabled(),
                disabledInfo: 'To borrow, you need to add some funds from you wallet first'
              },
              {
                key: 'REPAY',
                name: 'Repay',
                disabled: this.isActionDisabledRecord['REPAY'],
              },
              {
                key: 'SWAP_DEBT',
                name: 'Swap debt',
                disabled: this.isActionDisabledRecord['SWAP_DEBT'],
              }
            ]
            : []),
          this.asset.symbol === this.nativeAssetOptions[0] ? {
            key: 'WRAP',
            name: `Wrap native ${this.nativeAssetOptions[0]}`,
            hidden: true,
            disabled: this.isActionDisabledRecord['WRAP'],
          } : null,
          this.asset.symbol === 'GLP' ? {
            disabled: this.isActionDisabledRecord['CLAIM_GLP_REWARDS'] || !this.hasSmartLoanContract,
            key: 'CLAIM_GLP_REWARDS',
            name: 'Claim GLP rewards',
          } : null,

          this.asset.symbol === 'CAI' ? {
            key: 'CAI_MINT',
            name: 'Mint CAI',
            disabled: config.ASSETS_CONFIG['CAI'].droppingSupport,
          } : null,

          this.asset.symbol === 'CAI' ? {
            key: 'CAI_BURN',
            name: 'Burn CAI',
          } : null,

          {
            key: 'WITHDRAW',
            name: 'Withdraw collateral',
            disabled: this.isActionDisabledRecord['WITHDRAW'],
          },
        ]
      };
    },

    toggleChart() {
      if (this.rowExpanded) {
        this.rowExpanded = false;
        this.showTradingViewChart = false;
        this.selectedChart = this.asset.tradingViewSymbol ? 'TradingView' : 'Chart'
      } else {
        this.rowExpanded = true;
        setTimeout(() => {
          this.showTradingViewChart = true;
        }, 200);
      }
    },

    formatTokenBalance(balance) {
      const balanceOrderOfMagnitudeExponent = String(balance).split('.')[0].length - 1;
      const precisionMultiplierExponent = 5 - balanceOrderOfMagnitudeExponent;
      const precisionMultiplier = Math.pow(10, precisionMultiplierExponent >= 0 ? precisionMultiplierExponent : 0);
      return balance !== null ? String(Math.round(balance * precisionMultiplier) / precisionMultiplier) : '';
    },

    yakSwapQueryMethod() {
      return async (sourceAsset, targetAsset, amountIn) => {
        const tknFrom = TOKEN_ADDRESSES[sourceAsset];
        const tknTo = TOKEN_ADDRESSES[targetAsset];

        if (sourceAsset !== 'GLP' && targetAsset !== 'GLP') {
          const readProvider = new ethers.providers.JsonRpcProvider(config.readRpcUrl);
          const yakRouter = new ethers.Contract(config.yakRouterAddress, YAK_ROUTER_ABI, readProvider);

          const maxHops = 3;
          const gasPrice = ethers.utils.parseUnits('0.2', 'gwei');

          try {
            const route = {
              ...(await yakRouter.findBestPathWithGas(
                amountIn,
                tknFrom,
                tknTo,
                maxHops,
                gasPrice,
                {gasLimit: 1e9}
              ))
            }
            if (route[0].length === 0 && route[1].length === 0 && route[2].length === 0) {
              this.progressBarService.emitProgressBarErrorState('The selected aggregator could not find a route. Please switch aggregator, increase slippage or try again later.')
              this.cleanupAfterError(false);
            }
            return {
              ...route,
              dex: 'YAK_SWAP'
            };
          } catch (e) {
            this.handleTransactionError(e);
          }
        } else {
          const yakWrapRouter = new ethers.Contract(config.yakWrapRouterAddress, YAK_WRAP_ROUTER.abi, provider.getSigner());

          const maxHops = 3;
          const gasPrice = ethers.utils.parseUnits('0', 'gwei');

          if (targetAsset === 'GLP') {
            try {
              return await yakWrapRouter.findBestPathAndWrap(
                amountIn,
                tknFrom,
                config.yieldYakGlpWrapperAddress,
                maxHops,
                gasPrice);
            } catch (e) {
              this.handleTransactionError(e);
            }
          } else {
            try {
              return {
                ...(await yakWrapRouter.unwrapAndFindBestPath(
                  amountIn,
                  tknTo,
                  config.yieldYakGlpWrapperAddress,
                  maxHops,
                  gasPrice)),
                dex: 'YAK_SWAP'
              }
            } catch (e) {
              this.handleTransactionError(e);
            }
          }
        }
      };
    },

    swapDebtQueryMethod() {
      return async (sourceAsset, targetAsset, amountIn, amountOut) => {
        console.log('sourceAsset', sourceAsset);
        console.log('targetAsset', targetAsset);
        console.log('amountIn', amountIn);
        console.log('amountOut', amountOut);
        const tknFrom = TOKEN_ADDRESSES[sourceAsset];
        const tknTo = TOKEN_ADDRESSES[targetAsset];

        const readProvider = new ethers.providers.JsonRpcProvider(config.readRpcUrl);
        const yakRouter = new ethers.Contract(config.yakRouterAddress, YAK_ROUTER_ABI, readProvider);

        const maxHops = 3;
        const gasPrice = ethers.utils.parseUnits('0.2', 'gwei');

        const MAX_TRY_AMOUNT = 20;

        let i = 0;
        let targetBorrowedAmount = amountOut;

        console.log(i);

        console.log('targetBorrowedAmount', targetBorrowedAmount);
        console.log('tknFrom', tknFrom);
        console.log('tknTo', tknTo);
        console.log('maxHops', maxHops);
        console.log('gasPrice', gasPrice);

        // targetBorrowedAmount: 0x50f495
        // tknFrom: 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7
        // tknTo: 0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e
        // maxHops: 3
        // gasPrice: 0x0bebc200
        // amountIn = amountIn.mul(BigNumber.from('10005')).div(BigNumber.from('10000'));
        try {
          let path = await yakRouter.findBestPathWithGas(
            amountIn,
            tknFrom,
            tknTo,
            maxHops,
            gasPrice,
            {gasLimit: 1e12}
          );

          console.log('path');
          console.log(path);
          return path;

          // if (path.amounts[path.amounts.length - 1].gt(amountIn)) {
          //   return path;
          // }

          targetBorrowedAmount = targetBorrowedAmount.mul(BigNumber.from('10005')).div(BigNumber.from('10000'));
        } catch (e) {
          this.handleTransactionError(e);
        } finally {
          i++;
        }
      }
    },

    paraSwapV2QueryMethod() {
      return async (sourceAsset, targetAsset, amountIn) => {
        console.warn('PARA SWAP 2 QUERY METHOD');
        const paraSwapSDK = constructSimpleSDK({chainId: config.chainId, axios});

        try {
          const swapRate = await paraSwapSDK.swap.getRate({
            srcToken: TOKEN_ADDRESSES[sourceAsset],
            srcDecimals: config.ASSETS_CONFIG[sourceAsset].decimals,
            destToken: TOKEN_ADDRESSES[targetAsset],
            destDecimals: config.ASSETS_CONFIG[targetAsset].decimals,
            amount: amountIn,
            userAddress: this.smartLoanContract.address,
            side: SwapSide.SELL,
            includeContractMethods: [
              "swapExactAmountIn",
              "swapExactAmountInOnUniswapV3",
            ],
            version: 6.2,
          });

          const sourceAmountWei = parseUnits(Number(`${swapRate.srcAmount}e-${swapRate.srcDecimals}`).toFixed(swapRate.srcDecimals), swapRate.srcDecimals);
          const targetAmountWei = parseUnits(Number(`${swapRate.destAmount}e-${swapRate.destDecimals}`).toFixed(swapRate.destDecimals), swapRate.destDecimals);

          const queryResponse = {
            amounts: [sourceAmountWei, targetAmountWei],
            dex: 'PARA_SWAP',
            swapRate: swapRate
          };

          console.log('queryResponse', queryResponse);
          return queryResponse;
        } catch (error) {
          console.warn('para swap query method error');
          console.log(error);
          console.log(typeof error);
          console.log(String(error));
          if (String(error).includes('No routes found with enough liquidity')) {
            this.progressBarService.emitProgressBarErrorState('The selected aggregator could not find a route. Please switch aggregator, increase slippage or try again later.')
            this.cleanupAfterError(false);
          } else if (String(error).includes('ESTIMATED_LOSS_GREATER_THAN_MAX_IMPACT')) {
            this.progressBarService.emitProgressBarErrorState('Source amount too low')
            this.cleanupAfterError(false);
          } else {
            // Any other random error
            this.progressBarService.emitProgressBarErrorState('The selected aggregator encountered unexpected error. Please switch aggregator or try again later.')
            this.cleanupAfterError(false);
          }
        }
      };
    },

    directGLPMintQueryMethod() {
      return async (sourceAsset, targetAsset, amountInWei) => {
        const amountIn = parseFloat(formatUnits(amountInWei, this.assets[sourceAsset].decimals));
        const estimated = amountIn * this.assets[sourceAsset].price / this.assets[targetAsset].price;

        const targetDecimals = this.assets[targetAsset].decimals;
        return Promise.resolve(parseUnits(estimated.toFixed(targetDecimals), targetDecimals));
      }
    },

    actionClick(key) {
      if (!this.isActionDisabledRecord[key] && !this.disableAllButtons || (this.noSmartLoan && this.asset.debtCoverage > 0 && key === 'ADD_FROM_WALLET')) {
        switch (key) {
          case 'BORROW':
            this.openBorrowModal();
            break;
          case 'ADD_FROM_WALLET':
            this.openAddFromWalletModal();
            break;
          case 'BRIDGE_COLLATERAL':
            this.openBridgeModal();
            break;
          case 'WITHDRAW':
            this.openWithdrawModal();
            break;
          case 'REPAY':
            this.openRepayModal();
            break;
          case 'SWAP':
            this.openSwapModal();
            break;
          case 'SWAP_DEBT':
            this.openDebtSwapModal();
            break;
          case 'WRAP':
            this.openWrapModal();
            break;
          case 'CLAIM_GLP_REWARDS':
            this.claimGLPRewardsAction();
            break;
          case 'CAI_MINT':
            this.openCAIMintModal();
            break;
          case 'CAI_BURN':
            this.openCAIBurnModal();
            break;
        }
      }
    },

    borrowDisabled() {
      if (!this.pools) {
        return true;
      }
      if (!this.hasSmartLoanContract) {
        return true;
      }
      return false;
    },

    openBorrowModal() {
      this.progressBarService.progressBarState$.next('SUCCESS');
      const pool = this.poolService.pools.find(pool => pool.asset.symbol === this.asset.symbol);
      const modalInstance = this.openModal(BorrowModal);
      modalInstance.asset = this.asset;
      modalInstance.assets = this.assets;
      modalInstance.assetBalances = this.assetBalances;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.concentratedLpAssets = this.concentratedLpAssets;
      modalInstance.traderJoeV2LpAssets = this.traderJoeV2LpAssets;
      modalInstance.levelLpAssets = this.levelLpAssets;
      modalInstance.gmxV2Assets = this.gmxV2Assets;
      modalInstance.levelLpBalances = this.levelLpBalances;
      modalInstance.lpBalances = this.lpBalances;
      modalInstance.balancerLpBalances = this.balancerLpBalances;
      modalInstance.balancerLpAssets = this.balancerLpAssets;
      modalInstance.penpieLpAssets = this.penpieLpAssets;
      modalInstance.penpieLpBalances = this.penpieLpBalances;
      modalInstance.wombatLpAssets = this.wombatLpAssets;
      modalInstance.wombatLpBalances = this.wombatLpBalances;
      modalInstance.wombatYYFarmsBalances = this.wombatYYFarmsBalances;
      modalInstance.concentratedLpBalances = this.concentratedLpBalances;
      modalInstance.gmxV2Balances = this.gmxV2Balances;
      modalInstance.farms = this.farms;
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.assetBalance = Number(this.assetBalances[this.asset.symbol]);
      modalInstance.debt = this.fullLoanStatus.debt;
      modalInstance.thresholdWeightedValue = this.fullLoanStatus.thresholdWeightedValue;
      modalInstance.availableInPool = Number(pool.tvl) - Number(pool.totalBorrowed);
      modalInstance.poolTVL = Number(pool.tvl);
      modalInstance.totalBorrowedFromPool = Number(pool.totalBorrowed);
      modalInstance.loanAPY = pool.borrowingAPY;
      modalInstance.maxUtilisation = pool.maxUtilisation;
      modalInstance.availableToBorrow = pool.availableToBorrow;
      modalInstance.$on('BORROW', value => {
        const borrowRequest = {
          asset: this.asset.symbol,
          amount: value.toString()
        };
        this.handleTransaction(this.borrow, {borrowRequest: borrowRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        })
          .then(() => {
          });
      });
    },

    openSwapModal() {
      let swapDexSwapMethodMap = {};

      if (config.SWAP_DEXS_CONFIG.YakSwap && config.SWAP_DEXS_CONFIG.YakSwap.availableAssets && config.SWAP_DEXS_CONFIG.YakSwap.availableAssets.includes(this.asset.symbol)) swapDexSwapMethodMap.YakSwap = this.swap;
      if (config.SWAP_DEXS_CONFIG.ParaSwapV2 && config.SWAP_DEXS_CONFIG.ParaSwapV2.availableAssets && config.SWAP_DEXS_CONFIG.ParaSwapV2.availableAssets.includes(this.asset.symbol)) swapDexSwapMethodMap.ParaSwapV2 = this.paraSwapV2;

      const modalInstance = this.openModal(SwapModal);
      this.currentlyOpenModalInstance = modalInstance;
      modalInstance.dexOptions = Object.entries(config.SWAP_DEXS_CONFIG)
        .filter(([dexName, dexConfig]) => dexConfig.availableAssets.includes(this.asset.symbol) && (!dexConfig.coreAsset || this.asset.symbol === dexConfig.coreAsset))
        .map(([dexName, dexConfig]) => dexConfig.displayName);
      modalInstance.swapDex = Object.entries(config.SWAP_DEXS_CONFIG).filter(([k, v]) => v.availableAssets.includes(this.asset.symbol))[0][0];
      modalInstance.swapDebtMode = false;
      modalInstance.sourceAsset = this.asset.symbol;
      modalInstance.sourceAssetBalance = this.assetAvailableBalances[this.asset.symbol];
      modalInstance.assetAvailableBalances = this.assetAvailableBalances;
      modalInstance.assets = this.assets;
      modalInstance.assetBalances = this.assetBalances;
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.concentratedLpAssets = this.concentratedLpAssets;
      modalInstance.levelLpAssets = this.levelLpAssets;
      modalInstance.traderJoeV2LpAssets = this.traderJoeV2LpAssets;
      modalInstance.gmxV2Assets = this.gmxV2Assets;
      modalInstance.lpBalances = this.lpBalances;
      modalInstance.balancerLpBalances = this.balancerLpBalances;
      modalInstance.balancerLpAssets = this.balancerLpAssets;
      modalInstance.concentratedLpBalances = this.concentratedLpBalances;
      modalInstance.levelLpBalances = this.levelLpBalances;
      modalInstance.gmxV2Balances = this.gmxV2Balances;
      modalInstance.penpieLpAssets = this.penpieLpAssets;
      modalInstance.penpieLpBalances = this.penpieLpBalances;
      modalInstance.wombatLpAssets = this.wombatLpAssets;
      modalInstance.wombatLpBalances = this.wombatLpBalances;
      modalInstance.wombatYYFarmsBalances = this.wombatYYFarmsBalances;
      modalInstance.farms = this.farms;
      modalInstance.targetAsset = Object.keys(config.ASSETS_CONFIG).filter(asset => asset !== this.asset.symbol)[0];
      modalInstance.debt = this.fullLoanStatus.debt;
      modalInstance.thresholdWeightedValue = this.fullLoanStatus.thresholdWeightedValue ? this.fullLoanStatus.thresholdWeightedValue : 0;
      modalInstance.health = this.fullLoanStatus.health;
      modalInstance.queryMethods = {
        YakSwap: this.yakSwapQueryMethod(),
        ParaSwapV2: this.paraSwapV2QueryMethod(),
        GLP_DIRECT: this.directGLPMintQueryMethod(),
      };

      modalInstance.$on('SWAP', swapEvent => {
        let swapMethod = () => {
        }
        let swapRequest = {}
        if (swapEvent.swapDex === 'GLP_DIRECT') {
          if (swapEvent.sourceAsset === 'GLP') {
            swapRequest = {
              sourceAsset: swapEvent.sourceAsset,
              targetAsset: swapEvent.targetAsset,
              targetAmount: swapEvent.targetAmount.toString(),
              glpAmount: swapEvent.sourceAmount.toString()
            };
            swapMethod = this.unstakeAndRedeemGlp
          } else {
            swapRequest = {
              sourceAsset: swapEvent.sourceAsset,
              sourceAmount: swapEvent.sourceAmount.toString(),
              minGlp: swapEvent.targetAmount.toString(),
              minUsdValue: (swapEvent.targetAmount * this.assets['GLP'].price).toString()
            };
            swapMethod = this.mintAndStakeGlp
          }
        } else {
          swapRequest = {
            ...swapEvent,
            sourceAmount: swapEvent.sourceAmount.toString()
          };
          swapMethod = swapDexSwapMethodMap[swapRequest.swapDex]
        }

        this.handleTransaction(swapMethod, {swapRequest: swapRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
        });
      });

      modalInstance.initiate();
    },

    openDebtSwapModal() {
      const modalInstance = this.openModal(SwapModal);
      this.currentlyOpenModalInstance = modalInstance;
      modalInstance.dexOptions = Object.entries(config.SWAP_DEXS_CONFIG)
        .filter(([dexName, dexConfig]) => dexConfig.availableAssets.includes(this.asset.symbol))
        .map(([dexName, dexConfig]) => dexName);
      modalInstance.swapDex = Object.keys(config.SWAP_DEXS_CONFIG)[0];
      modalInstance.title = 'Swap debt';
      modalInstance.swapDebtMode = true;
      modalInstance.slippageMargin = 0.2;
      modalInstance.sourceAsset = this.asset.symbol;
      modalInstance.sourceAssetBalance = this.assetAvailableBalances[this.asset.symbol];
      modalInstance.assetAvailableBalances = this.assetAvailableBalances;
      modalInstance.sourceAssetDebt = this.debtsPerAsset[this.asset.symbol].debt;
      modalInstance.assets = this.assets;
      modalInstance.sourceAssets = this.borrowable;
      modalInstance.targetAssets = this.borrowable;
      modalInstance.assetBalances = this.assetBalances;
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.concentratedLpAssets = this.concentratedLpAssets;
      modalInstance.traderJoeV2LpAssets = this.traderJoeV2LpAssets;
      modalInstance.gmxV2Assets = this.gmxV2Assets;
      modalInstance.levelLpAssets = this.levelLpAssets;
      modalInstance.levelLpBalances = this.levelLpBalances;
      modalInstance.lpBalances = this.lpBalances;
      modalInstance.concentratedLpBalances = this.concentratedLpBalances;
      modalInstance.gmxV2Balances = this.gmxV2Balances;
      modalInstance.penpieLpAssets = this.penpieLpAssets;
      modalInstance.penpieLpBalances = this.penpieLpBalances;
      modalInstance.wombatLpAssets = this.wombatLpAssets;
      modalInstance.wombatLpBalances = this.wombatLpBalances;
      modalInstance.wombatYYFarmsBalances = this.wombatYYFarmsBalances;
      modalInstance.balancerLpBalances = this.balancerLpBalances;
      modalInstance.balancerLpAssets = this.balancerLpAssets;
      modalInstance.farms = this.farms;
      modalInstance.targetAsset = this.borrowable.filter(asset => asset !== this.asset.symbol)[0];
      modalInstance.debt = this.fullLoanStatus.debt;
      modalInstance.thresholdWeightedValue = this.fullLoanStatus.thresholdWeightedValue ? this.fullLoanStatus.thresholdWeightedValue : 0;
      modalInstance.health = this.fullLoanStatus.health;
      modalInstance.queryMethod = this.swapDebtQueryMethod();
      modalInstance.$on('SWAP', swapEvent => {
        const swapDebtRequest = {
          ...swapEvent,
          sourceAmount: swapEvent.sourceAmount.toString()
        };
        this.handleTransaction(this.swapDebt, {swapDebtRequest: swapDebtRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
        });
      });

      modalInstance.initiate();
    },

    async openAddFromWalletModal() {
      const modalInstance = this.openModal(AddFromWalletModal);
      this.updateBalance().then(() => {
        modalInstance.setWalletNativeTokenBalance(this.accountBalance);
        this.$forceUpdate();
      });

      modalInstance.asset = this.asset;
      modalInstance.assetBalance = this.assetBalances && this.assetBalances[this.asset.symbol] ? this.assetBalances[this.asset.symbol] : 0;
      modalInstance.assets = this.assets;
      modalInstance.assetBalances = this.assetBalances;
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.concentratedLpAssets = this.concentratedLpAssets;
      modalInstance.lpBalances = this.lpBalances;
      modalInstance.levelLpAssets = this.levelLpAssets;
      modalInstance.levelLpBalances = this.levelLpBalances;
      modalInstance.concentratedLpBalances = this.concentratedLpBalances;
      modalInstance.traderJoeV2LpAssets = this.traderJoeV2LpAssets;
      modalInstance.gmxV2Assets = this.gmxV2Assets;
      modalInstance.gmxV2Balances = this.gmxV2Balances;
      modalInstance.penpieLpAssets = this.penpieLpAssets;
      modalInstance.penpieLpBalances = this.penpieLpBalances;
      modalInstance.wombatLpAssets = this.wombatLpAssets;
      modalInstance.wombatLpBalances = this.wombatLpBalances;
      modalInstance.wombatYYFarmsBalances = this.wombatYYFarmsBalances;
      modalInstance.balancerLpBalances = this.balancerLpBalances;
      modalInstance.balancerLpAssets = this.balancerLpAssets;
      modalInstance.farms = this.farms;
      modalInstance.loan = this.fullLoanStatus.debt ? this.fullLoanStatus.debt : 0;
      modalInstance.thresholdWeightedValue = this.fullLoanStatus.thresholdWeightedValue ? this.fullLoanStatus.thresholdWeightedValue : 0;
      modalInstance.walletAssetBalance = await this.getWalletAssetBalance();
      modalInstance.noSmartLoan = this.noSmartLoan;
      modalInstance.$on('ADD_FROM_WALLET', addFromWalletEvent => {
        if (this.smartLoanContract) {
          const value = addFromWalletEvent.value;

          if (this.smartLoanContract.address === NULL_ADDRESS || this.noSmartLoan) {
            if (this.asset.symbol === 'GLP') {
              const request = {
                value: value,
                asset: this.asset.symbol,
                assetAddress: '0xaE64d55a6f09E4263421737397D1fdFA71896a69',
                assetDecimals: config.ASSETS_CONFIG[this.asset.symbol].decimals
              };

              this.handleTransaction(this.createLoanAndDeposit, {request: request}, () => {
                  this.scheduleHardRefresh();
                  this.$forceUpdate();
                },
                (error) => {
                  this.handleTransactionError(error);
                });
            } else {
              this.handleTransaction(this.createAndFundLoan, {
                  asset: addFromWalletEvent.asset,
                  value: value,
                  isLP: false
                }, () => {
                  this.scheduleHardRefresh();
                  this.$forceUpdate();
                },
                (error) => {
                  this.handleTransactionError(error);
                });
            }
          } else {
            if (addFromWalletEvent.asset === this.nativeAssetOptions[0]) {
              this.handleTransaction(this.fundNativeToken, {value: value}, () => {
                this.$forceUpdate();
              }, (error) => {
                this.handleTransactionError(error);
              }).then(() => {
              });
            } else {
              const fundRequest = {
                value: value,
                asset: this.asset.symbol,
                assetDecimals: config.ASSETS_CONFIG[this.asset.symbol].decimals,
                type: 'ASSET',
              };
              this.handleTransaction(this.fund, {fundRequest: fundRequest}, () => {
                this.$forceUpdate();
              }, (error) => {
                this.handleTransactionError(error);
              }).then(() => {
              });
            }
          }
        }
      });
    },

    openWithdrawModal() {
      const modalInstance = this.openModal(AddToWithdrawQueueModal);
      let queue = [];
      let extraIntents = 0
      if (this.intents && this.intents.length > 0) {
        queue = this.intents.slice(0, 2).map(intent => ({
          amount: intent.amount,
          symbol: this.asset.symbol,
          status: intent.isPending ? 'PENDING' : 'READY',
          date: intent.isPending ? intent.actionableAt : intent.expiresAt
        }));
        extraIntents = this.intents.length - queue.length;
      }
      modalInstance.assetBalance = this.assetAvailableBalances[this.asset.symbol];
      modalInstance.asset = config.ASSETS_CONFIG[this.asset.symbol];
      modalInstance.queue = queue;
      modalInstance.extraIntents = extraIntents;
      modalInstance.$on('WITHDRAW', withdrawEvent => {
        console.log(withdrawEvent);
        this.paWithdrawQueueService.createWithdrawalIntent(this.asset.symbol, withdrawEvent.value)

      });
    },

    async openBridgeModal() {
      const modalInstance = this.openModal(BridgeModal);
      modalInstance.noSmartLoan = this.noSmartLoan;
      modalInstance.$on('BRIDGE', bridgeEvent => {
        if (this.smartLoanContract) {
          // To-Do: Lifi Bridge for prime account page
        }
      });
    },

    openRepayModal() {
      const modalInstance = this.openModal(RepayModal);
      modalInstance.asset = this.asset;
      modalInstance.assets = this.assets;
      modalInstance.assetBalances = this.assetBalances;
      modalInstance.assetAvailableBalances = this.assetAvailableBalances;
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.lpBalances = this.lpBalances;
      modalInstance.concentratedLpAssets = this.concentratedLpAssets;
      modalInstance.traderJoeV2LpAssets = this.traderJoeV2LpAssets;
      modalInstance.levelLpAssets = this.levelLpAssets;
      modalInstance.levelLpBalances = this.levelLpBalances;
      modalInstance.concentratedLpBalances = this.concentratedLpBalances;
      modalInstance.gmxV2Assets = this.gmxV2Assets;
      modalInstance.gmxV2Balances = this.gmxV2Balances;
      modalInstance.penpieLpAssets = this.penpieLpAssets;
      modalInstance.penpieLpBalances = this.penpieLpBalances;
      modalInstance.wombatLpAssets = this.wombatLpAssets;
      modalInstance.wombatLpBalances = this.wombatLpBalances;
      modalInstance.wombatYYFarmsBalances = this.wombatYYFarmsBalances;
      modalInstance.balancerLpBalances = this.balancerLpBalances;
      modalInstance.balancerLpAssets = this.balancerLpAssets;
      modalInstance.farms = this.farms;
      modalInstance.health = this.fullLoanStatus.health;
      modalInstance.debt = this.fullLoanStatus.debt;
      modalInstance.thresholdWeightedValue = this.fullLoanStatus.thresholdWeightedValue ? this.fullLoanStatus.thresholdWeightedValue : 0;
      modalInstance.assetDebt = Number(this.debtsPerAsset[this.asset.symbol].debt);
      modalInstance.$on('REPAY', repayEvent => {
        const repayRequest = {
          asset: this.asset.symbol,
          decimals: this.asset.decimals,
          amount: repayEvent.repayValue.toString(),
          isMax: repayEvent.isMax
        };
        this.handleTransaction(this.repay, {repayRequest: repayRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        })
          .then(() => {
          });
      });
    },

    async openWrapModal() {
      const smartContractNativeTokenBalance = await this.getSmartLoanContractNativeTokenBalance();
      const modalInstance = this.openModal(WrapModal);
      modalInstance.asset = this.asset;
      modalInstance.assetBalance = this.assetBalances[this.asset.symbol];
      modalInstance.nativeTokenBalance = smartContractNativeTokenBalance;

      modalInstance.$on('WRAP', value => {
        const wrapRequest = {
          amount: value.toString(),
          decimals: this.asset.decimals,
        };
        this.handleTransaction(this.wrapNativeToken, {wrapRequest: wrapRequest}, () => {
          this.assetBalances[this.asset.symbol] = Number(this.assetBalances[this.asset.symbol]) + Number(wrapRequest.amount);
          this.isBalanceEstimated = true;
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
        });
      });
    },

    async claimGLPRewardsAction() {
      const avalancheChain = config.chainSlug === 'avalanche';
      const rewardsDecimals = avalancheChain ? config.ASSETS_CONFIG.AVAX.decimals : config.ASSETS_CONFIG.ETH.decimals;
      const glpRewardRouterContract = new ethers.Contract(config.glpRewardsRouterAddress, GLP_REWARD_ROUTER.abi, this.provider.getSigner());
      const feeGLPTrackerAddress = await glpRewardRouterContract.feeGlpTracker();
      const feeGLPTrackedContract = new ethers.Contract(feeGLPTrackerAddress, GLP_REWARD_TRACKER.abi, this.provider.getSigner());
      const rewards = formatUnits(await feeGLPTrackedContract.claimable(this.smartLoanContract.address), rewardsDecimals);
      const modalInstance = this.openModal(ClaimGLPRewardsModal);
      modalInstance.assetBalances = this.assetBalances;
      modalInstance.glpRewardsToClaim = rewards;
      modalInstance.glpRewardsAsset = avalancheChain ? 'AVAX' : 'ETH';

      modalInstance.$on('CLAIM', () => {
        this.handleTransaction(this.claimGLPRewards, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
        });
      });
    },

    async openCAIMintModal() {
      const modalInstance = this.openModal(MintCAIModal);
      modalInstance.sourceAssets = config.CAI_MINT_SOURCE_ASSETS;
      modalInstance.targetAssets = ['CAI'];
      modalInstance.sourceAsset = 'AVAX';
      modalInstance.targetAsset = 'CAI';
      modalInstance.assetBalances = this.assetBalances;
      modalInstance.smartLoanContractAddress = this.smartLoanContract.address;
      modalInstance.assets = this.assets;
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.lpBalances = this.lpBalances;
      modalInstance.concentratedLpAssets = this.concentratedLpAssets;
      modalInstance.concentratedLpBalances = this.concentratedLpBalances;
      modalInstance.penpieLpAssets = this.penpieLpAssets;
      modalInstance.penpieLpBalances = this.penpieLpBalances;
      modalInstance.wombatLpAssets = this.wombatLpAssets;
      modalInstance.wombatLpBalances = this.wombatLpBalances;
      modalInstance.levelLpAssets = this.levelLpAssets;
      modalInstance.levelLpBalances = this.levelLpBalances;
      modalInstance.balancerLpAssets = this.balancerLpAssets;
      modalInstance.balancerLpBalances = this.balancerLpBalances;
      modalInstance.gmxV2Assets = this.gmxV2Assets;
      modalInstance.gmxV2Balances = this.gmxV2Balances;
      modalInstance.farms = this.farms;
      modalInstance.traderJoeV2LpAssets = this.traderJoeV2LpAssets;

      modalInstance.$on('MINT_CAI', mintCAIEvent => {
        console.log('mintCAIEvent', mintCAIEvent);
        const mintCAIRequest = {
          sourceAsset: mintCAIEvent.asset,
          amount: mintCAIEvent.amount,
          mintData: mintCAIEvent.mintData,
          calculatedTargetAmount: mintCAIEvent.calculatedTargetAmount
        };
        this.handleTransaction(this.mintCAI, {mintCAIRequest: mintCAIRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
          modalInstance.transactionOngoing = false;
        }).then(() => {
        });
      });
    },


    async openCAIBurnModal() {
      const modalInstance = this.openModal(MintCAIModal);
      modalInstance.mintMode = false;
      modalInstance.sourceAssets = ['CAI'];
      modalInstance.targetAssets = config.CAI_BURN_TARGET_ASSETS;
      modalInstance.targetAsset = 'AVAX';
      modalInstance.sourceAsset = 'CAI';
      modalInstance.assetBalances = this.assetBalances;
      modalInstance.smartLoanContractAddress = this.smartLoanContract.address;
      modalInstance.assets = this.assets;
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.lpBalances = this.lpBalances;
      modalInstance.concentratedLpAssets = this.concentratedLpAssets;
      modalInstance.concentratedLpBalances = this.concentratedLpBalances;
      modalInstance.penpieLpAssets = this.penpieLpAssets;
      modalInstance.penpieLpBalances = this.penpieLpBalances;
      modalInstance.wombatLpAssets = this.wombatLpAssets;
      modalInstance.wombatLpBalances = this.wombatLpBalances;
      modalInstance.levelLpAssets = this.levelLpAssets;
      modalInstance.levelLpBalances = this.levelLpBalances;
      modalInstance.balancerLpAssets = this.balancerLpAssets;
      modalInstance.balancerLpBalances = this.balancerLpBalances;
      modalInstance.gmxV2Assets = this.gmxV2Assets;
      modalInstance.gmxV2Balances = this.gmxV2Balances;
      modalInstance.farms = this.farms;
      modalInstance.traderJoeV2LpAssets = this.traderJoeV2LpAssets;

      modalInstance.$on('BURN_CAI', burnCAIEvent => {
        console.log('burnCAIEvent', burnCAIEvent);
        const burnCAIRequest = {
          targetAsset: burnCAIEvent.asset,
          amount: burnCAIEvent.amount,
          burnData: burnCAIEvent.burnData,
          calculatedTargetAmount: burnCAIEvent.calculatedTargetAmount,
          maxSlippage: burnCAIEvent.maxSlippage
        };
        this.handleTransaction(this.burnCAI, {burnCAIRequest: burnCAIRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
          modalInstance.transactionOngoing = false;
        }).then(() => {
        });
      });
    },

    async getWalletAssetBalance() {
      const tokenContract = new ethers.Contract(config.ASSETS_CONFIG[this.asset.symbol].address, erc20ABI, this.provider.getSigner());
      const walletTokenBalance = await this.getWalletTokenBalance(this.account, this.asset.symbol, tokenContract, config.ASSETS_CONFIG[this.asset.symbol].decimals);
      return walletTokenBalance;
    },

    async getSmartLoanContractNativeTokenBalance() {
      const balance = parseFloat(ethers.utils.formatEther(await this.provider.getBalance(this.smartLoanContract.address)));
      return balance;
    },

    watchExternalAssetBalanceUpdate() {
      this.assetBalancesExternalUpdateService.observeExternalAssetBalanceUpdate().subscribe((updateEvent) => {
        if (updateEvent.assetSymbol === this.asset.symbol) {
          this.assetBalances[this.asset.symbol] = updateEvent.balance;
          this.isBalanceEstimated = !updateEvent.isTrueData;
          this.$forceUpdate();
        }
      });
    },

    watchExternalAssetDebtUpdate() {
      this.assetDebtsExternalUpdateService.observeExternalAssetDebtUpdate().subscribe((updateEvent) => {
        if (updateEvent.assetSymbol === this.asset.symbol) {
          this.debtsPerAsset[this.asset.symbol].debt = updateEvent.debt;
          this.isDebtEstimated = !updateEvent.isTrueData;
          this.$forceUpdate();
        }
      });
    },

    watchAssetBalancesDataRefreshEvent() {
      this.dataRefreshEventService.assetBalancesDataRefreshEvent$.subscribe(() => {
        this.isBalanceEstimated = false;
        this.disableAllButtons = false;
        this.progressBarService.emitProgressBarSuccessState();
        this.$forceUpdate();
      });
    },

    watchDebtsPerAssetDataRefreshEvent() {
      this.dataRefreshEventService.debtsPerAssetDataRefreshEvent$.subscribe(() => {
        this.isDebtEstimated = false;
        this.disableAllButtons = false;
        this.progressBarService.emitProgressBarSuccessState();
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

    watchAssetApysRefreshScheduledEvent() {
      this.dataRefreshEventService.assetApysDataRefresh$.subscribe(() => {
        this.$forceUpdate();
      });
    },

    watchExternalTotalStakedUpdate() {
      this.stakedExternalUpdateService.observeExternalTotalStakedUpdate().subscribe((updateEvent) => {
        if (updateEvent.assetSymbol === this.asset.symbol) {
          if (updateEvent.action === 'STAKE') {
            this.totalStaked = Number(this.totalStaked) + Number(updateEvent.stakedChange);
          } else if (updateEvent.action === 'UNSTAKE') {
            this.totalStaked = Number(this.totalStaked) - Number(updateEvent.stakedChange);
          }
          this.$forceUpdate();
        }
      });
    },

    watchFarmRefreshEvent() {
      this.farmService.observeRefreshFarm().subscribe(async () => {
        if (this.availableFarms) {
          this.totalStaked = this.availableFarms.reduce((acc, farm) => acc + parseFloat(farm.totalStaked), 0);
        }
      });
    },

    watchLtipMaxBoostUpdate() {
      this.ltipService.observeLtipMaxBoostApy().subscribe((boostApy) => {
        this.boostApy = boostApy;
      });
    },

    watchActionDisabling() {
      this.globalActionsDisableService.getSectionActions$(ActionSection.ASSETS)
        .subscribe(isActionDisabledRecord => {
          this.isActionDisabledRecord = isActionDisabledRecord;
          this.setupActionsConfiguration();
        })
    },

    watchWithdrawalIntents() {
      this.paWithdrawQueueService.observeAssetIntents().subscribe(intents => {
        this.intents = intents[this.asset.symbol];
      })
    },

    setupAvailableFarms() {
      this.availableFarms = config.FARMED_TOKENS_CONFIG[this.asset.symbol];
    },

    scheduleHardRefresh() {
      this.progressBarService.emitProgressBarInProgressState();
      this.dataRefreshEventService.emitHardRefreshScheduledEvent();
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
            this.isBalanceEstimated = false;
            this.isDebtEstimated = false;
            break;
          }
          case 'CANCELLED' : {
            this.disableAllButtons = false;
            this.isBalanceEstimated = false;
            this.isDebtEstimated = false;
            break;
          }
        }
      });
    },

    handleTransactionError(error) {
      console.error('____handleTransactionError______________');
      console.log(typeof error);
      console.log(error);
      console.warn(error.code);
      console.warn(error.message);
      console.log(String(error));

      let caiMintOrBurnSlippageError;
      let outOfGasMetamaskError;

      if (typeof error === 'string') {
        if (error && error.includes('CAI')) {
          outOfGasMetamaskError = true;
          this.progressBarService.emitProgressBarErrorState('due to MetaMask error. Please try adjusting gas limit or use swap instead.')
          this.cleanupAfterError(false);
          return;
        }
      } else {
        caiMintOrBurnSlippageError = error.message.includes('Too little received') || (error.data && error.data.message.includes('Too little received'));
      }

      console.warn(caiMintOrBurnSlippageError);

      if (!error) {
        return;
      }

      let userCancelledTransaction = false;
      if (String(error) === '[object Object]' || typeof error === 'object') {
        switch (error.code) {
          case -32000:
            this.progressBarService.emitProgressBarErrorState('The selected aggregator could not find a route. Please switch aggregator, increase slippage or try again later.')
            break;
          case 'UNPREDICTABLE_GAS_LIMIT':
            if (caiMintOrBurnSlippageError) {
              this.progressBarService.emitProgressBarErrorState('Insufficient slippage. Please try again later with higher slippage.')
            } else {
              this.progressBarService.emitProgressBarErrorState('Could not estimate gas for transaction. Please switch aggregator, or try again later.')
            }
            break;
          case 4001:
            this.progressBarService.emitProgressBarCancelledState()
            userCancelledTransaction = true;
            break;
          case -32603:
            console.log('error code -32603');
            if (caiMintOrBurnSlippageError) {
              this.progressBarService.emitProgressBarErrorState('Insufficient slippage. Please try again later with higher slippage.')
            } else {
              caiMintOrBurnSlippageError = true;
              this.progressBarService.emitProgressBarErrorState('due to MetaMask error. Please try adjusting gas limit or use swap instead.')
            }
            break;
          case 404:
            this.progressBarService.emitProgressBarErrorState('Action is currently disabled')
            break;
        }
      } else {
        const parsedError = String(error);
        if (parsedError.includes('execution reverted: YakRouter: Insufficient output amount')) {
          this.progressBarService.emitProgressBarErrorState('Insufficient slippage.');
        }
      }
      this.cleanupAfterError(userCancelledTransaction);
    },

    cleanupAfterError(closeModal = true) {
      if (closeModal) {
        this.closeModal();
      }
      if (this.currentlyOpenModalInstance) {
        this.currentlyOpenModalInstance.calculatingSwapRoute = false;
        this.currentlyOpenModalInstance.transactionOngoing = false;
        this.currentlyOpenModalInstance.blockSubmitButton = true;
      }
      this.disableAllButtons = false;
      this.isBalanceEstimated = false;
      this.isBalanceEstimated = false;
    },

    setupPoolsApy() {
      this.poolService.observePools().subscribe(pools => {
        pools.forEach(pool => {
          if (!pool.disabled) {
            this.borrowApyPerPool[pool.asset.symbol] = pool.borrowingAPY;
          }
        });
      });
    },
  },
  watch: {
    asset: function (asset) {
      if (!asset.tradingViewSymbol) {
        this.selectedChart = 'Chart'
      }
    },
    smartLoanContract: {
      handler(smartLoanContract) {
        if (smartLoanContract) {
          this.setupActionsConfiguration();
        }
      },
    },

    pools: {
      handler(pools) {
        this.setupActionsConfiguration();
      },
      immediate: true
    },
  },
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.fund-table-row-component {
  height: 60px;
  transition: all 200ms;

  &.expanded {
    height: 477px;

    &.expanded--trading-view {
      height: 715px;
    }
  }

  .table__row {
    display: grid;
    grid-template-columns: repeat(6, 1fr) 90px 76px 102px;
    height: 60px;
    border-style: solid;
    border-width: 0 0 2px 0;
    border-image-source: var(--asset-table-row__border);
    border-image-slice: 1;
    padding-left: 6px;

    &.inactive {
      .table__cell {
        color: var(--asset-table-row__double-value-color);
      }
    }

    .table__cell {
      display: flex;
      flex-direction: row;

      &.asset {
        align-items: center;

        .asset__icon {
          width: 20px;
          height: 20px;
          opacity: var(--asset-table-row__icon-opacity);
        }

        .asset__info {
          display: flex;
          flex-direction: column;
          justify-content: center;
          margin-left: 8px;
          font-weight: 500;
        }

        .asset__loan {
          font-size: $font-size-xxs;
          color: var(--asset-table-row__asset-loan-color);

          .stars-icon {
            width: 20px;
            margin-right: 10px;
            transform: translateY(-2px);
          }
        }
      }

      &.balance {
        align-items: flex-end;
      }

      &.farmed {
        align-items: flex-end;
      }

      &.loan {
        align-items: flex-end;
      }

      &.impact {
        font-weight: 500;
        align-items: center;
        justify-content: center;
      }

      &.trend {
        justify-content: center;
        align-items: center;
        margin-left: 9px;

        .trend__chart-change {
          display: flex;
          flex-direction: column;
          font-size: $font-size-xxs;
          align-items: center;
          cursor: pointer;
        }

        .chart__icon-button {
          margin-left: 7px;
        }
      }

      &.price {
        justify-content: flex-end;
        align-items: center;
        font-weight: 500;
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

    .colored-value {
      font-weight: 500;
    }

    .chart-container__toggle {
      margin-bottom: 16px;
    }

    .trading-view-chart {
      transition: 200ms opacity ease-in-out;
      opacity: 0;

      &.trading-view-chart--visible {
        opacity: 1;
      }
    }
  }
}

.action-button {
  &:not(:last-child) {
    margin-right: 12px;
  }
}

.point-star-icon {
  z-index: 1;
}

</style>
