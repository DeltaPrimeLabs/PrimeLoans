<template>
  <div v-if="provider" class="lp-table-row-component" :class="{'expanded': rowExpanded}">
    <div class="table__row" v-if="lpToken">
      <div class="table__cell asset">
        <DoubleAssetIcon :primary="lpToken.reverseOrder ? lpToken.secondary : lpToken.primary"
                         :secondary="lpToken.reverseOrder ? lpToken.primary : lpToken.secondary"></DoubleAssetIcon>
        <div class="asset__info">
          <div class="asset__name">{{
              lpToken.reverseOrder ? `${lpToken.secondary} - ${lpToken.primary}` : `${lpToken.primary} - ${lpToken.secondary}`
            }}
          </div>
          <div class="asset__dex">
            by {{ lpToken.dex }}
          </div>
        </div>
      </div>

      <div class="table__cell table__cell--double-value farmed">
        <template
          v-if="balancerLpBalances">
          <div class="double-value__pieces">
            <img v-if="hasNonStakedLp" src="src/assets/icons/error.svg"
                 v-tooltip="{content: 'Your Prime Account has unstaked LP tokens. You can use `Stake` function to add them to your Balance or `Export unstaked LP tokens` to withdraw them to your wallet.', classes: 'info-tooltip long'}"/>
            {{ balancerLpBalances[lpToken.symbol] | smartRound }}
          </div>
          <div class="double-value__usd">
            <span v-if="balancerLpBalances">{{ balancerLpBalances[lpToken.symbol] * lpToken.price | usd }}</span>
          </div>
        </template>
        <template v-else>
          <div class="no-value-dash"></div>
        </template>
      </div>

      <div class="table__cell table__cell--double-value">
        <template>
          <div class="table__cell rewards">
            <span>
              <img class="asset__icon" :src="getAssetIcon('BAL')">
              <img v-tooltip="{content: `Your accumulated BAL rewards will be visible soon.`, classes: 'info-tooltip'}"
                   src="src/assets/icons/stars.png" class="stars-icon">
            </span>
            <span v-for="symbol in lpToken.rewardTokens">
              <img class="asset__icon" :src="getAssetIcon(symbol)">
              <span
                v-if="lpToken.rewardBalances && lpToken.rewardBalances[symbol] && parseFloat(lpToken.rewardBalances[symbol]) !== null">{{
                  formatTokenBalance((lpToken.rewardBalances && lpToken.rewardBalances[symbol] && !rewardsReset) ? lpToken.rewardBalances[symbol] : 0, 6, true)
                }}</span>
              <vue-loaders-ball-beat v-else color="#A6A3FF" scale="0.5"></vue-loaders-ball-beat>
            </span>
          </div>
        </template>
      </div>

      <div class="table__cell table__cell--double-value loan">
        {{ formatTvl(lpToken.tvl) }}
      </div>

      <div class="table__cell table__cell--double-value apr" v-bind:class="{'apr--with-warning': lpToken.aprWarning}">
        {{ lpToken.apy / 100 | percent }}
        <div class="apr-warning" v-if="lpToken.aprWarning">
          <img src="src/assets/icons/warning.svg"
               v-tooltip="{content: lpToken.aprWarning, classes: 'info-tooltip long'}">
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
          :disabled="disableAllButtons || noSmartLoan">
        </IconButtonMenuBeta>
        <IconButtonMenuBeta
          class="actions__icon-button last"
          :config="removeActionsConfig"
          v-if="removeActionsConfig"
          v-on:iconButtonClick="actionClick"
          :disabled="disableAllButtons || noSmartLoan">
        </IconButtonMenuBeta>
        <IconButtonMenuBeta
          class="actions__icon-button"
          v-if="moreActionsConfig"
          :config="moreActionsConfig"
          v-on:iconButtonClick="actionClick"
          :disabled="disableAllButtons || !healthLoaded">
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
import {mapActions, mapState} from 'vuex';
import ProvideLiquidityModal from './ProvideLiquidityModal';
import RemoveLiquidityModal from './RemoveLiquidityModal';

