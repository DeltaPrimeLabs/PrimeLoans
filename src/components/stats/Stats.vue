<template>
  <div id="stats-container" class="stats-container">
    <LTIPLeaderBoard v-if="isArbitrum" class="ltip-leaderboard-section"></LTIPLeaderBoard>
    <StatsBullScoreSection class="stats-bull-score-section"></StatsBullScoreSection>
    <StatsChartSection class="stats-chart-section"></StatsChartSection>
    <StatsSharesSection class="stats-shares-section"></StatsSharesSection>
    <TransactionHistory class="transaction-history"></TransactionHistory>
  </div>
</template>

<script>
import PieChart from "./PieChart.vue";
import StatsSection from "./StatsSection.vue";
import StatsSharesSection from "./StatsSharesSection.vue";
import TransactionHistory from '../TransactionHistory';
import StatsChartSection from "./StatsChartSection.vue";
import LTIPLeaderBoard from './LTIPLeaderBoard.vue';
import PercentageGauge from "./PercentageGauge.vue";
import StatsSectionHeader from "./StatsSectionHeader.vue";
import StatsBullScoreSection from "./StatsBullScoreSection.vue";

export default {
  name: "Stats",
  components: {
    StatsBullScoreSection,
    StatsSectionHeader,
    PercentageGauge,
    LTIPLeaderBoard, StatsChartSection, TransactionHistory, StatsSharesSection, StatsSection, PieChart},
  data: () => {
    return {
      isArbitrum: false,
      bullMeterValue: -100
    }
  },
  async mounted() {
    this.isArbitrum = window.chain === 'arbitrum';
  },
}
</script>

<style scoped lang="scss">
.stats-container {
  box-sizing: border-box;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-column-gap: 20px;
  grid-row-gap: 20px;
  width: 100%;
  padding-top: 30px;

  .stats-bull-score-section {
    grid-area: 1 / 2 / 2 / 3;
  }

  .ltip-leaderboard-section {
    grid-area: 2 / 1 / 3 / 4;
  }

  .stats-chart-section {
    grid-area: 3 / 1 / 4 / 4;
    height: 424px;
  }

  .stats-shares-section {
    grid-area: 4 / 1 / 5 / 4;
  }

  .transaction-history {
    grid-area: 5 / 1 / 6 / 4;
  }
}

</style>
