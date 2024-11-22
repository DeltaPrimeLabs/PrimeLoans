<template>
  <div class="fund-table-row-component" :class="{'expanded': rowExpanded}">
    <div class="table__row" v-if="asset">
      <div class="table__cell asset">
        <img class="asset__icon" :src="getAssetIcon(asset.symbol)">
        <div class="asset__info">
          <div class="asset__name">{{ asset.symbol }}</div>
          <div class="asset__loan" v-if="borrowApyPerPool && borrowApyPerPool[asset.symbol]">
            Borrow&nbsp;APY:&nbsp;{{ borrowApyPerPool[asset.symbol] | percent }}
          </div>
          <div class="asset__loan" v-if="asset.symbol === 'sAVAX'">
            Profit APY:&nbsp;{{ 0.072 | percent }}
          </div>
        </div>
      </div>

      <div class="table__cell table__cell--double-value balance">
        <template v-if="assetBalances !== null && assetBalances !== undefined && parseFloat(assetBalances[asset.symbol])">
          <div class="double-value__pieces">
            <span v-if="isBalanceEstimated">~</span>{{ assetBalances[asset.symbol] | smartRound }}
          </div>
          <div class="double-value__usd">
            <span v-if="assetBalances[asset.symbol]">{{ assetBalances[asset.symbol] * asset.price | usd }}</span>
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
        <span v-if="asset.debtCoverage > 0">5x</span>
        <span v-else>0x</span>
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
        <IconButtonMenuBeta
          class="actions__icon-button"
          v-for="(actionConfig, index) of actionsConfig"
          :bubbleText="(asset.symbol === 'AVAX' && noSmartLoan && index === 0) ?
           `To create your Prime Account, click on the <img src='src/assets/icons/plus-white.svg' style='transform: translateY(-1px)' /> button, and then click &quot;Deposit collateral&quot;` : ''"
          v-bind:key="index"
          :config="actionConfig"
          v-on:iconButtonClick="actionClick"
          :disabled="disableAllButtons">
        </IconButtonMenuBeta>
      </div>
    </div>

    <div class="chart-container" v-if="showChart">
      <SmallBlock v-on:close="toggleChart()">
        <Chart :data-points="asset.prices"
               :line-width="3"
               :min-y="asset.minPrice"
               :max-y="asset.maxPrice"
               :positive-change="todayPriceChange > 0">
        </Chart>
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
import addresses from '../../common/addresses/avax/token_addresses.json';
import erc20ABI from '../../test/abis/ERC20.json';
import WrapModal from './WrapModal';

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

const BORROWABLE_ASSETS = ['AVAX', 'USDC'];

const ethers = require('ethers');


