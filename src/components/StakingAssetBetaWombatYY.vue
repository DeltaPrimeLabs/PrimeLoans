<template>
  <div v-if="farm" class="staking-asset-component">
    <div class="staking-asset">
      <div class="staking-asset__header"
           v-bind:class="{'body-collapsed': bodyHasCollapsed, 'round-bottom': stakingHeaderRoundBottom}"
           v-on:click="toggleExpanded()">
        <div class="header__cell cell__asset">
          <div class="asset">
            <div class="asset__icon asset__icon--double">
              <DoubleAssetIcon :primary="farm.assetToken"
                               :force-secondary="`src/assets/logo/${farm.lpTokenLogo}`">
              </DoubleAssetIcon>
            </div>
            <div class="asset__info">
              <div class="asset__name">
                {{ farm.name }}
              </div>
              <div class="asset__dex">
                from Wombat {{ farm.poolName }}
              </div>
            </div>
          </div>
        </div>

        <div class="header__cell cell__staked">
        </div>

        <div class="header__cell cell__available">
          <div class="header__cell__label">
            Available:
          </div>
          <div class="header__cell__value">
            <template v-if="available">
              <span class="asset-icon-with-value">
                <img class="asset__icon" :src="getAssetIcon(farm.assetToken)">
                <span>{{ formatTokenBalanceWithLessThan(available.assetToken) }}</span>
              </span>
<!--              <span class="asset-icon-with-value">-->
<!--                <img class="asset__icon" :src="`src/assets/logo/${farm.lpTokenLogo}`">-->
<!--                <span>{{ formatTokenBalanceWithLessThan(available.lpAssetToken) }}</span>-->
<!--            </span>-->
            </template>
            <template v-else>0</template>
          </div>
        </div>

        <div class="header__cell cell__staked">
          <div class="header__cell__label">Staked:</div>
          <div class="header__cell__value" v-if="wombatYYFarmsBalances">
            <span v-if="isTotalStakedEstimated">~</span>{{ formatTokenBalanceWithLessThan(wombatYYFarmsBalances[farm.apyKey], 8) }}
          </div>
        </div>

        <div class="header__cell cell__max-apy max-apr">
          <div class="header__cell__label">Max APY:</div>
          <div class="header__cell__value"><span>{{ (maxLeveragedApy + boostApy) | percent }}<img v-if="boostApy" v-tooltip="{content: `This pool is incentivized!<br>⁃ up to ${maxLeveragedApy ? (maxLeveragedApy * 100).toFixed(2) : 0}% Pool APR<br>⁃ up to ${boostApy ? (boostApy * 100).toFixed(2) : 0}% ${chain === 'arbitrum' ? 'ARB' : 'AVAX'} incentives`, classes: 'info-tooltip'}" src="src/assets/icons/stars.png" class="stars-icon"></span>
          </div>
        </div>

        <div class="header__cell cell__protocols">
          <div class="header__cell__label">Protocols:</div>
          <div class="protocols-list">
            <img class="protocol__icon"
                 :src="`src/assets/logo/${protocolLogo(farm.protocol)}`">
          </div>
        </div>

        <div class="header__cell cell__action" v-bind:class="{'expanded': tableBodyExpanded}">
          <DeltaIcon class="chevron" :icon-src="'src/assets/icons/chevron-down.svg'" :size="21"></DeltaIcon>
        </div>
      </div>

      <div class="staking-protocols" v-bind:class="{'expanded': tableBodyExpanded}"
           :style="{height: tableBodyExpanded ? '117px' : '0px'}">

        <!--        <div class="compounding__divider">-->
        <!--          <span class="divider__title">Auto-compounding</span>-->
        <!--          <InfoIcon-->
        <!--              :tooltip="{content: 'These farms automatically swap your reward token for the deposited token and restakes it.', classes: 'info-tooltip long', placement: 'top'}"></InfoIcon>-->
        <!--        </div>-->

        <div class="protocols__table">
          <div class="table__header">
            <div class="table__header__cell asset">Asset & protocol</div>
            <div class="table__header__cell">Staked&nbsp;
              <div class="info__icon__wrapper">
                <InfoIcon
                    :tooltip="{content: 'How many tokens you are currently staking.', classes: 'info-tooltip long', placement: 'force-top'}"></InfoIcon>
              </div>
            </div>
            <div v-if="farm.boostGGP" class="table__header__cell">GGP collected
              <div class="info__icon__wrapper">
                <InfoIcon
                    :tooltip="{content: ggpCollectedTooltip, classes: 'info-tooltip long', placement: 'force-top'}"></InfoIcon>
              </div>
            </div>
            <div v-else class="table__header__cell"></div>
            <div class="table__header__cell">Min. APY
              <div class="info__icon__wrapper">
                <InfoIcon
                    :tooltip="{content: minApyTooltip, classes: 'info-tooltip long', placement: 'force-top'}"></InfoIcon>
              </div>
            </div>
            <div class="table__header__cell">Max. APY
              <div class="info__icon__wrapper">
                <InfoIcon
                    :tooltip="{content: maxApyTooltip, classes: 'info-tooltip long', placement: 'force-top'}"></InfoIcon>
              </div>
            </div>
            <div class="table__header__cell">Actions</div>
          </div>

          <div class="table__body" v-if="wombatYYFarmsBalances">
            <div></div>
            <StakingProtocolTableRowWombatYY
                :farm="farm"
                :total-staked="wombatYYFarmsBalances[farm.apyKey]"
                v-on:stakedChange="stakedChange">
            </StakingProtocolTableRowWombatYY>
          </div>

        </div>
      </div>

    </div>
  </div>