const ethers = require('ethers');
import erc20ABI from '../../test/abis/ERC20.json';
import {calculateMaxApy, fromWei} from '../utils/calculate';
import DeltaIcon from './DeltaIcon.vue';
import StakeBalancerV2Modal from './StakeBalancerV2Modal.vue';
import WithdrawBalancerV2Modal from './WithdrawBalancerV2Modal.vue';
import {formatUnits} from 'ethers/lib/utils';
import config from '../config';
import BalancerUnwindLpModal from './BalancerUnwindLpModal.vue';
import ClaimBalancerRewardsModal from './ClaimBalancerRewardsModal.vue';
import {ActionSection} from '../services/globalActionsDisableService';

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

export default {
  name: 'BalancerLpTableRow',
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
    this.providerService.observeProvider().subscribe(() => {
      this.setupAddActionsConfiguration();
      this.setupRemoveActionsConfiguration();
      this.setupMoreActionsConfiguration();
      this.watchAssetBalancesDataRefreshEvent();
      this.watchHardRefreshScheduledEvent();
      this.watchHealth();
      this.watchProgressBarState();
      this.watchAssetApysRefresh();
      this.watchExternalAssetBalanceUpdate();
      this.watchRefreshLP();
      this.setupApr();
      this.watchActionDisabling();
    })
  },

  data() {
    return {
      addActionsConfig: null,
      removeActionsConfig: null,
      moreActionsConfig: null,
      showChart: false,
      rowExpanded: false,
      poolBalance: 0,
      apr: 0,
      tvl: 0,
      lpTokenBalances: [],
      isLpBalanceEstimated: false,
      disableAllButtons: false,
      healthLoaded: false,
      totalStaked: null,
      hasNonStakedLp: false,
      availableFarms: [],
      nonStakedLpBalance: 0,
      rewardsReset: false,
      isActionDisabledRecord: {},
    };
  },

  computed: {
    ...mapState('fundsStore', [
      'health',
      'lpBalances',
      'smartLoanContract',
      'fullLoanStatus',
      'assetBalances',
      'assetAvailableBalances',
      'assets',
      'debtsPerAsset',
      'lpAssets',
      'concentratedLpBalances',
      'concentratedLpAssets',
      'traderJoeV2LpAssets',
      'levelLpAssets',
      'levelLpBalances',
      'balancerLpAssets',
      'balancerLpBalances',
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
      'providerService',
      'accountService',
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
        }
      },
    },
    provider: {
      async handler(provider) {
        if (provider) {
        }
      }
    },
    assets: {
      handler(assets) {
        if (assets) {
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
    ...mapActions('fundsStore', [
      'fundAndStakeBalancerV2',
      'unstakeAndWithdrawBalancerV2',
      'provideLiquidityAndStakeBalancerV2',
      'unstakeAndRemoveLiquidityBalancerV2',
      'stakeBalancerV2',
      'withdrawBalancerV2',
      'claimRewardsBalancerV2'
    ]),
    setupAddActionsConfiguration(hasNonStakedLP = false) {
      this.addActionsConfig =
        {
          iconSrc: 'src/assets/icons/plus.svg',
          tooltip: 'Add',
          menuOptions: [
            {
              key: 'FUND_AND_STAKE',
              name: 'Import existing LP position',
              disabled: this.isActionDisabledRecord['FUND_AND_STAKE'],
            },
            {
              key: 'PROVIDE_LIQUIDITY',
              name: 'Create LP position',
              disabled: this.isActionDisabledRecord['PROVIDE_LIQUIDITY'],
              // disabled: !this.hasSmartLoanContract,
              // disabledInfo: 'To create LP token, you need to add some funds from you wallet first'
            }
          ]
        }
      if (hasNonStakedLP) {
        this.addActionsConfig.menuOptions.push({
          key: 'STAKE',
          name: 'Stake LP tokens',
          disabled: this.isActionDisabledRecord['STAKE'],
        })
      }
    },

    setupRemoveActionsConfiguration(hasNonStakedLP = false) {
      this.removeActionsConfig =
        {
          iconSrc: 'src/assets/icons/minus.svg',
          tooltip: 'Remove',
          menuOptions: [
            {
              key: 'UNSTAKE_AND_WITHDRAW',
              name: 'Export LP position',
              // disabled: !this.hasSmartLoanContract,,
              disabled: this.isActionDisabledRecord['UNSTAKE_AND_WITHDRAW'],
            },
            {
              key: 'REMOVE_LIQUIDITY',
              name: 'Unwind LP position',
              // disabled: !this.hasSmartLoanContract,,
              disabled: this.isActionDisabledRecord['REMOVE_LIQUIDITY'],
            }
          ]
        }
      if (hasNonStakedLP) {
        this.addActionsConfig.menuOptions.push({
          key: 'WITHDRAW',
          name: 'Withdraw unstaked LP tokens',
          disabled: this.isActionDisabledRecord['WITHDRAW'],
        })
      }
    },

    setupMoreActionsConfiguration() {
      this.moreActionsConfig = {
        iconSrc: 'src/assets/icons/icon_a_more.svg',
        tooltip: 'More',
        menuOptions: [
          {
            key: 'CLAIM_REWARDS',
            name: 'Claim rewards',
            disabled: this.isActionDisabledRecord['CLAIM_REWARDS'],
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
          case 'FUND_AND_STAKE':
            this.openImportModal();
            break;
          case 'STAKE':
            this.openStakeModal();
            break;
          case 'PROVIDE_LIQUIDITY':
            this.openProvideLiquidityModal();
            break;
          case 'UNSTAKE_AND_WITHDRAW':
            this.openUnstakeAndWithdrawModal();
            break;
          case 'WITHDRAW':
            this.openWithdrawModal();
            break;
          case 'REMOVE_LIQUIDITY':
            this.openRemoveLiquidityModal();
            break;
          case 'CLAIM_REWARDS':
            this.openClaimRewardsModal();
            break;
        }
      }
    },

    async openImportModal() {
      const modalInstance = this.openModal(StakeBalancerV2Modal);
      modalInstance.balance = await this.getWalletLpTokenBalance();
      modalInstance.title = 'Import Balancer LP tokens';
      modalInstance.description = 'Your Balancer position will be imported to your Prime Account. This requires 3 transactions (approval, depositing and staking). If you don\'t see your BPT tokens here, please unstake them first on the Balancer website.';

      modalInstance.$on('STAKE', provideLiquidityEvent => {
        if (this.smartLoanContract) {
          const fundRequest = {
            symbol: this.lpToken.symbol,
            poolId: this.lpToken.poolId
          };
          this.handleTransaction(this.fundAndStakeBalancerV2, {fundRequest: fundRequest}, () => {
            this.$forceUpdate();
          }, (error) => {
            this.handleTransactionError(error);
          }).then(() => {
          });
        }
      });
    },

    async openStakeModal() {
      const modalInstance = this.openModal(StakeBalancerV2Modal);
      modalInstance.title = 'Stake Balancer LP tokens';
      modalInstance.description = 'Your unstaked Balancer tokens will be staked through your Prime Account.';

      const bptContract = new ethers.Contract(this.lpToken.address, erc20ABI, provider);

      modalInstance.balance = formatUnits(await bptContract.balanceOf(this.smartLoanContract.address), this.lpToken.decimals);

      modalInstance.$on('STAKE', provideLiquidityEvent => {
        if (this.smartLoanContract) {
          const fundRequest = {
            symbol: this.lpToken.symbol,
            poolId: this.lpToken.poolId
          };
          this.handleTransaction(this.stakeBalancerV2, {fundRequest: fundRequest}, () => {
            this.$forceUpdate();
          }, (error) => {
            this.handleTransactionError(error);
          }).then(() => {
          });
        }
      });
    },

    async openUnstakeAndWithdrawModal() {
      const modalInstance = this.openModal(WithdrawBalancerV2Modal);
      modalInstance.title = 'Export LP token';
      modalInstance.description = 'Your Balancer position will be unstaked and exported to your wallet.';
      modalInstance.balance = this.balancerLpBalances[this.lpToken.symbol];
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.assetBalances = this.assetBalances;

      modalInstance.initiate();

      modalInstance.$on('WITHDRAW', provideLiquidityEvent => {
        if (this.smartLoanContract) {
          const withdrawRequest = {
            symbol: this.lpToken.symbol,
            poolId: this.lpToken.poolId
          };
          this.handleTransaction(this.unstakeAndWithdrawBalancerV2, {withdrawRequest: withdrawRequest}, () => {
            this.$forceUpdate();
          }, (error) => {
            this.handleTransactionError(error);
          }).then(() => {
          });
        }
      });
    },

    async openWithdrawModal() {
      const modalInstance = this.openModal(WithdrawBalancerV2Modal);
      modalInstance.title = 'Export unstaked LP token';
      modalInstance.description = 'Your unstaked Balancer tokens will be exported to your wallet.';
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.assetBalances = this.assetBalances;

      const bptContract = new ethers.Contract(this.lpToken.address, erc20ABI, provider);

      modalInstance.balance = formatUnits(await bptContract.balanceOf(this.smartLoanContract.address), this.lpToken.decimals);

      modalInstance.initiate();

      modalInstance.$on('WITHDRAW', provideLiquidityEvent => {
        if (this.smartLoanContract) {
          const withdrawRequest = {
            symbol: this.lpToken.symbol,
            poolId: this.lpToken.poolId
          };
          this.handleTransaction(this.withdrawBalancerV2, {withdrawRequest: withdrawRequest}, () => {
            this.$forceUpdate();
          }, (error) => {
            this.handleTransactionError(error);
          }).then(() => {
          });
        }
      });
    },

    openProvideLiquidityModal() {
      const modalInstance = this.openModal(ProvideLiquidityModal);
      modalInstance.lpToken = this.lpToken;
      console.log(this.balancerLpBalances);
      modalInstance.lpTokenBalance = Number(this.balancerLpBalances[this.lpToken.symbol]);
      modalInstance.firstAssetBalance = this.assetAvailableBalances[this.lpToken.primary];
      modalInstance.secondAssetBalance = this.assetAvailableBalances[this.lpToken.secondary];
      modalInstance.areAmountsLinked = false;
      modalInstance.$on('PROVIDE_LIQUIDITY', provideLiquidityEvent => {
        if (this.smartLoanContract) {
          const provideLiquidityRequest = {
            poolId: this.lpToken.poolId,
            symbol: this.lpToken.symbol,
            firstAsset: this.lpToken.primary,
            secondAsset: this.lpToken.secondary,
            firstAmount: provideLiquidityEvent.firstAmount ? provideLiquidityEvent.firstAmount.toString() : '0',
            secondAmount: provideLiquidityEvent.secondAmount ? provideLiquidityEvent.secondAmount.toString() : '0',
            addedLiquidity: provideLiquidityEvent.addedLiquidity,
          };
          this.handleTransaction(this.provideLiquidityAndStakeBalancerV2, {provideLiquidityRequest: provideLiquidityRequest}, () => {
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
      const modalInstance = this.openModal(BalancerUnwindLpModal);
      modalInstance.assets = this.assets;
      modalInstance.lpToken = this.lpToken;
      modalInstance.lpTokenDecimals = this.lpToken.decimals;
      modalInstance.lpTokenBalance = Number(this.balancerLpBalances[this.lpToken.symbol]);
      modalInstance.firstBalance = Number(this.assetBalances[this.lpToken.primary]);
      modalInstance.secondBalance = Number(this.assetBalances[this.lpToken.secondary]);
      modalInstance.unwindAssetOptions = [config.ASSETS_CONFIG[this.lpToken.primary], config.ASSETS_CONFIG[this.lpToken.secondary]]
      modalInstance.smartLoanContract = this.smartLoanContract;
      modalInstance.$on('REMOVE_LIQUIDITY', removeEvent => {
        const removeLiquidityRequest = {
          poolId: this.lpToken.poolId,
          symbol: this.lpToken.symbol,
          targetAsset: removeEvent.targetAsset,
          amount: removeEvent.amount,
          //TODO: should provide targetReceived here and have this logic in modal
          minReceivedFirst: removeEvent.minReceivedFirst,
          minReceivedSecond: removeEvent.minReceivedSecond,
          isFirstUnstaked: removeEvent.targetAsset === this.lpToken.primary
        };

        this.handleTransaction(this.unstakeAndRemoveLiquidityBalancerV2, {removeLiquidityRequest: removeLiquidityRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
        });
      });
    },

    async openClaimRewardsModal() {
      const modalInstance = this.openModal(ClaimBalancerRewardsModal);

      modalInstance.$on('CLAIM', claimEvent => {
        if (this.smartLoanContract) {
          const claimRequest = {
            poolId: this.lpToken.poolId
          };
          this.handleTransaction(this.claimRewardsBalancerV2, {claimRequest: claimRequest}, () => {
            this.$forceUpdate();
          }, (error) => {
            this.handleTransactionError(error);
          }).then(() => {
          });
        }
      });
    },

    async setupPoolBalance() {
      const gaugeContract = new ethers.Contract(this.lpToken.gaugeAddress, erc20ABI, provider);
      const bptContract = new ethers.Contract(this.lpToken.address, erc20ABI, provider);
      //TODO: multicall
      this.bptBalance = fromWei(await bptContract.totalSupply());
    },

    async getWalletLpTokenBalance() {
      const tokenContract = new ethers.Contract(this.lpToken.address, erc20ABI, this.provider.getSigner());
      return await this.getWalletTokenBalance(this.account, this.lpToken.symbol, tokenContract, this.lpToken.decimals);
    },

    async setupHasNonStakedLp() {
      const tokenContract = new ethers.Contract(this.lpToken.address, erc20ABI, this.provider.getSigner());
      let nonStakedLpBalance = fromWei(await tokenContract.balanceOf(this.smartLoanContract.address));
      this.hasNonStakedLp = nonStakedLpBalance > 0;
      this.nonStakedLpBalance = nonStakedLpBalance;
      this.setupAddActionsConfiguration(this.hasNonStakedLp);
      this.setupRemoveActionsConfiguration(this.hasNonStakedLp);
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
        this.setupHasNonStakedLp();
      });
    },

    watchAssetApysRefresh() {
      this.dataRefreshEventService.observeAssetApysDataRefresh().subscribe(async () => {
        await this.setupApr();
      })
    },

    watchExternalAssetBalanceUpdate() {
      this.assetBalancesExternalUpdateService.observeExternalAssetBalanceUpdate().subscribe(updateEvent => {
        console.warn('BalancerLPTableRow.watchExternalAssetBalanceUpdate subscribe');
        console.log(updateEvent);
        if (updateEvent.assetSymbol === this.lpToken.symbol) {
          this.balancerLpBalances[this.lpToken.symbol] = updateEvent.balance;
          this.isBalanceEstimated = !updateEvent.isTrueData;
          this.setupHasNonStakedLp();
          this.$forceUpdate();
        }
      })
    },

    watchRefreshLP() {
      this.lpService.observeRefreshLp().subscribe(async (lpType) => {
        if (lpType === 'BALANCER_V2_REWARDS_CLAIMED') {
          this.rewardsReset = true;
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
      this.globalActionsDisableService.getSectionActions$(ActionSection.BALANCER_LP)
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
    height: 387px;
  }

  .table__row {
    display: grid;
    grid-template-columns: repeat(2, 1fr) 300px 10% 10% 10% 60px 80px 22px;
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

      &.farmed {
        align-items: flex-end;
      }

      &.loan, &.apr, &.max-apr {
        align-items: flex-end;
      }

      &.rewards {
        display: flex;
        align-items: center;
        justify-content: flex-end;

        .asset__icon {
          margin-left: 5px;
          height: 22px;
          width: 22px;
          border-radius: 50%;
          margin-right: 9px;
        }
      }

      &.apr.apr--with-warning {
        position: relative;

        .apr-warning {
          position: absolute;
          right: -25px;
        }
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

      .stars-icon {
        width: 20px;
        margin-right: 10px;
        transform: translateY(-2px);
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
