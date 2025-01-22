<template>
  <StatsSection>
    <div class="ltip-leader-board-component">
      <StatsSectionHeader>
        LTIPP leaderboard
      </StatsSectionHeader>

      <div class="leader-board" v-if="showTable">
        <TableHeader :config="leaderBoardTableHeaderConfig"></TableHeader>
        <div class="leader-board-table">
          <div class="leader-board-row" v-for="(entry, index) of leaderBoardData">
            <div class="leader-board-cell place">{{ index + 1 + ((page - 1) * PAGE_SIZE) | ordinal }}</div>
            <div class="leader-board-cell prime-account">
              <span v-if="!entry.isMe">{{ entry.address | tx(false) }}</span>
              <span v-if="entry.isMe" class="prime-account--you">You</span>
            </div>
            <div class="leader-board-cell eligible-tvl">{{ entry.eligibleTVL | usd }}</div>
            <div class="leader-board-cell incentives-earned">
              {{ entry.earnedIncentives | smartRound(8, true) }}
              <img class="incentives-icon" src="src/assets/logo/arb.png">
            </div>
            <div class="leader-board-cell incentives-earned">
              {{ entry.earnedIncentivesSinceLastDistribution | smartRound(8, true) }}
              <img class="incentives-icon" src="src/assets/logo/arb.png">
            </div>
          </div>
        </div>
        <Paginator :page-size="PAGE_SIZE"
                   v-if="totalLeaderBoardEntries"
                   :start-page="page"
                   :total-elements="totalLeaderBoardEntries"
                   v-on:pageChange="pageChange">
        </Paginator>
      </div>

      <div class="loader-container" v-if="!showTable">
        <VueLoadersBallBeat color="#A6A3FF" scale="1"></VueLoadersBallBeat>
      </div>
    </div>
  </StatsSection>
</template>

<script>


import StatsSection from './StatsSection.vue';
import StatsSectionHeader from './StatsSectionHeader.vue';
import TableHeader from '../TableHeader.vue';
import Paginator from '../Paginator.vue';
import {mapState} from 'vuex';
import {combineLatest, forkJoin} from 'rxjs';

const PAGE_SIZE = 10;

export default {
  name: 'LTIPLeaderBoard',
  components: {Paginator, TableHeader, StatsSectionHeader, StatsSection},
  async mounted() {
    this.setupTableHeader();
    this.accountService.observeSmartLoanContract().subscribe(smartLoanContract => {
      if (smartLoanContract) {
        console.warn(smartLoanContract);
        this.smartLoanContract = smartLoanContract;
      }
    })
    this.watchLtipDataUpdate();
  },
  computed: {
    ...mapState('serviceRegistry', ['accountService', 'ltipService'])
  },
  data() {
    return {
      PAGE_SIZE: PAGE_SIZE,
      leaderBoardTableHeaderConfig: null,
      leaderBoardData: null,
      showTable: false,
      totalLeaderBoardEntries: null,
      page: 0,
      smartLoanContract: null,
      primeAccountsList: null
    }
  },
  methods: {
    setupTableHeader() {
      this.leaderBoardTableHeaderConfig = {
        gridTemplateColumns: '140px 250px 1fr 1fr 2fr',
        cells: [
          {
            label: 'Place',
            sortable: false,
            class: 'place',
            id: 'PLACE',
          },
          {
            label: 'Prime Account',
            sortable: false,
            class: 'prime-account',
            id: 'TRANSACTION_ID',
          },
          {
            label: 'Eligible TVL',
            sortable: false,
            class: 'eligible-tvl',
            id: 'ELIGIBLE_TVL',
          },
          {
            label: 'Incentives earned',
            sortable: false,
            class: 'incentives-earned',
            id: 'INCENTIVES_EARNED',
          },
          {
            label: 'Incentives since last milestone',
            sortable: false,
            class: 'incentives-earned',
            id: 'INCENTIVES_EARNED',
          },
        ]
      };
    },

    setPagedData(page) {
      setTimeout(() => {
        this.$forceUpdate();
        this.leaderBoardData = this.primeAccountsList
          .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
          .map(entry => ({
            address: entry.id,
            earnedIncentives: entry.arbCollected,
            earnedIncentivesSinceLastDistribution: entry.arbCollectedSinceLastMilestone,
            eligibleTVL: entry.eligibleTvl,
            isMe: entry.id.toLowerCase() === this.smartLoanContract.address.toLowerCase(),
          }));
        this.$forceUpdate();
        this.$forceUpdate();
        this.showTable = true;
      })
    },

    pageChange(page) {
      this.page = page;
      this.setPagedData(page);
    },

    watchLtipDataUpdate() {
      combineLatest({
        ltipAccountsData: this.ltipService.observeLtipAccountsData(),
        ltipAccountsDataSinceLastMilestone: this.ltipService.observeLtipAccountsDataSinceLastMilestone()
      }).subscribe(data => {
        if (data.ltipAccountsData && data.ltipAccountsDataSinceLastMilestone) {
          this.primeAccountsList = data.ltipAccountsData.filter(el => el.arbCollected > 0);
          this.primeAccountsList.forEach(entry => {
            const entrySinceLastMilestone = data.ltipAccountsDataSinceLastMilestone.find(el => el.id === entry.id);
            entry.arbCollectedSinceLastMilestone = entrySinceLastMilestone ? entrySinceLastMilestone.arbCollected : 0;
          });
          this.totalLeaderBoardEntries = this.primeAccountsList.length;
          let myIndex = this.primeAccountsList.findIndex(entry => entry.id.toLowerCase() === this.smartLoanContract.address.toLowerCase());

          this.page = Math.max(Math.ceil(myIndex / PAGE_SIZE), 1);
          this.setPagedData(this.page);
        }

      })
    }
  },
  watch: {}
}
</script>

<style scoped lang="scss">
@import "~@/styles/variables";

.ltip-leader-board-component {
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 30px 42px 30px 42px;
}

.leader-board-table {
  .leader-board-row {
    display: grid;
    grid-template-columns: 140px 250px 1fr 1fr 2fr;
    height: 60px;
    border-style: solid;
    border-width: 0 0 2px 0;
    border-image-source: var(--asset-table-row__border);
    border-image-slice: 1;
    margin: 0 22px;

    .leader-board-cell {
      display: flex;
      flex-direction: row;
      align-items: center;

      &.incentives-earned {
        justify-content: flex-end;

        .incentives-icon {
          width: 16px;
          height: 16px;
          margin-left: 10px;
        }
      }
    }
  }
}

.prime-account--you {
  font-weight: 600;
}

.loader-container {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
}

</style>
