<template>
  <div class="concentrated-lp-table-row-component" :class="{'expanded': rowExpanded}">
    <div class="table__row" v-if="lpToken" :class="{'inactive': lpToken.inactive}">
      <div class="table__cell asset">
        <DoubleAssetIcon :primary="lpToken.primary" :secondary="lpToken.secondary"></DoubleAssetIcon>
        <img style="margin-left: 5px"
             v-if="lpToken.droppingSupport && concentratedLpTokenBalances[lpToken.symbol] > 0"
             src="src/assets/icons/warning.svg"
             v-tooltip="{content: `We will drop support to this asset on ${ lpToken.debtCoverage > 0.1 ? '26.04.2024 12:00 CET' : 'Monday 22.04.2024 16:00 CET'}. Please withdraw or swap to another token.`, classes: 'info-tooltip long'}">
        <div class="asset__info">
          <div class="asset__name">{{ lpToken.primary }} - {{ lpToken.secondary }}</div>
          <div class="asset__dex">
            by {{ lpToken.dex }}
          </div>
        </div>
      </div>

      <div class="table__cell table__cell--double-value balance">
        <template v-if="concentratedLpTokenBalances && parseFloat(concentratedLpTokenBalances[lpToken.symbol])">
          <div class="double-value__pieces">
            <span v-if="isLpBalanceEstimated">~</span>
            {{ formatTokenBalance(concentratedLpTokenBalances[lpToken.symbol], 10, true) }}
          </div>
          <div class="double-value__usd">
            <span v-if="concentratedLpTokenBalances[lpToken.symbol]">
              {{ concentratedLpTokenBalances[lpToken.symbol] * lpToken.price | usd }}
            </span>
          </div>
        </template>
        <template v-else>
          <div class="no-value-dash"></div>
        </template>
      </div>

      <div class="table__cell composition">
        <img class="asset__icon" :src="getAssetIcon(lpToken.primary)">{{ formatTokenBalance(lpToken.primaryBalance, 8, true) }}
        <img class="asset__icon" :src="getAssetIcon(lpToken.secondary)">{{ formatTokenBalance(lpToken.secondaryBalance, 8, true) }}
      </div>

      <div class="table__cell table__cell--double-value loan">
        {{ formatTvl(lpToken.tvl) }}
      </div>

      <div class="table__cell table__cell--double-value apr">
        {{ apr / 100 | percent }}
      </div>

      <div class="table__cell table__cell--double-value max-apr">
        {{ maxApr | percent }}
      </div>

      <div class="table__cell"></div>

      <div class="table__cell actions">
        <DeltaIcon class="action-button"
                   v-bind:class="{'action-button--disabled': isActionDisabledRecord['ADD_FROM_WALLET'] || disableAllButtons || !lpTokenBalances || lpToken.inactive || noSmartLoan}"
                   :icon-src="'src/assets/icons/plus.svg'" :size="26"
                   v-tooltip="{content: 'Add LP from wallet', classes: 'button-tooltip'}"
                   v-on:click.native="actionClick('ADD_FROM_WALLET')"></DeltaIcon>
        <IconButtonMenuBeta
            v-if="moreActionsConfig"
            class="actions__icon-button"
            :config="moreActionsConfig"
            v-on:iconButtonClick="actionClick"
            :disabled="noSmartLoan || disableAllButtons">
        </IconButtonMenuBeta>
      </div>
    </div>
    <div class="chart-container" v-if="showChart">
      <SmallBlock v-on:close="toggleChart()">
        <Chart :data-points="lpToken.priceGraphData"
               :line-width="3"
               :min-y="lpToken.minPrice"
               :max-y="lpToken.maxPrice"
               :positive-change="lpToken.todayPriceChange > 0">
        </Chart>
      </SmallBlock>
    </div>
  </div>
</template>

