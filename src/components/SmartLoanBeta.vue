<template>
  <div class="smart-loan-beta-component">
    <div class="account-apr-widget-wrapper">
      <AccountAprWidget :accountApr="apr" :no-smart-loan="noSmartLoanInternal"></AccountAprWidget>
    </div>
    <div class="container">
      <StatsBarBeta
          :collateral="noSmartLoanInternal ? 0 : collateral"
          :debt="noSmartLoanInternal ? 0 : debt"
          :health="noSmartLoanInternal ? 1 : health"
          :noSmartLoan="noSmartLoanInternal"
          :healthLoading="healthLoading">
      </StatsBarBeta>

      <WithdrawalQueue v-if="queueData && assetIntents"
                       ref="withdrawalQueue"
                       :all-queues="assetIntents"
                       :pending-count="queueData.totalPending"
                       :ready-count="queueData.totalReady"
                       :soon="queueData.soonestIntent"
                       :mode="'PRIME_ACCOUNT'"
                       class="withdrawal-queue">
      </WithdrawalQueue>

      <SPrimePanel v-if="afterLaunchTime" :is-prime-account="true" :user-address="account" :total-deposits-or-borrows="noSmartLoanInternal ? 0 : debt"></SPrimePanel>

      <InfoBubble v-if="noSmartLoanInternal === false" cacheKey="ACCOUNT-READY">
        Your Prime Account is ready! Now you can borrow,<br>
        provide liquidity and farm on the <b v-on:click="tabChange(1); selectedTabIndex = 1" style="cursor: pointer;">Farms</b>
        page.
      </InfoBubble>
      <InfoBubble v-for="timestamp in liquidationTimestamps" v-bind:key="timestamp"
                  :cacheKey="`LIQUIDATED-${timestamp}`">
        Liquidation bots unwinded part of your positions<br>
        to repay borrowed funds and restore your health. <a href="https://docs.deltaprime.io/protocol/liquidations"
                                                            target="_blank">More</a>.
      </InfoBubble>
      <div class="main-content">
        <Block :bordered="true">
          <Tabs v-on:tabChange="tabChange" :open-tab-index="selectedTabIndex" :arrow="true">
            <Tab ref="tab-0" :title="'Zaps'"
                 :tab-icon="'src/assets/icons/zaps-icon.svg'"
                 :tab-icon-slim="'src/assets/icons/zaps-icon-slim.svg'"
                 :disabled="primeAccountsBlocked"
            >
              <Zaps></Zaps>
            </Tab>
            <Tab ref="tab-1" :title="'Assets'"
                 :tab-icon="'src/assets/icons/assets_on-icon.svg'"
                 :tab-icon-slim="'src/assets/icons/assets-slim.svg'"
                 :disabled="primeAccountsBlocked"
            >
              <Assets></Assets>
            </Tab>
            <Tab ref="tab-2" :title="'LP'"
                 :tab-icon="'src/assets/icons/lp-icon.svg'"
                 :tab-icon-slim="'src/assets/icons/lp-icon-slim.svg'"
                 v-if="showLPTab"
                 :disabled="primeAccountsBlocked"
            >
              <LPTab></LPTab>
            </Tab>
            <Tab ref="tab-3" :title="'Farms'"
                 :tab-icon="'src/assets/icons/plant_on-icon.svg'"
                 :tab-icon-slim="'src/assets/icons/plant-slim.svg'"
                 v-if="showFarmsTab"
                 :disabled="primeAccountsBlocked"
            >
              <Farm></Farm>
            </Tab>
            <Tab ref="tab-4" :title="'Stats'"
                 :tab-icon="'src/assets/icons/stats-icon.svg'"
                 :tab-icon-slim="'src/assets/icons/stats-icon-slim.svg'"
                 :disabled="primeAccountsBlocked"
            >
              <Stats></Stats>
            </Tab>
          </Tabs>
        </Block>
      </div>
    </div>
    <div class="tutorial-video" v-if="videoVisible">
      <div class="tutorial-video__close" v-on:click="closeVideo">
        <img class="close__icon" src="src/assets/icons/cross.svg">
      </div>
      <iframe width="560" height="315" src="https://www.youtube.com/embed/nyRbcSse60o" title="YouTube video player"
              frameborder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowfullscreen></iframe>
    </div>
  </div>