</template>

<script>
import StakingProtocolTableRow from './StakingProtocolTableRow';
import config from '@/config';
import {mapState} from 'vuex';
import DoubleAssetIcon from './DoubleAssetIcon';
import {calculateMaxApy} from '../utils/calculate';
import DeltaIcon from "./DeltaIcon.vue";
import InfoIcon from "./InfoIcon.vue";
import {formatUnits} from "ethers/lib/utils";
import StakingProtocolTableRowWombatYY from "./StakingProtocolTableRowWombatYY.vue";


export default {
  name: 'StakingAssetBetaWombatYY',
  components: {StakingProtocolTableRowWombatYY, InfoIcon, DeltaIcon, DoubleAssetIcon, StakingProtocolTableRow},
  props: {
    farm: {
      required: true,
    }
  },
  data() {
    return {
      available: null,
      chain: null,
      tableBodyExpanded: false,
      bodyHasCollapsed: true,
      stakingHeaderRoundBottom: false,
      maxLeveragedApy: 0,
      totalStaked: 0,
      availableFarms: [],
      protocolConfig: null,
      isTotalStakedEstimated: false,
      isAvailableEstimated: false,
      lpBalances: {},
      boostApy: null,
      ggpCollectedTooltip: 'GGP collected from the Gogopool incentives program for DeltaPrime. Incentives are sent weekly to your wallet.'
    };
  },
  async mounted() {
    this.chain = window.chain;
    this.watchExternalAssetBalanceUpdate();
    this.watchExternalTotalStakedUpdate();
    this.watchAssetBalancesDataRefreshEvent();
    this.watchFarmRefreshEvent();
  },
  computed: {
    ...mapState('fundsStore', ['smartLoanContract', 'noSmartLoan', "wombatLpBalances", 'assetBalances', 'wombatYYFarmsBalances', 'assets', 'apys']),
    ...mapState('poolStore', ['pools']),
    ...mapState('serviceRegistry', ['assetBalancesExternalUpdateService', 'stakedExternalUpdateService', 'dataRefreshEventService', 'farmService', 'ltipService', 'accountService', 'ggpIncentivesService']),
    asset() {
      return config.ASSETS_CONFIG[this.assetSymbol] ? config.ASSETS_CONFIG[this.assetSymbol] : config.LP_ASSETS_CONFIG[this.assetSymbol];
    },

    maxApyTooltip() {
      return `The APY if you would borrow the lowest-interest asset from 100% to 10%, and put your total value into this farm.`;
    },
    minApyTooltip() {
      return `The APY of the farm.`;
    }
  },

  methods: {
    toggleExpanded() {
      if (!this.tableBodyExpanded) {
        this.tableBodyExpanded = true;
        this.bodyHasCollapsed = false;
        this.stakingHeaderRoundBottom = false;
      } else {
        this.tableBodyExpanded = false;
        setTimeout(() => {
          this.bodyHasCollapsed = true;
        }, 200);
        setTimeout(() => {
          this.stakingHeaderRoundBottom = true;
        }, 180);
      }
    },

    async setupMaxStakingApy() {
      let maxApy = this.apys[this.farm.lpAssetToken][this.farm.apyKey] / 100;

      let assetApr = this.assets[this.farm.assetToken].apy && this.assets[this.farm.assetToken].symbol !== 'GLP' ? this.assets[this.farm.assetToken].apy / 100 : 0;
      this.maxLeveragedApy = calculateMaxApy(this.pools, maxApy + assetApr);
    },

    protocolLogo(protocol) {
      return config.PROTOCOLS_CONFIG[protocol].logo;
    },

    stakedChange() {
      this.isTotalStakedEstimated = false;
    },

    setupAvailable() {
      this.available = {
        assetToken: this.assetBalances[this.farm.assetToken],
        lpAssetToken: this.wombatLpBalances[this.farm.lpAssetToken],
      }
    },

    watchExternalAssetBalanceUpdate() {
      this.assetBalancesExternalUpdateService.observeExternalAssetBalanceUpdate().subscribe((updateEvent) => {
        this.setupAvailable();
        this.$forceUpdate();
      });
    },

    watchExternalTotalStakedUpdate() {
      this.stakedExternalUpdateService.observeExternalTotalStakedUpdate().subscribe((updateEvent) => {
        if (updateEvent.assetSymbol === this.asset.symbol) {
          this.isTotalStakedEstimated = !updateEvent.isTrueData;
          if (updateEvent.action === 'STAKE') {
            this.totalStaked = Number(this.totalStaked) + Number(updateEvent.stakedChange);
          } else if (updateEvent.action === 'UNSTAKE') {
            this.totalStaked = Number(this.totalStaked) - Number(updateEvent.stakedChange);
          }
          this.$forceUpdate();
        }
      });
    },

    watchAssetBalancesDataRefreshEvent() {
      this.dataRefreshEventService.assetBalancesDataRefreshEvent$.subscribe((refreshEvent) => {
        this.isAvailableEstimated = false;
        this.setupAvailable();
        this.$forceUpdate();
      });
    },

    watchFarmRefreshEvent() {
      this.farmService.observeRefreshFarm().subscribe(async () => {
        this.totalStaked = this.availableFarms.reduce((acc, farm) => acc + parseFloat(farm.totalStaked), 0);
        await this.setupMaxStakingApy();
      });
    },
  },
  watch: {
    noSmartLoan: {
      handler(noSmartLoan) {
        if (noSmartLoan === false) {
        }
      },
    }
  },
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.staking-asset-component {
  display: flex;
  flex-direction: column;
  width: 100%;
  margin-bottom: 30px;

  .staking-asset {
    display: flex;
    flex-direction: column;
    width: 100%;
    border-radius: 34px;
    border: 2px solid var(--staking-asset-beta__border-color);

    .staking-asset__header {
      cursor: pointer;
      display: grid;
      grid-template-columns: 22% 1fr 195px 210px 170px 180px 80px;
      height: 60px;
      padding: 0 24px;
      background-color: var(--staking-asset-beta__header-background);
      border-top-left-radius: 32px;
      border-top-right-radius: 32px;
      border-bottom: 2px solid var(--staking-asset-beta__border-color);
      box-sizing: content-box;

      &.body-collapsed {
        border-color: transparent;
        border-radius: 32px;
      }

      &.round-bottom {
        border-radius: 32px;
      }

      .header__cell {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: flex-end;

        &.cell__asset {
          justify-content: flex-start;
        }

        &.max-apr {
          .stars-icon {
            width: 20px;
            margin-right: 10px;
            transform: translateY(-2px);
          }
        }

        .header__cell__label {
          display: flex;
          color: var(--staking-asset-beta__header-cell-label-color);
          font-weight: 500;
          margin-right: 5px;
        }

        .header__cell__value {
          font-weight: 500;
        }

        &.cell__max-apy {
          .header__cell__value {
            font-weight: 600;
          }
        }

        &.cell__available {
          width: 230px;
        }

        .asset {
          display: flex;
          flex-direction: row;
          align-items: center;

          .asset__icon {
            width: 22px;
            height: 22px;
            opacity: var(--asset-table-row__icon-opacity);

            &.asset__icon--double {
              margin-right: 20px;
            }
          }

          .asset__info {
            margin-left: 10px;

            .asset__name {
              font-size: $font-size-xsm;
              font-weight: 600;
            }

            .asset__dex {
              font-size: $font-size-xxs;
              color: var(--staking-asset-beta__asset-dex-color);
            }
          }
        }

        .protocols-list {
          display: flex;
          flex-direction: row;

          .protocol__icon {
            opacity: var(--staking-asset-beta__protocol-icon-opacity);
            height: 19px;
            width: 19px;
            border-radius: 50%;

            &:not(:last-child) {
              margin-right: 3px;
            }
          }
        }

        &.cell__action {
          .chevron {
            background: var(--staking-asset-beta__cell-action-chevron-color);
            transition: transform 200ms ease-in-out;

            &:hover {
              background: var(--staking-asset-beta__cell-action-chevron-color--hover);
            }
          }

          &.expanded .chevron {
            transform: rotate(-180deg);
          }
        }
      }
    }

    .staking-protocols {
      height: 0;
      overflow-y: hidden;
      border-bottom-left-radius: 32px;
      border-bottom-right-radius: 32px;
      transition: height 200ms ease-in-out;

      &.expanded {
        height: 233px;
      }

      .compounding__divider {
        background-color: var(--staking-asset-beta__compounding-divider-background);
        display: flex;
        flex-direction: row;
        align-items: center;
        height: 32px;
        padding-left: 26px;
        border-bottom: 2px solid var(--staking-asset-beta__border-color);

        &:not(:first-child) {
          border-top: 2px solid var(--staking-asset-beta__border-color);

        }

        .divider__title {
          display: flex;
          flex-direction: row;
          align-items: center;
          font-size: $font-size-sm;
          font-weight: 500;
          color: var(--staking-asset-beta__divider-title-color);
          margin-right: 6px;
        }
      }

      .protocols__table {
        padding: 24px 20px 0 20px;

        &.protocol__table--no-header {
          padding-top: 0;
        }

        .table__header {
          display: grid;
          grid-template-columns: 23% 1fr 170px 170px 160px 190px 22px;
          padding: 0 6px 9px 6px;

          .table__header__cell {
            display: flex;
            flex-direction: row;
            font-size: $font-size-xsm;
            color: var(--staking-asset-beta__table-header-cell-color);
            font-weight: 500;
            justify-content: flex-end;

            &.asset {
              justify-content: flex-start;
            }

            .info__icon__wrapper {
              transform: translate(3px, -1px);
            }
          }
        }
      }
    }
  }
}

.asset-icon-with-value {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-left: 6px;

  &:not(:last-child) {
    margin-bottom: 6px;
  }

  .asset__icon {
    height: 18px;
    width: 18px;
    margin-right: 6px;
    opacity: var(--asset-table-row__icon-opacity);
  }
}

</style>