<script>
import DoubleAssetIcon from '../DoubleAssetIcon.vue';
import LoadedValue from '../LoadedValue.vue';
import SmallBlock from '../SmallBlock.vue';
import Chart from '../Chart.vue';
import IconButtonMenuBeta from '../IconButtonMenuBeta.vue';
import ColoredValueBeta from '../ColoredValueBeta.vue';
import SmallChartBeta from '../SmallChartBeta.vue';
import AddFromWalletModal from '../AddFromWalletModal.vue';
import config from '../../config';
import {mapActions, mapState} from 'vuex';
import ProvideConcentratedLiquidityModal from "../ProvideConcentratedLiquidityModal.vue";
import RemoveConcentratedLiquidityModal from '../RemoveConcentratedLiquidityModal.vue';
import WithdrawModal from '../WithdrawModal.vue';

const ethers = require('ethers');
import erc20ABI from '../../../test/abis/ERC20.json';
import {calculateMaxApy, fromWei} from '../../utils/calculate';
import addresses from '../../../common/addresses/avalanche/token_addresses.json';
import {formatUnits, parseUnits} from 'ethers/lib/utils';
import ApolloClient from "apollo-boost";
import gql from "graphql-tag";
import DeltaIcon from '../DeltaIcon.vue';
import {ActionSection} from "../../services/globalActionsDisableService";

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

