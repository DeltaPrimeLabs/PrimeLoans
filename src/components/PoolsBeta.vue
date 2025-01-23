<template>
  <div class="pools-beta-component">
    <div class="container">
      <div class="main-content">
        <SPrimePanel class="sprime-panel" :is-prime-account="false" :user-address="account"
                     :total-deposits-or-borrows="totalDeposit"></SPrimePanel>
        <RTKNStatsBar :data="rtknData" :cross-chain-data="crossChainData">
        </RTKNStatsBar>

        <WithdrawalQueue ref="withdrawalQueue"
                         :all-queues="poolIntents"
                         :pending-count="queueData.totalPending"
                         :ready-count="queueData.totalReady"
                         :soon="queueData.soonestIntent"
                         :mode="'POOLS'">
        </WithdrawalQueue>

        <!--        <WithdrawalQueuePerToken ref="tokenQueue" v-if="poolIntents['MCK']" :asset-symbol="'MCK'" :entries="poolIntents['MCK']"></WithdrawalQueuePerToken>-->
        <Block :bordered="true">
          <div class="title">Savings</div>
          <NameValueBadgeBeta :name="'Your deposits'">
            {{ totalDeposit | usd }}
            <span class="rtkn-balance"
                  v-if="Number(rtknData.rtknBalance) > 0 || Number(rtknData.rtkn2Balance) > 0">Your rTKN balance: {{
                (Number(rtknData.rtknBalance) + Number(rtknData.rtkn2Balance)) | smartRound(2, true)
              }}</span>
          </NameValueBadgeBeta>
          <div class="pools">
            <div class="pools-table">
              <TableHeader :config="poolsTableHeaderConfig"></TableHeader>
              <div class="pools-table__body">
                <PoolsTableRowBeta v-for="pool in poolsList"
                                   v-bind:key="pool.asset.symbol"
                                   v-on:openResumeBridge="openResumeBridgeModal"
                                   :pool="pool"
                                   :depositAssetsWalletBalancesStream="depositAssetsWalletBalances$">
                </PoolsTableRowBeta>
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
import TableHeader from './TableHeader';
import {mapActions, mapState} from 'vuex';
import {BehaviorSubject, combineLatest, forkJoin} from 'rxjs';
import erc20ABI from '../../test/abis/ERC20.json';
import ResumeBridgeModal from './ResumeBridgeModal';
import SPrimePanel from './SPrimePanel.vue';
import RTKNStatsBar from './RTKNStatsBar.vue';
import WithdrawalQueuePerToken from './withdrawal-queue/WithdrawalQueuePerToken.vue';
import WithdrawalQueue from './withdrawal-queue/WithdrawalQueue.vue';
import Vue from 'vue';

const ethers = require('ethers');

let TOKEN_ADDRESSES;

