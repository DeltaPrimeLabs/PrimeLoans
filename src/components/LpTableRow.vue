<template>
  <div class="lp-table-row-component" :class="{'expanded': rowExpanded}">
    <div class="table__row" v-if="lpToken">
      <div class="table__cell asset">
        <DoubleAssetIcon :primary="lpToken.primary" :secondary="lpToken.secondary"></DoubleAssetIcon>
        <div class="asset__info">
          <div class="asset__name">{{ lpToken.primary }} - {{ lpToken.secondary }}</div>
          <div class="asset__dex">
            by {{ lpToken.dex }}
          </div>
        </div>
      </div>

      <div class="table__cell table__cell--double-value balance">
        <template v-if="lpBalances && parseFloat(lpBalances[lpToken.symbol])">
          <div class="double-value__pieces">
            <span v-if="isLpBalanceEstimated">~</span>
            {{ formatTokenBalance(lpBalances[lpToken.symbol], 10, true) }}
          </div>
          <div class="double-value__usd">
            <span v-if="lpBalances[lpToken.symbol]">
              {{ lpBalances[lpToken.symbol] * lpToken.price | usd }}
            </span>
          </div>
        </template>
        <template v-else>
          <div class="no-value-dash"></div>
        </template>
      </div>

      <div class="table__cell table__cell--double-value loan">
        {{ lpToken.tvl | usd }}
      </div>

      <div class="table__cell table__cell--double-value apr">
        {{ apr | percent }}
      </div>

      <div class="table__cell table__cell--double-value max-apr">
        {{ maxApr | percent }}
      </div>

      <div class="table__cell"></div>

      <div class="table__cell actions">
        <IconButtonMenuBeta
          class="actions__icon-button"
          v-for="(actionConfig, index) of actionsConfig"
          v-bind:key="index"
          :config="actionConfig"
          v-on:iconButtonClick="actionClick"
          :disabled="disableAllButtons">
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
import {assetAppreciation} from '../utils/blockchain';
import erc20ABI from '../../test/abis/ERC20.json';
import {calculateMaxApy, fromWei} from '../utils/calculate';
import addresses from '../../common/addresses/avax/token_addresses.json';
import {formatUnits, parseUnits} from 'ethers/lib/utils';

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