export default {
  name: 'AssetsTableRow',
  components: {LoadedValue, SmallBlock, Chart, IconButtonMenuBeta, ColoredValueBeta, SmallChartBeta},
  props: {
    asset: {},
  },
  mounted() {
    this.setupActionsConfiguration();
    this.watchExternalAssetBalanceUpdate();
    this.watchExternalAssetDebtUpdate();
    this.watchAssetBalancesDataRefreshEvent();
    this.watchDebtsPerAssetDataRefreshEvent();
    this.watchHardRefreshScheduledEvent();
    this.watchProgressBarState();
    this.setupPoolsApy();
  },
  data() {
    return {
      actionsConfig: null,
      showChart: false,
      rowExpanded: false,
      isBalanceEstimated: false,
      isDebtEstimated: false,
      disableAllButtons: false,
      borrowApyPerPool: {}
    };
  },
  computed: {
    ...mapState('fundsStore', ['smartLoanContract', 'health', 'assetBalances', 'fullLoanStatus', 'debtsPerAsset', 'assets', 'lpAssets', 'lpBalances', 'noSmartLoan']),
    ...mapState('stakeStore', ['farms']),
    ...mapState('poolStore', ['pools']),
    ...mapState('network', ['provider', 'account', 'accountBalance']),
    ...mapState('serviceRegistry', ['assetBalancesExternalUpdateService', 'dataRefreshEventService', 'progressBarService', 'assetDebtsExternalUpdateService', 'poolService']),

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
    ...mapActions('fundsStore', ['swap', 'fund', 'borrow', 'withdraw', 'withdrawNativeToken', 'repay', 'createAndFundLoan', 'fundNativeToken', 'wrapNativeToken']),
    ...mapActions('network', ['updateBalance']),
    setupActionsConfiguration() {
      this.actionsConfig = [
        {
          iconSrc: 'src/assets/icons/plus.svg',
          hoverIconSrc: 'src/assets/icons/plus_hover.svg',
          tooltip: BORROWABLE_ASSETS.includes(this.asset.symbol) ? 'Deposit / Borrow' : 'Deposit',
          menuOptions: [
            {
              key: 'ADD_FROM_WALLET',
              name: 'Deposit collateral'
            },
            BORROWABLE_ASSETS.includes(this.asset.symbol) ?
              {
                key: 'BORROW',
                name: 'Borrow',
                disabled: this.borrowDisabled(),
                disabledInfo: 'To borrow, you need to add some funds from you wallet first'
              }
              : null,
            {
              key: 'WRAP',
              name: 'Wrap native AVAX',
              hidden: true,
            }
          ]
        },
        {
          iconSrc: 'src/assets/icons/minus.svg',
          hoverIconSrc: 'src/assets/icons/minus_hover.svg',
          tooltip: BORROWABLE_ASSETS.includes(this.asset.symbol) ? 'Withdraw / Repay' : 'Withdraw',
          disabled: !this.hasSmartLoanContract,
          menuOptions: [
            {
              key: 'WITHDRAW',
              name: 'Withdraw collateral',
            },
            BORROWABLE_ASSETS.includes(this.asset.symbol) ?
              {
                key: 'REPAY',
                name: 'Repay',
              }
              : null
          ]
        },
        {
          iconSrc: 'src/assets/icons/swap.svg',
          hoverIconSrc: 'src/assets/icons/swap_hover.svg',
          tooltip: 'Swap',
          iconButtonActionKey: 'SWAP',
          disabled: !this.hasSmartLoanContract
        },
      ];
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

    formatTokenBalance(balance) {
      const balanceOrderOfMagnitudeExponent = String(balance).split('.')[0].length - 1;
      const precisionMultiplierExponent = 5 - balanceOrderOfMagnitudeExponent;
      const precisionMultiplier = Math.pow(10, precisionMultiplierExponent >= 0 ? precisionMultiplierExponent : 0);
      return balance !== null ? String(Math.round(balance * precisionMultiplier) / precisionMultiplier) : '';
    },

    actionClick(key) {
      switch (key) {
        case 'BORROW':
          this.openBorrowModal();
          break;
        case 'ADD_FROM_WALLET':
          this.openAddFromWalletModal();
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
        case 'WRAP':
          this.openWrapModal();
          break;
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
      const pool = this.pools[this.asset.symbol];
      const modalInstance = this.openModal(BorrowModal);
      modalInstance.asset = this.asset;
      modalInstance.assets = this.assets;
      modalInstance.assetBalances = this.assetBalances;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.lpBalances = this.lpBalances;
      modalInstance.farms = this.farms;
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.assetBalance = Number(this.assetBalances[this.asset.symbol]);
      modalInstance.debt = this.fullLoanStatus.debt;
      modalInstance.thresholdWeightedValue = this.fullLoanStatus.thresholdWeightedValue;
      modalInstance.poolTVL = Number(pool.tvl) - Number(pool.totalBorrowed);
      modalInstance.loanAPY = this.pools[this.asset.symbol].borrowingAPY;
      modalInstance.maxUtilisation = this.pools[this.asset.symbol].maxUtilisation;
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
      const modalInstance = this.openModal(SwapModal);
      modalInstance.sourceAsset = this.asset.symbol;
      modalInstance.sourceAssetBalance = this.assetBalances[this.asset.symbol];
      modalInstance.assets = this.assets;
      modalInstance.assetBalances = this.assetBalances;
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.lpBalances = this.lpBalances;
      modalInstance.farms = this.farms;
      modalInstance.targetAsset = Object.keys(config.ASSETS_CONFIG).filter(asset => asset !== this.asset.symbol)[0];
      modalInstance.debt = this.fullLoanStatus.debt;
      modalInstance.thresholdWeightedValue = this.fullLoanStatus.thresholdWeightedValue ? this.fullLoanStatus.thresholdWeightedValue : 0;
      modalInstance.health = this.fullLoanStatus.health;
      modalInstance.$on('SWAP', swapEvent => {
        console.log(swapEvent);
        const swapRequest = {
          ...swapEvent,
          sourceAmount: swapEvent.sourceAmount.toString()
        };
        this.handleTransaction(this.swap, {swapRequest: swapRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
        });
      });
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
      modalInstance.lpBalances = this.lpBalances;
      modalInstance.farms = this.farms;
      modalInstance.loan = this.fullLoanStatus.debt ? this.fullLoanStatus.debt : 0;
      modalInstance.thresholdWeightedValue = this.fullLoanStatus.thresholdWeightedValue ? this.fullLoanStatus.thresholdWeightedValue : 0;
      modalInstance.walletAssetBalance = await this.getWalletAssetBalance();
      modalInstance.noSmartLoan = this.noSmartLoan;
      modalInstance.$on('ADD_FROM_WALLET', addFromWalletEvent => {
        if (this.smartLoanContract) {
          const value = addFromWalletEvent.value;
          if (this.smartLoanContract.address === NULL_ADDRESS || this.noSmartLoan) {
            this.handleTransaction(this.createAndFundLoan, {asset: addFromWalletEvent.asset, value: value}, () => {
            }, (error) => {
              this.handleTransactionError(error);
            })
              .then(() => {
              });
          } else {
            if (addFromWalletEvent.asset === 'AVAX') {
              this.handleTransaction(this.fundNativeToken, {value: value}, () => {
                this.$forceUpdate();
              }, (error) => {
                console.log(error);
                this.handleTransactionError(error);
              }).then(() => {
              });
            } else {
              const fundRequest = {
                value: value,
                asset: this.asset.symbol,
                assetDecimals: config.ASSETS_CONFIG[this.asset.symbol].decimals,
                isLP: false,
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
      const modalInstance = this.openModal(WithdrawModal);
      modalInstance.asset = this.asset;
      modalInstance.assetBalance = this.assetBalances[this.asset.symbol];
      modalInstance.assets = this.assets;
      modalInstance.assetBalances = this.assetBalances;
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.lpBalances = this.lpBalances;
      modalInstance.farms = this.farms;
      modalInstance.health = this.fullLoanStatus.health;
      modalInstance.debt = this.fullLoanStatus.debt;
      modalInstance.thresholdWeightedValue = this.fullLoanStatus.thresholdWeightedValue ? this.fullLoanStatus.thresholdWeightedValue : 0;

      modalInstance.$on('WITHDRAW', withdrawEvent => {
        console.log(withdrawEvent);
        const value = Number(withdrawEvent.value).toFixed(config.DECIMALS_PRECISION);
        if (withdrawEvent.withdrawAsset === 'AVAX') {
          const withdrawRequest = {
            asset: withdrawEvent.withdrawAsset,
            value: value,
            assetDecimals: config.ASSETS_CONFIG[this.asset.symbol].decimals,
            isLP: false,
          };
          this.handleTransaction(this.withdrawNativeToken, {withdrawRequest: withdrawRequest}, () => {
            this.$forceUpdate();
          }, (error) => {
            this.handleTransactionError(error);
          })
            .then(() => {
            });
        } else {
          const withdrawRequest = {
            asset: this.asset.symbol,
            value: value,
            assetDecimals: config.ASSETS_CONFIG[this.asset.symbol].decimals,
            isLP: false,
          };
          this.handleTransaction(this.withdraw, {withdrawRequest: withdrawRequest}, () => {
            this.$forceUpdate();
          }, (error) => {
            this.handleTransactionError(error);
          })
            .then(() => {
            });
        }
      });
    },

    openRepayModal() {
      const modalInstance = this.openModal(RepayModal);
      modalInstance.asset = this.asset;
      modalInstance.assets = this.assets;
      modalInstance.assetBalances = this.assetBalances;
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.lpBalances = this.lpBalances;
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

    async getWalletAssetBalance() {
      const tokenContract = new ethers.Contract(addresses[this.asset.symbol], erc20ABI, this.provider.getSigner());
      return await this.getWalletTokenBalance(this.account, this.asset.symbol, tokenContract, false);
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
      if (error.code === 4001 || error.code === -32603) {
        this.progressBarService.emitProgressBarCancelledState();
      } else {
        this.progressBarService.emitProgressBarErrorState();
      }
      this.closeModal();
      this.disableAllButtons = false;
      this.isBalanceEstimated = false;
      this.isBalanceEstimated = false;
    },

    setupPoolsApy() {
      this.poolService.observePools().subscribe(pools => {
        pools.forEach(pool => {
          this.borrowApyPerPool[pool.asset.symbol] = pool.borrowingAPY;
        });
      });
    },
  },
  watch: {
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
    height: 433px;
  }

  .table__row {
    display: grid;
    grid-template-columns: repeat(6, 1fr) 76px 102px;
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

        .asset__loan {
          font-size: $font-size-xxs;
          color: $medium-gray;
        }
      }

      &.balance {
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

    .colored-value {
      font-weight: 500;
    }
  }
}

</style>