</template>

<script>
import StatsBarBeta from './StatsBarBeta';
import Banner from './Banner';
import Block from './Block';
import Tabs from './Tabs';
import Tab from './Tab';
import Assets from './Assets';
import {mapActions, mapState} from 'vuex';
import Farm from './Farm';
import AccountAprWidget from './AccountAprWidget';
import config from '../config';
import redstone from 'redstone-api';
import {formatUnits} from 'ethers/lib/utils';
import {combineLatest, map} from 'rxjs';
import {fetchLiquidatedEvents} from '../utils/graph';
import InfoBubble from './InfoBubble.vue';
import TransactionHistory from './TransactionHistory';
import Stats from './stats/Stats.vue';
import LPTab from "./LPTab.vue";
import Zaps from "./Zaps.vue";
import LTIPStatsBar from './RTKNStatsBar.vue';
import SPrimePanel from './SPrimePanel.vue';
import WithdrawalQueue from "./withdrawal-queue/WithdrawalQueue.vue";

const TABS = [
  {
    path: 'zaps',
    pathName: 'Prime Account Zaps'
  },
  {
    path: 'assets',
    pathName: 'Prime Account Assets'
  },
  {
    path: 'lp',
    pathName: 'Prime Account LP'
  },
  {
    path: 'farms',
    pathName: 'Prime Account Farms'
  },
  {
    path: 'stats',
    pathName: 'Prime Account Stats'
  },
];

const TUTORIAL_VIDEO_CLOSED_LOCALSTORAGE_KEY = 'TUTORIAL_VIDEO_CLOSED';
const LAUNCH_TIME = 1719853200000;