export default {
  name: 'LpTableRow',
  components: {
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
    this.watchProgressBarState();
    this.watchLpRefresh();
    this.watchExternalAssetBalanceUpdate();
    await this.setupApr();
  },

  data() {
    return {
      actionsConfig: null,
      showChart: false,
      rowExpanded: false,
      poolBalance: 0,
      apr: 0,
      tvl: 0,
      lpTokenBalances: [],
      isLpBalanceEstimated: false,
      disableAllButtons: false,
    };
  },

  computed: {
    ...mapState('fundsStore', ['health', 'lpBalances', 'smartLoanContract', 'fullLoanStatus', 'assetBalances', 'assets', 'debtsPerAsset', 'lpAssets', 'lpBalances']),
    ...mapState('stakeStore', ['farms']),
    ...mapState('poolStore', ['pools']),
    ...mapState('network', ['provider', 'account']),
    ...mapState('serviceRegistry', ['assetBalancesExternalUpdateService', 'dataRefreshEventService', 'progressBarService', 'lpService']),

    hasSmartLoanContract() {
      return this.smartLoanContract && this.smartLoanContract.address !== NULL_ADDRESS;
    },

    maxApr() {
      return calculateMaxApy(this.pools, this.apr);
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
    assets: {
      handler(assets) {
        if (assets) {
          this.setupTvl();
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
    ...mapActions('fundsStore', ['fund', 'withdraw', 'provideLiquidity', 'removeLiquidity']),
    setupActionsConfiguration() {
      this.actionsConfig = [
        {
          iconSrc: 'src/assets/icons/plus.svg',
          hoverIconSrc: 'src/assets/icons/plus_hover.svg',
          tooltip: 'Deposit / Create',
          disabled: !this.lpTokenBalances,
          menuOptions: [
            {
              key: 'ADD_FROM_WALLET',
              name: 'Deposit collateral'
            },
            {
              key: 'PROVIDE_LIQUIDITY',
              name: 'Create LP token',
              disabled: !this.hasSmartLoanContract,
              disabledInfo: 'To create LP token, you need to add some funds from you wallet first'
            },
          ]
        },
        {
          iconSrc: 'src/assets/icons/minus.svg',
          hoverIconSrc: 'src/assets/icons/minus_hover.svg',
          tooltip: 'Withdraw / Unwind',
          disabled: !this.hasSmartLoanContract || !this.lpTokenBalances,
          menuOptions: [
            {
              key: 'WITHDRAW',
              name: 'Withdraw collateral'
            },
            {
              key: 'REMOVE_LIQUIDITY',
              name: 'Unwind LP token'
            }
          ]
        },
      ];
    },

    async setupApr() {
      if (!this.lpToken.currentApr) return;
      this.apr = (assetAppreciation(this.lpToken.symbol) * (1 + this.lpToken.currentApr) - 1);
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
      console.log(key);
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
    },

    //TODO: duplicated code
    async openAddFromWalletModal() {
      const modalInstance = this.openModal(AddFromWalletModal);
      modalInstance.asset = this.lpToken;
      modalInstance.assetBalance = this.lpBalances && this.lpBalances[this.lpToken.symbol] ? this.lpBalances[this.lpToken.symbol] : 0;
      modalInstance.assets = this.assets;
      modalInstance.assetBalances = this.assetBalances;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.lpBalances = this.lpBalances;
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
            assetDecimals: config.LP_ASSETS_CONFIG[this.lpToken.symbol].decimals,
            isLP: true,
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
      modalInstance.assetBalance = this.lpBalances[this.lpToken.symbol];
      modalInstance.assets = this.assets;
      modalInstance.assetBalances = this.assetBalances;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.lpBalances = this.lpBalances;
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.farms = this.farms;
      modalInstance.health = this.health;
      modalInstance.isLP = true;
      modalInstance.$on('WITHDRAW', withdrawEvent => {
        const withdrawRequest = {
          value: withdrawEvent.value.toString(),
          asset: this.lpToken.symbol,
          assetDecimals: config.LP_ASSETS_CONFIG[this.lpToken.symbol].decimals,
          isLP: true,
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
      const modalInstance = this.openModal(ProvideLiquidityModal);
      modalInstance.lpToken = this.lpToken;
      modalInstance.lpTokenBalance = Number(this.lpBalances[this.lpToken.symbol]);
      modalInstance.firstAssetBalance = this.assetBalances[this.lpToken.primary];
      modalInstance.secondAssetBalance = this.assetBalances[this.lpToken.secondary];
      modalInstance.$on('PROVIDE_LIQUIDITY', provideLiquidityEvent => {
        if (this.smartLoanContract) {
          const provideLiquidityRequest = {
            symbol: this.lpToken.symbol,
            firstAsset: this.lpToken.primary,
            secondAsset: this.lpToken.secondary,
            firstAmount: provideLiquidityEvent.firstAmount.toString(),
            secondAmount: provideLiquidityEvent.secondAmount.toString(),
            dex: this.lpToken.dex,
            addedLiquidity: provideLiquidityEvent.addedLiquidity,
          };
          this.handleTransaction(this.provideLiquidity, {provideLiquidityRequest: provideLiquidityRequest}, () => {
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
      const modalInstance = this.openModal(RemoveLiquidityModal);
      modalInstance.lpToken = this.lpToken;
      modalInstance.lpTokenBalance = Number(this.lpBalances[this.lpToken.symbol]);
      modalInstance.firstBalance = Number(this.assetBalances[this.lpToken.primary]);
      modalInstance.secondBalance = Number(this.assetBalances[this.lpToken.secondary]);
      modalInstance.$on('REMOVE_LIQUIDITY', removeEvent => {
        const removeLiquidityRequest = {
          value: removeEvent.amount,
          symbol: this.lpToken.symbol,
          firstAsset: this.lpToken.primary,
          secondAsset: this.lpToken.secondary,
          minFirstAmount: removeEvent.minReceivedFirst.toString(),
          minSecondAmount: removeEvent.minReceivedSecond.toString(),
          assetDecimals: config.LP_ASSETS_CONFIG[this.lpToken.symbol].decimals,
          dex: this.lpToken.dex
        };
        this.handleTransaction(this.removeLiquidity, {removeLiquidityRequest: removeLiquidityRequest}, () => {
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

    async setupTvl() {
      const firstTokenContract = new ethers.Contract(addresses[this.lpToken.primary], erc20ABI, this.provider);
      const secondTokenContract = new ethers.Contract(addresses[this.lpToken.secondary], erc20ABI, this.provider);

      let priceFirst = this.assets[this.lpToken.primary].price;
      let priceSecond = this.assets[this.lpToken.secondary].price;

      if (priceFirst && priceSecond) {
        let valueOfFirst = formatUnits(await firstTokenContract.balanceOf(this.lpToken.address), config.ASSETS_CONFIG[this.lpToken.primary].decimals) * config.ASSETS_CONFIG[this.lpToken.primary].price;
        let valueOfSecond = formatUnits(await secondTokenContract.balanceOf(this.lpToken.address), config.ASSETS_CONFIG[this.lpToken.primary].secondary) * config.ASSETS_CONFIG[this.lpToken.secondary].price;

        this.tvl = valueOfFirst + valueOfSecond;
        this.lpToken.tvl = valueOfFirst + valueOfSecond;
      }
    },

    async getWalletLpTokenBalance() {
      const tokenContract = new ethers.Contract(this.lpToken.address, erc20ABI, this.provider.getSigner());
      return await this.getWalletTokenBalance(this.account, this.lpToken.symbol, tokenContract, true);
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

    watchLpRefresh() {
      this.lpService.observeRefreshLp().subscribe(async () => {
        await this.setupApr();
      })
    },

    watchExternalAssetBalanceUpdate() {
      this.assetBalancesExternalUpdateService.observeExternalAssetBalanceUpdate().subscribe(updateEvent => {
        if (updateEvent.assetSymbol === this.lpToken.symbol) {
          this.lpBalances[this.lpToken.symbol] = updateEvent.balance;
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
      if (error.code === 4001 || error.code === -32603) {
        this.progressBarService.emitProgressBarCancelledState();
      } else {
        this.progressBarService.emitProgressBarErrorState();
      }
      this.closeModal();
      this.disableAllButtons = false;
      this.isBalanceEstimated = false;
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
    height: 387px;
  }

  .table__row {
    display: grid;
    grid-template-columns: 20% repeat(2, 1fr) 15% 135px 60px 80px 22px;
    height: 60px;
    border-style: solid;
    border-width: 0 0 2px 0;
    border-image-source: linear-gradient(to right, #dfe0ff 43%, #ffe1c2 62%, #ffd3e0 79%);
    border-image-slice: 1;
    padding-left: 6px;

    .table__cell {
      display: flex;
      flex-direction: row;

      &.asset {
        align-items: center;

        .asset__icon {
          width: 20px;
          height: 20px;
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
          color: $medium-gray;
        }
      }

      &.balance {
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
          color: $medium-gray;
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
        background-color: $medium-gray;
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

</style>