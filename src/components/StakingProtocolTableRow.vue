<template>
  <div class="staking-farm-table-row-component" v-if="farm">
    <div class="table__row">
      <div class="table__cell farm-cell">
        <div class="farm">
          <img class="protocol__icon" :src="`src/assets/logo/${protocol.logo}`">
          <div class="protocol__details">
            <div class="asset-name">
              {{ asset.name }}
              <img v-if="farm.info"
                   class="info__icon"
                   src="src/assets/icons/info.svg"
                   v-tooltip="{content: farm.info, classes: 'info-tooltip long', placement: 'right'}">
            </div>
            <div class="by-farm">{{ protocol.name }} -> {{ farm.strategy }}</div>
          </div>
        </div>
      </div>

      <div class="table__cell">
        <div class="double-value staked-balance">
          <div class="double-value__pieces">
            <span v-if="isStakedBalanceEstimated">~</span>{{
              isLP ? formatTokenBalance(underlyingTokenStaked, 10, true) : formatTokenBalance(underlyingTokenStaked)
            }}
          </div>
          <div class="double-value__usd">{{ underlyingTokenStaked * asset.price | usd }}</div>
        </div>
      </div>

      <div class="table__cell">
        <div class="reward__icons">
          <img class="reward__asset__icon" v-if="farm.rewardTokens" v-for="token of farm.rewardTokens"
               :src="logoSrc(token)">
        </div>
        <div class="double-value">
          <div class="double-value__pieces">
            {{ rewards | usd }}
          </div>
        </div>
      </div>

      <div class="table__cell">
        {{ apy | percent }}
      </div>

      <div class="table__cell max-apy">
        {{ maxApy | percent }}
      </div>

      <div class="table__cell">
        <div class="actions">
          <IconButtonMenuBeta
            class="action"
            v-for="(actionConfig, index) of actionsConfig"
            :disabled="disabled"
            v-bind:key="index"
            :config="actionConfig"
            v-on:iconButtonClick="actionClick">
          </IconButtonMenuBeta>
        </div>
      </div>

    </div>
  </div>
</template>

<script>
import StakeModal from './StakeModal';
import UnstakeModal from './UnstakeModal';
import {mapState, mapActions} from 'vuex';
import config from '../config';
import {calculateMaxApy} from '../utils/calculate';
import {assetAppreciation} from '../utils/blockchain';
import IconButtonMenuBeta from './IconButtonMenuBeta';

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

