<template>
  <div class="smart-loan-beta-component">
    <div class="account-apr-widget-wrapper">
      <AccountAprWidget :accountApr="accountApr" :no-smart-loan="noSmartLoanInternal"></AccountAprWidget>
    </div>
    <div class="container">
      <StatsBarBeta
        :collateral="noSmartLoanInternal ? 0 : getCollateral"
        :debt="noSmartLoanInternal ? 0 : debt"
        :health="noSmartLoanInternal ? 1 : health"
        :noSmartLoan="noSmartLoanInternal"
        :healthLoading="healthLoading">
      </StatsBarBeta>
      <InfoBubble v-if="noSmartLoanInternal === false" cacheKey="ACCOUNT-READY" style="margin-top: 40px">
        Your Prime Account is ready! Now you can borrow,<br>
         provide liquidity and farm on the <b v-on:click="tabChange(1); selectedTabIndex = 1" style="cursor: pointer;">Farms</b> page.
      </InfoBubble>
      <InfoBubble v-for="timestamp in liquidationTimestamps" v-bind:key="timestamp" :cacheKey="`LIQUIDATED-${timestamp}`" style="margin-top: 40px">
        Liquidation bots unwinded part of your positions<br>
        to repay borrowed funds and restore your health. <a href="https://docs.deltaprime.io/protocol/liquidations" target="_blank">More</a>.
      </InfoBubble>
      <div class="main-content">
        <Block :bordered="true">
          <Tabs v-on:tabChange="tabChange" :open-tab-index="selectedTabIndex" :arrow="true">
            <Tab :title="'Assets'"
                 :img-active="'src/assets/icons/assets_on.svg'"
                 :img-not-active="'src/assets/icons/assets_off.svg'">
              <Assets></Assets>
            </Tab>
            <Tab :title="'Farms'"
                 :img-active="'src/assets/icons/plant_on.svg'"
                 :img-not-active="'src/assets/icons/plant_off.svg'">
              <Farm></Farm>
            </Tab>
          </Tabs>
        </Block>
      </div>
    </div>
    <div class="tutorial-video" v-if="videoVisible">
      <div class="tutorial-video__close" v-on:click="closeVideo">
        <img class="close__icon" src="src/assets/icons/cross.svg">
      </div>
      <iframe width="560" height="315" src="https://www.youtube.com/embed/nyRbcSse60o" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>    </div>
  </div>
</template>

<script>
import StatsBarBeta from './StatsBarBeta';
import Banner from './Banner';
import Block from './Block';
import Tabs from './Tabs';
import Tab from './Tab';
import Assets from './Assets';
import InfoBubble from "@/components/InfoBubble.vue";
import {mapActions, mapGetters, mapState} from 'vuex';
import Farm from './Farm';
import AccountAprWidget from './AccountAprWidget';
import config from '../config';
import redstone from 'redstone-api';
import {formatUnits} from 'ethers/lib/utils';
import {combineLatest, delay} from 'rxjs';
import {fetchLiquidatedEvents} from "../utils/graph";

const ASSETS_PATH = 'assets';
const FARMS_PATH = 'farms';

const ASSETS_PATH_NAME = 'Prime Account Assets';
const FARMS_PATH_NAME = 'Prime Account Farms';

const TUTORIAL_VIDEO_CLOSED_LOCALSTORAGE_KEY = 'TUTORIAL_VIDEO_CLOSED'