export default {
  name: 'PoolsBeta',
  components: {
    WithdrawalQueue,
    WithdrawalQueuePerToken,
    RTKNStatsBar,
    SPrimePanel,
    PoolsTableRowBeta,
    Block,
    NameValueBadgeBeta,
    TableHeader
  },
  async mounted() {
    window.chain$.subscribe(async chain => {
      this.arbitrumChain = chain === 'arbitrum';
      await this.setupFiles();
      this.initPools();
      this.watchPools();
      this.initStoresWhenProviderAndAccountCreated();
      this.lifiService.setupLifi();
      this.watchActiveRoute();
      this.poolWithdrawQueueService.getIntents();
      this.watchPoolIntents();
      this.watchQueueData();
      this.setupRTKN();
    });
  },

  data() {
    return {
      totalTVL: 0,
      totalDeposit: 0,
      poolsList: null,
      poolsTableHeaderConfig: null,
      depositAssetsWalletBalances$: new BehaviorSubject({}),
      rtknData: {},
      crossChainData: {},
      arbitrumChain: false,
      poolIntents: [],
      queueData: {},
    };
  },
  computed: {
    ...mapState('serviceRegistry', [
      'providerService',
      'accountService',
      'poolService',
      'walletAssetBalancesService',
      'lifiService',
      'progressBarService',
      'avalancheBoostService',
      'rtknService',
      'poolWithdrawQueueService'
    ]),
    ...mapState('network', ['account', 'provider']),
  },

  methods: {
    ...mapActions('poolStore', ['poolStoreSetup', 'deposit']),
    ...mapActions('sPrimeStore', ['sPrimeStoreSetup']),

    async setupFiles() {
      TOKEN_ADDRESSES = await import(`/common/addresses/${window.chain}/token_addresses.json`);
    },

    initStoresWhenProviderAndAccountCreated() {
      combineLatest([this.providerService.observeProvider(), this.accountService.observeAccountLoaded()])
        .subscribe(async ([provider, account]) => {
          this.poolStoreSetup();
          this.sPrimeStoreSetup();
          this.setupPoolsTableHeaderConfig();
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
            symbol: symbol,
          },
          hasAvalancheBoost: pool.hasAvalancheBoost
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
        this.setupWalletDepositAssetBalances(pools);
      });
    },

    watchActiveRoute() {
      combineLatest([this.lifiService.observeLifi(), this.poolService.observePools()])
        .subscribe(async ([lifiData, pools]) => {
          this.lifiData = lifiData;

          const history = JSON.parse(localStorage.getItem('active-bridge-deposit'));
          const activeTransfer = history && history[this.account.toLowerCase()];

          if (activeTransfer) {
            this.openResumeBridgeModal(activeTransfer);
          }
        });
    },

    openResumeBridgeModal(activeTransfer) {
      const modalInstance = this.openModal(ResumeBridgeModal);
      modalInstance.account = this.account;
      modalInstance.activeTransfer = activeTransfer;
      modalInstance.lifiData = this.lifiData;
      modalInstance.lifiService = this.lifiService;
      modalInstance.progressBarService = this.progressBarService;
      modalInstance.depositFunc = this.deposit;
      modalInstance.$on('BRIDGE_DEPOSIT_RESUME', (transferRes) => {
        if (!transferRes) return;
        const pools = this.poolsList.map(pool => {
          return {
            ...pool,
            deposit: pool.asset.symbol === activeTransfer.targetSymbol
              ? Number(pool.deposit) + Number(transferRes.amount)
              : pool.deposit
          };
        });

        this.poolsList = pools;
      });
    },

    setupWalletDepositAssetBalances(pools) {
      const depositAssetsWalletBalances = {};
      combineLatest(
        pools.map(pool => {
            const contract = new ethers.Contract(TOKEN_ADDRESSES[pool.asset.symbol], erc20ABI, this.provider.getSigner());
            return this.getWalletTokenBalance(
              this.account,
              pool.asset.symbol,
              contract,
              config.ASSETS_CONFIG[pool.asset.symbol].decimals
            );
          }
        )
      ).subscribe(walletAssetBalances => {
        walletAssetBalances.forEach((balance, index) => {
          depositAssetsWalletBalances[pools[index].asset.symbol] = balance;
        });
        this.walletAssetBalancesService.emitWalletAssetBalances(depositAssetsWalletBalances);
      });
    },

    setupPoolsTableHeaderConfig() {
      this.poolsTableHeaderConfig =
        window.chain === 'arbitrum' ?
          {
            gridTemplateColumns: 'repeat(3, 1fr) 140px 140px 140px 140px 90px 90px 22px',
            cells: [
              {
                label: 'Asset',
                sortable: false,
                class: 'asset',
                id: 'ASSET',
                tooltip: `The asset name. These names are simplified for a smoother UI.
                                         <a href='https://docs.deltaprime.io/integrations/tokens' target='_blank'>More information</a>.`
              },
              {
                label: 'Deposit',
                sortable: false,
                class: 'deposit',
                id: 'DEPOSIT',
              },
              {
                label: 'sPRIME',
                sortable: false,
                class: 'sprime',
                id: 'SPRIME',
                tooltip: `Your collected sPRIME will be unlocked over a vesting period post TGE.
                <a href='https://medium.com/@Delta_Prime/two-days-until-deltaprimes-first-liquidity-mining-program-b17f12fbb23b' target='_blank'>Read more</a>.
                `
              },
              {
                label: 'APR',
                sortable: false,
                class: 'apy',
                id: 'APY',
                tooltip: `Deposit interest coming from borrowers + the LTIPP grant incentives. Grant incentives are distributed weekly, directly to your wallet.<br><a href='https://forum.arbitrum.foundation/t/deltaprime-ltipp-application-final/21938' target='_blank'>More information</a>.`
              },
              {
                label: 'Pool size',
                sortable: false,
                class: 'tvl',
                id: 'TVL',
              },
              {
                label: 'Unlocked',
                sortable: false,
                class: 'unlocked',
                id: 'UNLOCKED',
                tooltip: `When $1M is hit, a new pool will be unlocked.
                <a href='https://medium.com/@Delta_Prime/relaunching-deltaprime-on-arbitrum-ac43bdd91ed5' target='_blank'>More information</a>.`
              },
              {
                label: 'Utilisation',
                sortable: false,
                class: 'utilisation',
                id: 'UTILISATION',
              },
              {
                label: ''
              },
              {
                label: 'Actions',
                sortable: false,
                class: 'actions',
                id: 'ACTIONS'
              },
            ]
          }
          :
          {
            gridTemplateColumns: '1fr repeat(5, 160px) 70px 110px 22px',
            cells: [
              {
                label: 'Asset',
                sortable: false,
                class: 'asset',
                id: 'ASSET',
                tooltip: `The asset name. These names are simplified for a smoother UI.
                                   <a href='https://docs.deltaprime.io/integrations/tokens' target='_blank'>More information</a>.`
              },
              {
                label: 'Deposit',
                sortable: false,
                class: 'deposit',
                id: 'DEPOSIT',
              },
              {
                label: 'sPRIME',
                sortable: false,
                class: 'sprime',
                id: 'SPRIME',
                tooltip: `Your collected sPRIME will be unlocked over a vesting period post TGE.
                <a href='https://medium.com/@Delta_Prime/two-days-until-deltaprimes-first-liquidity-mining-program-b17f12fbb23b' target='_blank'>Read more</a>.
                `
              },
              {
                label: 'APR',
                sortable: false,
                class: 'apy',
                id: 'APY',
                tooltip: `Deposit interest coming from borrowers${window.arbitrumChain ? ' + the LTIPP grant incentives. Grant incentives are distributed weekly, directly to your wallet.<br><a href=\'https://forum.arbitrum.foundation/t/deltaprime-ltipp-application-final/21938\' target=\'_blank\'>More information</a>' : ''}.`
              },
              {
                label: 'Pool size',
                sortable: false,
                class: 'tvl',
                id: 'TVL',
              },
              {
                label: 'Utilisation',
                sortable: false,
                class: 'utilisation',
                id: 'UTILISATION',
              },
              {
                label: ''
              },
              {
                label: 'Actions',
                sortable: false,
                class: 'actions',
                id: 'ACTIONS'
              },
            ]
          };
    },

    setupRTKN() {
      this.rtknService.observeData().subscribe(data => {
        console.log(data);
        Vue.set(this, 'rtknData', data);
        this.$forceUpdate();
        setTimeout(() => {
          this.$forceUpdate();
        }, 100);
      });

      this.rtknService.observeCrossChainData().subscribe(crossChainData => {
        Vue.set(this, 'crossChainData', crossChainData);
        this.$forceUpdate();
        setTimeout(() => {
          this.$forceUpdate();
        }, 100);
      })
    },

    watchPoolIntents() {
      this.poolWithdrawQueueService.observePoolIntents().subscribe(poolIntents => {
        this.poolIntents = poolIntents;
        this.$forceUpdate();
        this.$refs.withdrawalQueue.refresh();
      })
    },

    watchQueueData() {
      this.poolWithdrawQueueService.observeQueueData().subscribe(queueData => {
        this.queueData = queueData;
        this.$forceUpdate();
        this.$refs.withdrawalQueue.refresh();
      })
    },
  },
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.pools-beta-component {

  .main-content {
    margin-top: 30px;
    margin-bottom: 100px;

    .sprime-panel {
      margin-bottom: 30px;
    }

    .title {
      margin-top: 55px;
      font-size: $font-size-xxl;
      font-weight: bold;
      margin-bottom: 31px;
    }

    .pools {
      width: 100%;
      margin-top: 65px;
      padding: 0 53px;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;

      .pools-table {
        width: 100%;

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

.rtkn-balance {
  border-style: solid;
  border-width: 0 0 0 2px;
  border-image-source: var(--stats-bar-beta__divider-background);
  border-image-slice: 1;
  margin-left: 8px;
  padding-left: 10px;
}


</style>