export default {
  name: 'StakingProtocolTableRow',
  components: {IconButtonMenuBeta},
  props: {
    farm: {
      required: true,
    },
    asset: {
      required: true,
    }
  },
  async mounted() {
    this.setupActionsConfiguration();
    this.watchHardRefreshScheduledEvent();
    this.watchAssetBalancesDataRefreshEvent();
    this.watchProgressBarState();
    this.watchFarmRefreshEvent();
    this.watchExternalStakedPerFarm();
  },
  data() {
    return {
      receiptTokenBalance: 0,
      underlyingTokenStaked: 0,
      apy: 0,
      maxApy: 0,
      rewards: 0,
      isStakedBalanceEstimated: false,
      disableAllButtons: false,
      assetBalances: {},
      lpBalances: {},
      actionsConfig: {}
    };
  },
  watch: {
    smartLoanContract: {
      async handler(smartLoanContract) {
        if (smartLoanContract) {
          this.$emit('stakedChange', this.underlyingTokenStaked);
        }
      },
      immediate: true
    },
    pools: {
      handler(pools) {
        this.maxApy = calculateMaxApy(this.pools, this.apy);
      }
    }
  },
  computed: {
    ...mapState('poolStore', ['pools']),
    ...mapState('stakeStore', ['farms']),
    ...mapState('fundsStore', ['smartLoanContract']),
    ...mapState('serviceRegistry', ['assetBalancesExternalUpdateService', 'stakedExternalUpdateService', 'dataRefreshEventService', 'progressBarService', 'farmService']),
    protocol() {
      return config.PROTOCOLS_CONFIG[this.farm.protocol];
    },
    disabled() {
      return !this.smartLoanContract || this.smartLoanContract.address === NULL_ADDRESS || this.disableAllButtons;
    },
    isLP() {
      return this.asset.secondary != null;
    }
  },
  methods: {
    ...mapActions('stakeStore', ['stake', 'unstake']),

    actionClick(key) {
      switch (key) {
        case 'STAKE':
          this.openStakeModal();
          break;
        case 'UNSTAKE':
          this.openUnstakeModal();
          break;
      }
    },

    async openStakeModal() {
      console.log(this.farm);
      if (this.disabled) {
        return;
      }

      const modalInstance = this.openModal(StakeModal);
      modalInstance.apy = this.apy;
      modalInstance.available = this.asset.secondary ? this.lpBalances[this.asset.symbol] : this.assetBalances[this.asset.symbol];
      modalInstance.underlyingTokenStaked = this.underlyingTokenStaked;
      modalInstance.rewards = this.rewards;
      modalInstance.asset = this.asset;
      modalInstance.protocol = this.protocol;
      modalInstance.isLP = this.isLP;
      modalInstance.$on('STAKE', (stakeValue) => {
        console.log(stakeValue);
        const stakeRequest = {
          feedSymbol: this.farm.feedSymbol,
          assetSymbol: this.asset.symbol,
          protocol: this.farm.protocol,
          amount: stakeValue.toString(),
          method: this.farm.stakeMethod,
          decimals: this.asset.decimals,
          gas: this.farm.gasStake,
          refreshDelay: this.farm.refreshDelay ? this.farm.refreshDelay : 30000,
          isLP: this.isLP,
        };
        console.log(stakeRequest);
        this.handleTransaction(this.stake, {stakeRequest: stakeRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        });
      });
    },

    openUnstakeModal() {
      if (this.disabled) {
        return;
      }

      const modalInstance = this.openModal(UnstakeModal);
      modalInstance.apy = this.apy;
      modalInstance.staked = this.underlyingTokenStaked;
      modalInstance.asset = this.asset;
      modalInstance.receiptTokenBalance = this.farm.totalBalance;
      modalInstance.protocol = this.protocol;
      modalInstance.isLP = this.isLP;
      modalInstance.$on('UNSTAKE', unstakeEvent => {
        console.log(unstakeEvent);
        const unstakeRequest = {
          receiptTokenUnstaked: unstakeEvent.receiptTokenUnstaked.toString(),
          underlyingTokenUnstaked: unstakeEvent.underlyingTokenUnstaked.toString(),
          minUnderlyingTokenUnstaked: this.farm.minAmount * parseFloat(unstakeEvent.receiptTokenUnstaked),
          assetSymbol: this.asset.symbol,
          feedSymbol: this.farm.feedSymbol,
          protocol: this.farm.protocol,
          method: this.farm.unstakeMethod,
          decimals: this.asset.decimals,
          gas: this.farm.gasUnstake,
          rewardTokens: this.farm.rewardTokens ? this.farm.rewardTokens : [],
          refreshDelay: this.farm.refreshDelay ? this.farm.refreshDelay : 30000,
          isLP: this.isLP,
          isMax: unstakeEvent.isMax
        };
        this.handleTransaction(this.unstake, {unstakeRequest: unstakeRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        });
      });
    },

    watchHardRefreshScheduledEvent() {
      this.dataRefreshEventService.hardRefreshScheduledEvent$.subscribe(() => {
        this.disableAllButtons = true;
        this.$forceUpdate();
      });
    },

    watchAssetBalancesDataRefreshEvent() {
      this.dataRefreshEventService.assetBalancesDataRefreshEvent$.subscribe((refreshEvent) => {
        this.assetBalances = refreshEvent.assetBalances;
        this.lpBalances = refreshEvent.lpBalances;
        this.disableAllButtons = false;
        this.$forceUpdate();
      });
    },

    watchFarmRefreshEvent() {
      this.farmService.observeRefreshFarm().subscribe(async () => {
        this.balance = this.farm.totalBalance;
        this.underlyingTokenStaked = this.farm.totalStaked;
        this.rewards = this.farm.rewards;
        await this.setApy();
      })
    },

    watchExternalStakedPerFarm() {
      this.stakedExternalUpdateService.observeExternalStakedBalancesPerFarmUpdate().subscribe(stakedBalancesPerFarmUpdate => {
        if (this.asset.symbol === stakedBalancesPerFarmUpdate.assetSymbol && this.farm.protocol === stakedBalancesPerFarmUpdate.protocol) {
          this.receiptTokenBalance = stakedBalancesPerFarmUpdate.receiptTokenBalance;
          this.farm.totalBalance = stakedBalancesPerFarmUpdate.receiptTokenBalance;
          this.underlyingTokenStaked = stakedBalancesPerFarmUpdate.stakedBalance;
          this.farm.totalStaked = stakedBalancesPerFarmUpdate.stakedBalance;
          console.log('this.receiptTokenBalance', this.receiptTokenBalance);
          console.log('this.farm.totalBalance', this.farm.totalBalance);
        }
        this.$forceUpdate();
      });
    },

    async setApy() {
      if (!this.farm.currentApy) return 0;
      let assetApr = this.asset.currentApr ? this.asset.currentApr : 0;
      this.apy = (1 + this.farm.currentApy + assetApr) * assetAppreciation(this.asset.symbol) - 1;

      if (this.pools) {
        this.maxApy = calculateMaxApy(this.pools, this.apy);
      }
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
            this.isStakedBalanceEstimated = false;
            this.disableAllButtons = false;
            break;
          }
          case 'CANCELLED' : {
            this.isStakedBalanceEstimated = false;
            this.disableAllButtons = false;
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
      this.isStakedBalanceEstimated = false;
    },

    setupActionsConfiguration() {
      this.actionsConfig = [
        {
          iconSrc: 'src/assets/icons/plus.svg',
          hoverIconSrc: 'src/assets/icons/plus_hover.svg',
          tooltip: 'Stake',
          iconButtonActionKey: 'STAKE'
        },
        {
          iconSrc: 'src/assets/icons/minus.svg',
          hoverIconSrc: 'src/assets/icons/minus_hover.svg',
          tooltip: 'Unstake',
          iconButtonActionKey: 'UNSTAKE'
        },
      ];
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.staking-farm-table-row-component {

  .table__row {
    display: grid;
    grid-template-columns: 23% 1fr 170px 170px 160px 156px 22px;
    height: 60px;
    border-style: solid;
    border-width: 2px 0 0 0;
    border-image-source: linear-gradient(to right, #dfe0ff 43%, #ffe1c2 62%, #ffd3e0 79%);
    border-image-slice: 1;
    padding: 0 6px;

    .table__cell {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: flex-end;
      font-weight: 500;
      font-size: $font-size-xsm;

      &.farm-cell {
        justify-content: flex-start;
      }

      .farm {
        display: flex;
        flex-direction: row;
        align-items: center;

        .protocol__icon {
          height: 22px;
          width: 22px;
          border-radius: 50%;
        }

        .protocol__details {
          display: flex;
          flex-direction: column;
          margin-left: 10px;

          .asset__name {
            font-size: $font-size-xsm;
            font-weight: 500;
          }

          .info__icon {
            transform: translateY(-2px);
          }

          .by-farm {
            font-size: $font-size-xxs;
            font-weight: 500;
            color: $medium-gray;
            margin-top: -2px;
          }
        }
      }

      .double-value {
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        text-align: end;

        .double-value__pieces {
          font-weight: 500;
          font-size: $font-size-xsm;
        }

        &.balance-balance {
          .double-value__pieces {
            font-weight: 600;
          }
        }

        .double-value__usd {
          font-size: $font-size-xxs;
          color: $medium-gray;
        }
      }

      &.max-apy {
        font-weight: 600;
      }

      .reward__icons {
        .reward__asset__icon {
          margin-right: 5px;
          width: 20px;
          height: 20px;
        }
      }

      .actions {
        display: flex;
        flex-direction: row;
        align-items: center;

        .action {
          width: 26px;
          height: 26px;
          cursor: pointer;

          &:not(:last-child) {
            margin-right: 12px;
          }

          &.disabled {
            opacity: 0.5;
            cursor: default;
          }
        }
      }
    }
  }
}
</style>
<style lang="scss">
.tooltip {
  max-width: none;
  width: auto;
}
</style>