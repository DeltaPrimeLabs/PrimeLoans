<template>
  <div class="pools-beta-component">
    <div class="container">
      <div class="main-content">
        <Block :bordered="true">
          <div class="title">Deposit</div>
          <NameValueBadgeBeta :name="'Your deposits'">{{ totalDeposit | usd }}</NameValueBadgeBeta>
          <div class="pools">
            <div class="pools-table">
              <div class="pools-table__header">
                <div class="header__cell asset">Asset</div>
                <div class="header__cell deposit">Deposit</div>
                <div class="header__cell apy">APY</div>
                <div class="header__cell tvl">Pool size</div>
                <div></div>
                <div class="header__cell actions">Actions</div>
              </div>
              <div class="pools-table__body">
                <PoolsTableRowBeta v-for="pool in poolsList" v-bind:key="pool.asset.symbol"
                                   :pool="pool"></PoolsTableRowBeta>
              </div>
            </div>
          </div>
        </Block>
      </div>
    </div>
  </div>
</template>

<script>

import config from '../config';
import Block from './Block';
import NameValueBadgeBeta from './NameValueBadgeBeta';
import PoolsTableRowBeta from './PoolsTableRowBeta';
import redstone from 'redstone-api';
import {fromWei} from '../utils/calculate';
import {mapActions, mapState} from 'vuex';
import {combineLatest} from 'rxjs';

export default {
  name: 'PoolsBeta',
  components: {
    PoolsTableRowBeta,
    Block,
    NameValueBadgeBeta
  },
  async mounted() {
    this.initPools();
    this.watchPools();

    this.initStoresWhenProviderAndAccountCreated();
  },

  data() {
    return {
      totalTVL: 0,
      totalDeposit: 0,
      poolsList: null,
    };
  },
  computed: {
    ...mapState('serviceRegistry', ['providerService', 'accountService', 'poolService']),
  },

  methods: {
    ...mapActions('poolStore', ['poolStoreSetup']),

    initStoresWhenProviderAndAccountCreated() {
      combineLatest([this.providerService.observeProviderCreated(), this.accountService.observeAccountLoaded()])
        .subscribe(async ([provider, account]) => {
          await this.poolStoreSetup();
        });
    },

    setupTotalTVL() {
      let totalTVL = 0;
      this.poolsList.forEach(pool => {
        totalTVL += pool.tvl * pool.assetPrice;
      });
      this.totalTVL = totalTVL;
    },

    setupTotalDeposit() {
      let totalDeposit = 0;
      this.poolsList.forEach(pool => {
        totalDeposit += pool.deposit * pool.assetPrice;
      });
      this.totalDeposit = totalDeposit;
      this.$forceUpdate();
    },

    initPools() {
      const pools = [];
      Object.entries(config.POOLS_CONFIG).forEach(([symbol, pool]) => {
        pools.push({
          asset: {
            symbol: symbol
          }
        });
      });
      this.poolsList = pools;
    },

    watchPools() {
      this.poolService.observePools().subscribe(pools => {
        this.poolsList = pools;
        this.setupTotalTVL();
        this.setupTotalDeposit();
        this.$forceUpdate();
      });
    },

  },
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.pools-beta-component {

  .main-content {
    margin-top: 30px;

    .title {
      font-size: $font-size-xxl;
      font-weight: bold;
      margin-bottom: 31px;
    }

    .pools {
      margin-top: 65px;
      width: 100%;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;

      .pools-table {
        width: 100%;

        .pools-table__header {
          display: grid;
          grid-template-columns: repeat(3, 1fr) 20% 1fr 76px 22px;
          border-style: solid;
          border-width: 0 0 2px 0;
          border-image-source: linear-gradient(to right, #dfe0ff 43%, #ffe1c2 62%, #ffd3e0 79%);
          border-image-slice: 1;
          padding: 0 0 9px 6px;

          .header__cell {
            display: flex;
            flex-direction: row;
            font-size: $font-size-xsm;
            color: $dark-gray;
            font-weight: 500;

            &.asset {
            }

            &.deposit {
              justify-content: flex-end;
            }

            &.apy {
              justify-content: flex-end;
            }

            &.interest {
              justify-content: center;
              margin-left: 40px;
            }

            &.tvl {
              justify-content: flex-end;
            }

            &.actions {
              justify-content: flex-end;
            }

          }
        }

        .loader-container {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
          margin-top: 40px;
        }
      }
    }
  }
}


</style>