export default {
  name: 'SmartLoanBeta',
  components: {
    WithdrawalQueue,
    SPrimePanel,
    LTIPStatsBar,
    Zaps,
    LPTab,
    TransactionHistory,
    Stats,
    InfoBubble,
    Farm,
    Assets,
    Block,
    StatsBarBeta,
    Tabs,
    Tab,
    AccountAprWidget,
    Banner
  },
  computed: {
    ...mapState('fundsStore', [
      'assetBalances',
      'debtsPerAsset',
      'assets',
      'lpAssets',
      'lpBalances',
      'concentratedLpAssets',
      'concentratedLpBalances',
      'levelLpAssets',
      'levelLpBalances',
      'gmxV2Assets',
      'gmxV2Balances',
      'balancerLpAssets',
      'balancerLpBalances',
      'penpieLpAssets',
      'penpieLpBalances',
      'wombatLpAssets',
      'wombatLpBalances',
      'wombatYYFarmsBalances',
      'traderJoeV2LpAssets',
      'fullLoanStatus',
      'noSmartLoan',
      'smartLoanContract',
      'accountApr'
    ]),
    ...mapState('stakeStore', ['farms']),
    ...mapState('serviceRegistry', [
      'healthService',
      'aprService',
      'progressBarService',
      'providerService',
      'accountService',
      'poolService',
      'dataRefreshEventService',
      'farmService',
      'collateralService',
      'debtService',
      'ggpIncentivesService',
      'ltipService',
      'paWithdrawQueueService',
      'bullScoreService',
      'priceService',
    ]),
    ...mapState('network', ['account']),
    primeAccountsBlocked() {
      return config.primeAccountsBlocked;
    },
    afterLaunchTime() {
      const now = new Date().getTime();
      return now > LAUNCH_TIME;
    },
  },
  watch: {
    assetBalances: {
      handler(balances) {
        this.assetBalancesChange(balances);
        this.updateLoanStatus(this.fullLoanStatus);
        this.$forceUpdate();
      },
    },
    fullLoanStatus: {
      handler(fullLoanStatus) {
        this.updateLoanStatus(fullLoanStatus);
      },
      immediate: true
    },
    noSmartLoan: {
      handler(noSmartLoan) {
        this.noSmartLoanInternal = noSmartLoan;
        this.updateLoanStatus(this.fullLoanStatus);
        this.$forceUpdate();
      },
      immediate: true
    },
    smartLoanContract: {
      handler(smartLoan) {
        if (smartLoan && smartLoan.address) {
          this.getLiquidatedEvents();
        }
      }
    }
  },
  data() {
    return {
      todayValue: 0,
      yesterdayValue: 0,
      debt: 0,
      totalValue: 0,
      health: 0,
      noSmartLoanInternal: null,
      selectedTabIndex: undefined,
      videoVisible: true,
      apr: null,
      healthLoading: false,
      liquidationTimestamps: [],
      collateral: null,
      showLPTab: Object.keys(config.TRADERJOEV2_LP_ASSETS_CONFIG).length || Object.keys(config.CONCENTRATED_LP_ASSETS_CONFIG).length || Object.keys(config.LP_ASSETS_CONFIG).length,
      showFarmsTab: Object.keys(config.FARMED_TOKENS_CONFIG).length,
      tabsRefs: [],
      isArbitrum: false,
      assetIntents: null,
      queueData: {},
    };
  },

  async mounted() {
    this.isArbitrum = window.chain === 'arbitrum';
    this.setupSelectedTab();
    this.watchHealthRefresh();
    this.watchAprRefresh();
    this.watchCollateral();
    this.watchDebt();
    this.setupVideoVisibility();
    this.initAccountApr();
    this.initStoresWhenProviderAndAccountCreated();
    this.watchAssetIntents();
    this.watchQueueData();
  },
  methods: {
    ...mapActions('fundsStore', ['fundsStoreSetup', 'getAccountApr']),
    ...mapActions('stakeStore', ['stakeStoreSetup']),
    ...mapActions('poolStore', ['poolStoreSetup']),
    ...mapActions('sPrimeStore', ['sPrimeStoreSetup']),

    initStoresWhenProviderAndAccountCreated() {
      combineLatest([this.providerService.observeProviderCreated(), this.accountService.observeAccountLoaded()])
          .subscribe(async ([provider, account]) => {
            this.sPrimeStoreSetup();
            await this.poolStoreSetup();
            await this.fundsStoreSetup();
            await this.stakeStoreSetup();
          });
    },

    initAccountApr() {
      combineLatest([
        this.poolService.observePools(),
        this.farmService.observeRefreshFarm(),
        this.dataRefreshEventService.observeAssetBalancesDataRefresh(),
        this.dataRefreshEventService.observeDebtsPerAssetDataRefresh(),
        this.dataRefreshEventService.observeFullLoanStatusRefresh(),
        this.dataRefreshEventService.observeAssetApysDataRefresh(),
        this.ltipService.observeLtipPrimeAccountEligibleTvl(),
        this.ltipService.observeLtipMaxBoostApy(),
        this.ggpIncentivesService.observeBoostGGPApy$(),
      ])
          .subscribe(async ([,,,,,,eligibleTvl, maxBoostApy]) => {
            await this.getAccountApr({eligibleTvl, maxBoostApy});
          });
    },

    async assetBalancesChange(balances) {
      if (balances && balances.length > 0) {
        let todayValue = 0;
        let yesterdayValue = 0;
        const assets = config.ASSETS_CONFIG;
        const assetSymbols = Object.keys(assets);

        const redstonePriceData = await this.priceService.fetchPrices()

        const yesterdayPrices = await redstone.getHistoricalPrice(assetSymbols, {date: Date.now() - 1000 * 3600 * 24});
        assetSymbols.forEach((symbol, index) => {
          if (balances[index]) {
            const balance = formatUnits(balances[index].balance, config.ASSETS_CONFIG[symbol].decimals);
            todayValue += balance * (redstonePriceData[symbol] ? redstonePriceData[symbol][0].dataPoints[0].value : 0);
            yesterdayValue += balance * yesterdayPrices[symbol].value;
          }
        });

        this.todayValue = todayValue;
        this.yesterdayValue = yesterdayValue;
      }
    },

    updateLoanStatus(fullLoanStatus) {
      if (fullLoanStatus) {
        this.totalValue = fullLoanStatus.totalValue;
      }
      this.$forceUpdate();
    },

    setupSelectedTab() {
      const url = document.location.href;
      const lastUrlPart = url.split('/').reverse()[0];
      if (!TABS.some(tab => tab.path === lastUrlPart)) {
        this.$router.push({name: TABS[0].pathName, query: this.extractQueryParams(url)});
      } else {
        const pathIndexFromRoute = TABS.findIndex(tab => tab.path === lastUrlPart)
        let tabIndex = Object.keys(this.$refs).findIndex(key => key === `tab-${pathIndexFromRoute}`)
        tabIndex = Math.max(0, tabIndex)
        this.selectedTabIndex = tabIndex
      }
    },

    extractQueryParams(url) {
      let params = url.split('?').reverse()[0].split('=');
      let query = {};

      if (params) {
        query[params[0]] = params[1];
      }

      return query;
    },

    getLiquidatedEvents() {
      fetchLiquidatedEvents(this.smartLoanContract.address).then(
          events => {
            if (events) {
              this.liquidationTimestamps = events.map(event => event.timestamp);
            }
          }
      );
    },

    tabChange(tabIndex) {
      const url = document.location.href;
      const pathIndex = Number(Object.entries(this.$refs)[tabIndex][0].replace('tab-', ''))
      this.$router.push({name: TABS[pathIndex].pathName, query: this.extractQueryParams(url)});
    },

    watchHealthRefresh() {
      this.healthService.observeRefreshHealth().subscribe(async () => {
        this.healthLoading = true;

        const healthCalculatedDirectly = await this.healthService.calculateHealth(
            this.noSmartLoanInternal,
            this.debtsPerAsset,
            this.assets,
            this.assetBalances,
            this.lpAssets,
            this.lpBalances,
            this.concentratedLpAssets,
            this.concentratedLpBalances,
            this.balancerLpAssets,
            this.balancerLpBalances,
            this.levelLpAssets,
            this.levelLpBalances,
            this.gmxV2Assets,
            this.gmxV2Balances,
            this.penpieLpAssets,
            this.penpieLpBalances,
            this.wombatLpAssets,
            this.wombatLpBalances,
            this.wombatYYFarmsBalances,
            this.traderJoeV2LpAssets,
            this.farms,
        );
        this.health = healthCalculatedDirectly;
        this.healthLoading = false;
      });
    },

    watchAprRefresh() {
      this.aprService.observeRefreshApr().subscribe(async () => {
        setTimeout(() => {
          this.apr = this.accountApr;
        })
      });
    },

    watchCollateral() {
      this.collateralService.observeCollateral().subscribe(collateral => {
        this.collateral = collateral;
        this.bullScoreService.setCollateral(collateral)
      });
    },

    watchDebt() {
      this.debtService.observeDebt().subscribe(debt => {
        this.debt = debt;
      });
    },

    closeVideo() {
      this.videoVisible = false;
      window.localStorage.setItem(TUTORIAL_VIDEO_CLOSED_LOCALSTORAGE_KEY, true);
    },

    setupVideoVisibility() {
      const videoWasClosed = window.localStorage.getItem(TUTORIAL_VIDEO_CLOSED_LOCALSTORAGE_KEY);
      this.videoVisible = !videoWasClosed;
    },

    watchAssetIntents() {
      this.paWithdrawQueueService.observeAssetIntents().subscribe(intents => {
        this.assetIntents = intents;
        this.$forceUpdate();
        this.$refs.withdrawalQueue.refresh();
      })
    },

    watchQueueData() {
      this.paWithdrawQueueService.observeQueueData().subscribe(queueData => {
        this.queueData = queueData;
        this.$forceUpdate();
        this.$refs.withdrawalQueue.refresh();
      })
    },
  },
};
</script>

<style lang="scss" scoped>

.smart-loan-beta-component {
  min-height: 1700px;
}

.main-content {
  margin-top: 30px;
  margin-bottom: 60px;
}

.account-apr-widget-wrapper {
  position: absolute;
  left: calc(50% - 111px);
  width: 222px;
  top: 0;
}

.tutorial-video {
  position: fixed;
  border-radius: 25px;
  bottom: 60px;
  right: 20px;
  z-index: 2;

  .tutorial-video__close {
    position: absolute;
    right: 0px;
    top: -35px;
    cursor: pointer;

    .close__icon {
      height: 25px;
      width: 25px;
    }
  }
}

.withdrawal-queue {
  margin-top: 30px;
}
</style>