export default {
  name: 'SmartLoanBeta',
  components: {Farm, Assets, Block, StatsBarBeta, Tabs, Tab, InfoBubble, AccountAprWidget, Banner},
  computed: {
    ...mapState('fundsStore', ['assetBalances', 'debtsPerAsset', 'assets', 'lpAssets', 'lpBalances', 'fullLoanStatus', 'noSmartLoan', 'smartLoanContract']),
    ...mapState('stakeStore', ['farms']),
    ...mapState('serviceRegistry', ['healthService', 'aprService', 'progressBarService', 'providerService', 'accountService']),
    ...mapState('network', ['account']),
    ...mapGetters('fundsStore', ['getCollateral', 'getAccountApr']),
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
      selectedTabIndex: 0,
      videoVisible: true,
      accountApr: null,
      healthLoading: false,
      liquidationTimestamps: []
    };
  },

  async mounted() {
    this.setupSelectedTab();
    this.watchHealthRefresh();
    this.watchAprRefresh();
    this.watchProgressBarState();
    this.setupVideoVisibility();

    this.initStoresWhenProviderAndAccountCreated();
  },
  methods: {
    ...mapActions('fundsStore', ['fundsStoreSetup']),
    ...mapActions('poolStore', ['poolStoreSetup']),

    initStoresWhenProviderAndAccountCreated() {
      combineLatest([this.providerService.observeProviderCreated(), this.accountService.observeAccountLoaded()])
        .subscribe(async ([provider, account]) => {
          await this.poolStoreSetup();
          await this.fundsStoreSetup();
        });
    },

    async assetBalancesChange(balances) {
      if (balances && balances.length > 0) {
        let todayValue = 0;
        let yesterdayValue = 0;
        const assets = config.ASSETS_CONFIG;
        const assetSymbols = Object.keys(assets);
        const todayPrices = await redstone.getPrice(assetSymbols);
        const yesterdayPrices = await redstone.getHistoricalPrice(assetSymbols, {date: Date.now() - 1000 * 3600 * 24});
        assetSymbols.forEach((symbol, index) => {
          if (balances[index]) {
            const balance = formatUnits(balances[index].balance, config.ASSETS_CONFIG[symbol].decimals);
            todayValue += balance * todayPrices[symbol].value;
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
        this.debt = fullLoanStatus.debt;
      }
      this.$forceUpdate();
    },

    setupSelectedTab() {
      const url = document.location.href;
      const lastUrlPart = url.split('/').reverse()[0];
      if (lastUrlPart !== ASSETS_PATH && lastUrlPart !== FARMS_PATH) {
        this.$router.push({name: ASSETS_PATH_NAME, query: this.extractQueryParams(url)});
      } else {
        if (lastUrlPart === ASSETS_PATH) {
          this.selectedTabIndex = 0;
        } else if (lastUrlPart === FARMS_PATH) {
          this.selectedTabIndex = 1;
        }
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
      console.log('getLiquidatedEvents')
      // console.log(await fetchLiquidatedEvents(this.smartLoanContract.address).map(event => event.timestamp))
      fetchLiquidatedEvents(this.smartLoanContract.address).then(
          events => {
            this.liquidationTimestamps = events.map(event => event.timestamp);
          }
      )
    },

    tabChange(tabIndex) {
      const url = document.location.href;

      if (tabIndex === 0) {
        this.$router.push({name: ASSETS_PATH_NAME, query: this.extractQueryParams(url)});
      } else if (tabIndex === 1) {
        this.$router.push({name: FARMS_PATH_NAME, query: this.extractQueryParams(url)});
      }
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
          this.farms
        );
        this.health = healthCalculatedDirectly;
        this.healthLoading = false;
        console.log('healthCalculatedDirectly', healthCalculatedDirectly);
      })
    },

    watchAprRefresh() {
      this.aprService.observeRefreshApr().subscribe(async() => {
        console.log('watchAprRefresh');
        this.accountApr = null;
        this.accountApr = await this.getAccountApr;
      });
    },

    watchProgressBarState() {
      this.progressBarService.progressBarState$.subscribe(async (state) => {
        switch (state) {
          case 'MINING' : {
            this.accountApr = null;
            break;
          }
          case 'ERROR' : {
            this.accountApr = await this.getAccountApr;
            break;
          }
          case 'CANCELLED' : {
            this.accountApr = await this.getAccountApr;
            break;
          }
        }
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
  },
};
</script>

<style lang="scss" scoped>

.smart-loan-beta-component {
  min-height: 1700px;
}

.main-content {
  margin-top: 30px;
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
  bottom: 20px;
  right: 20px;

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

</style>