export default {
  name: 'ConcentratedLpTableRow',
  components: {
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
    this.setupActionsConfiguration();
    this.watchAssetBalancesDataRefreshEvent();
    this.watchHardRefreshScheduledEvent();
    this.watchHealth();
    this.watchProgressBarState();
    this.watchAssetApysRefresh();
    this.watchExternalAssetBalanceUpdate();
    this.setupApr();
    this.setupPoolData();
    this.setupTvl();
    this.watchActionDisabling();
  },

  data() {
    return {
      moreActionsConfig: null,
      showChart: false,
      rowExpanded: false,
      poolBalance: 0,
      apr: 0,
      tvl: 0,
      lpTokenBalances: [],
      concentratedLpTokenBalances: [],
      isLpBalanceEstimated: false,
      disableAllButtons: false,
      healthLoaded: false,
      totalFirstAmount: 0,
      totalSecondAmount: 0,
      firstPrice: 0,
      secondPrice: 0,
      isActionDisabledRecord: {},
    };
  },

  computed: {
    ...mapState('fundsStore', [
      'health',
      'smartLoanContract',
      'fullLoanStatus',
      'assetBalances',
      'assets',
      'debtsPerAsset',
      'lpAssets',
      'concentratedLpAssets',
      'traderJoeV2LpAssets',
      'lpBalances',
      'concentratedLpBalances',
      'levelLpAssets',
      'levelLpBalances',
      'balancerLpAssets',
      'balancerLpBalances',
      'gmxV2Assets',
      'gmxV2Balances',
      'penpieLpBalances',
      'penpieLpAssets',
      'wombatLpAssets',
      'wombatLpBalances',
      'wombatYYFarmsBalances',
      'noSmartLoan'
    ]),
    ...mapState('stakeStore', ['farms']),
    ...mapState('poolStore', ['pools']),
    ...mapState('network', ['provider', 'account']),
    ...mapState('serviceRegistry', [
      'assetBalancesExternalUpdateService',
      'dataRefreshEventService',
      'progressBarService',
      'lpService',
      'healthService',
      'stakedExternalUpdateService',
      'farmService',
      'globalActionsDisableService',
    ]),

    hasSmartLoanContract() {
      return this.smartLoanContract && this.smartLoanContract.address !== NULL_ADDRESS;
    },

    maxApr() {
      return calculateMaxApy(this.pools, this.apr / 100);
    }
  },

  watch: {
    smartLoanContract: {
      handler(smartLoanContract) {
        if (smartLoanContract) {
          this.setupActionsConfiguration();
        }
      },
    },
    provider: {
      async handler(provider) {
        if (provider) {
          await this.setupPoolBalance();
        }
      }
    },
    concentratedLpBalances: {
      handler(concentratedLpBalances) {
        if (concentratedLpBalances) {
          this.concentratedLpTokenBalances = concentratedLpBalances;
        }
      },
      immediate: true
    },
    lpBalances: {
      handler(lpBalances) {
        if (lpBalances) {
          this.lpTokenBalances = lpBalances;
        }
      },
      immediate: true
    },
  },

  methods: {
    ...mapActions('fundsStore', ['fund', 'withdraw', 'provideLiquidityConcentratedPool', 'removeLiquidityConcentratedPool']),
    setupActionsConfiguration() {
      this.moreActionsConfig =
        {
          iconSrc: 'src/assets/icons/icon_a_more.svg',
          tooltip: 'More',
          menuOptions: [
            {
              key: 'PROVIDE_LIQUIDITY',
              name: 'Create Concentrated LP token',
              disabled: this.isActionDisabledRecord['PROVIDE_LIQUIDITY'] || this.noSmartLoan || !this.lpTokenBalances || this.lpToken.inactive,
              disabledInfo: this.isActionDisabledRecord['PROVIDE_LIQUIDITY'] ? '' : 'To create LP token, you need to add some funds from you wallet first'
            },
            {
              key: 'REMOVE_LIQUIDITY',
              name: 'Unwind Concentrated LP token',
              disabled: this.isActionDisabledRecord['REMOVE_LIQUIDITY'] || this.noSmartLoan || !this.lpTokenBalances || this.lpToken.inactive,
            },
            {
              key: 'WITHDRAW',
              name: 'Withdraw LP to wallet',
              disabled: this.isActionDisabledRecord['WITHDRAW'] || this.noSmartLoan || !this.lpTokenBalances
            }
          ]
        }
    },

    async setupApr() {
      if (!this.lpToken.apy) return;
      this.apr = this.lpToken.apy;
    },

    async setupTvl() {
      if (!this.lpToken.tvl) return;
      this.tvl = this.lpToken.tvl;
    },

    async setupPoolData() {
      let query = `{
          vaults(where: {id: "${this.lpToken.address}"}) {
          id
          shares
          underlyingX
          underlyingY
          tokenX {
            id
            decimals
            priceUSD
            symbol
          }
          tokenY {
            id
            decimals
            priceUSD
            symbol
          }
          }
        }`;

      const client = new ApolloClient({
        uri: "https://api.thegraph.com/subgraphs/name/0xsirloin/steakhutlb"
      });

      client.query({query: gql(query)}).then(
        resp => {
          const vault = resp.data.vaults[0];
          this.totalFirstAmount = vault.underlyingX / 10 ** vault.tokenX.decimals;
          this.totalSecondAmount = vault.underlyingY / 10 ** vault.tokenY.decimals;
          this.firstPrice = vault.tokenX.priceUSD;
          this.secondPrice = vault.tokenY.priceUSD;
        }
      )


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
        }
      }
    },

    //TODO: duplicated code
    async openAddFromWalletModal() {
      const modalInstance = this.openModal(AddFromWalletModal);
      modalInstance.asset = this.lpToken;
      modalInstance.assetBalance = this.concentratedLpTokenBalances && this.concentratedLpTokenBalances[this.lpToken.symbol] ? this.concentratedLpTokenBalances[this.lpToken.symbol] : 0;
      modalInstance.assets = this.assets;
      modalInstance.assetBalances = this.assetBalances;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.concentratedLpAssets = this.concentratedLpAssets;
      modalInstance.concentratedLpTokenBalances = this.concentratedLpTokenBalances;
      modalInstance.levelLpAssets = this.levelLpAssets;
      modalInstance.levelLpBalances = this.levelLpBalances;
      modalInstance.penpieLpAssets = this.penpieLpAssets;
      modalInstance.penpieLpBalances = this.penpieLpBalances;
      modalInstance.wombatLpAssets = this.wombatLpAssets;
      modalInstance.wombatLpBalances = this.wombatLpBalances;
      modalInstance.traderJoeV2LpAssets = this.traderJoeV2LpAssets;
      modalInstance.gmxV2Assets = this.gmxV2Assets;
      modalInstance.gmxV2Balances = this.gmxV2Balances;
      modalInstance.farms = this.farms;
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.loan = this.debt;
      modalInstance.thresholdWeightedValue = this.thresholdWeightedValue;
      modalInstance.isLP = true;
      modalInstance.walletAssetBalance = await this.getWalletLpTokenBalance();
      modalInstance.$on('ADD_FROM_WALLET', addFromWalletEvent => {
        if (this.smartLoanContract) {
          const fundRequest = {
            value: addFromWalletEvent.value.toString(),
            asset: this.lpToken.symbol,
            assetDecimals: config.CONCENTRATED_LP_ASSETS_CONFIG[this.lpToken.symbol].decimals,
            type: 'CONCENTRATED_LP',
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
      modalInstance.assetBalance = this.concentratedLpTokenBalances[this.lpToken.symbol];
      modalInstance.assets = this.assets;
      modalInstance.assetBalances = this.assetBalances;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.concentratedLpAssets = this.concentratedLpAssets;
      modalInstance.traderJoeV2LpAssets = this.traderJoeV2LpAssets;
      modalInstance.lpBalances = this.lpBalances;
      modalInstance.concentratedLpBalances = this.concentratedLpTokenBalances;
      modalInstance.levelLpAssets = this.levelLpAssets;
      modalInstance.levelLpBalances = this.levelLpBalances;
      modalInstance.balancerLpBalances = this.balancerLpBalances;
      modalInstance.balancerLpAssets = this.balancerLpAssets;
      modalInstance.gmxV2Assets = this.gmxV2Assets;
      modalInstance.gmxV2Balances = this.gmxV2Balances;
      modalInstance.penpieLpAssets = this.penpieLpAssets;
      modalInstance.penpieLpBalances = this.penpieLpBalances;
      modalInstance.wombatLpAssets = this.wombatLpAssets;
      modalInstance.wombatLpBalances = this.wombatLpBalances;
      modalInstance.wombatYYFarmsBalances = this.wombatYYFarmsBalances;
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.farms = this.farms;
      modalInstance.health = this.health;
      modalInstance.isLP = true;
      modalInstance.$on('WITHDRAW', withdrawEvent => {
        const withdrawRequest = {
          value: withdrawEvent.value.toString(),
          asset: this.lpToken.symbol,
          assetDecimals: config.CONCENTRATED_LP_ASSETS_CONFIG[this.lpToken.symbol].decimals,
          assetInactive: this.lpToken.inactive,
          assetAddress: this.lpToken.address,
          type: 'CONCENTRATED_LP',
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
      const modalInstance = this.openModal(ProvideConcentratedLiquidityModal);
      modalInstance.lpToken = this.lpToken;
      modalInstance.lpTokenBalance = Number(this.concentratedLpTokenBalances[this.lpToken.symbol]);
      modalInstance.firstAssetBalance = this.assetBalances[this.lpToken.primary];
      modalInstance.secondAssetBalance = this.assetBalances[this.lpToken.secondary];
      modalInstance.totalFirstAmount = this.totalFirstAmount;
      modalInstance.totalSecondAmount = this.totalSecondAmount;
      modalInstance.$on('PROVIDE_LIQUIDITY', provideLiquidityEvent => {
        if (this.smartLoanContract) {
          const provideLiquidityRequest = {
            symbol: this.lpToken.symbol,
            method: this.lpToken.addMethod,
            firstAsset: this.lpToken.primary,
            secondAsset: this.lpToken.secondary,
            firstAmount: provideLiquidityEvent.firstAmount.toString(),
            secondAmount: provideLiquidityEvent.secondAmount.toString(),
            addedLiquidity: provideLiquidityEvent.addedLiquidity,
          };
          this.handleTransaction(this.provideLiquidityConcentratedPool, {provideLiquidityRequest: provideLiquidityRequest}, () => {
            this.$forceUpdate();
          }, (error) => {
            this.handleTransactionError(error);
          }).then(() => {
          });
        }
      });
    },

    //TODO: duplicated code
    openRemoveLiquidityModal() {
      const modalInstance = this.openModal(RemoveConcentratedLiquidityModal);
      modalInstance.lpToken = this.lpToken;
      modalInstance.lpTokenBalance = Number(this.concentratedLpTokenBalances[this.lpToken.symbol]);
      modalInstance.firstBalance = Number(this.assetBalances[this.lpToken.primary]);
      modalInstance.secondBalance = Number(this.assetBalances[this.lpToken.secondary]);
      modalInstance.tokenAvailableDecimals = this.lpToken.symbol === 'SHLB_USDT.e-USDt_C' ? 18 : 10;
      modalInstance.$on('REMOVE_LIQUIDITY', removeEvent => {
        const removeLiquidityRequest = {
          value: removeEvent.amount,
          symbol: this.lpToken.symbol,
          method: this.lpToken.removeMethod,
          firstAsset: this.lpToken.primary,
          secondAsset: this.lpToken.secondary,
          minFirstAmount: removeEvent.minReceivedFirst.toString(),
          minSecondAmount: removeEvent.minReceivedSecond.toString(),
          assetDecimals: config.CONCENTRATED_LP_ASSETS_CONFIG[this.lpToken.symbol].decimals,
          dex: this.lpToken.dex
        };
        this.handleTransaction(this.removeLiquidityConcentratedPool, {removeLiquidityRequest: removeLiquidityRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
        });
      });
    },

    async setupPoolBalance() {
      const lpTokenContract = new ethers.Contract(this.lpToken.address, erc20ABI, provider);
      this.poolBalance = fromWei(await lpTokenContract.totalSupply());
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
          this.concentratedLpTokenBalances[this.lpToken.symbol] = updateEvent.balance;
          this.isBalanceEstimated = !updateEvent.isTrueData;
          this.$forceUpdate();
        }
      })
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
            this.isBalanceEstimated = false;
            break;
          }
          case 'CANCELLED' : {
            this.disableAllButtons = false;
            this.isBalanceEstimated = false;
            break;
          }
        }
      })
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
      this.isBalanceEstimated = false;
    },

    watchActionDisabling() {
      this.globalActionsDisableService.getSectionActions$(ActionSection.CONCENTRATED_LP)
          .subscribe(isActionDisabledRecord => {
            this.isActionDisabledRecord = isActionDisabledRecord;
            this.setupActionsConfiguration();
          })
    },
  },
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.concentrated-lp-table-row-component {
  height: 60px;
  transition: all 200ms;

  &.expanded {
    height: 387px;
  }

  .table__row {
    display: grid;
    grid-template-columns: 160px 150px 260px 150px repeat(2, 1fr) 70px 60px 22px;
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

        .asset__dex {
          font-size: $font-size-xxs;
          color: var(--asset-table-row__asset-loan-color);
        }
      }

      &.balance {
        align-items: flex-end;
      }

      &.composition {
        display: flex;
        align-items: center;
        justify-content: flex-end;

        img {
          margin-left: 5px;
        }
      }

      &.farmed {
        align-items: flex-end;
      }

      &.loan, &.apr, &.max-apr {
        align-items: flex-end;
      }

      &.max-apr {
        font-weight: 600;
      }

      &.trend {
        justify-content: center;
        align-items: center;
        margin-left: 49px;

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

    .small-block-wrapper {
      height: unset;
    }
  }

  .asset__icon {
    height: 22px;
    width: 22px;
    border-radius: 50%;
    margin-right: 9px;
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
