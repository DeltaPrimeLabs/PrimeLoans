<template>
  <StatsSection>
    <div style="padding: 30px 40px">
      <StatsSectionHeader style="margin-bottom: 0px">
        Bull Score
      </StatsSectionHeader>
      <div v-if="!allValues" class="loader">
        <VueLoadersBallBeat color="#A6A3FF" scale="2"></VueLoadersBallBeat>
      </div>

      <Dropdown class="bullscore-dropdown" v-if="allValues"
                :options="availableOptions"
                @dropdownSelected="handleDropdownOption"></Dropdown>
      <percentage-gauge v-if="allValues" :percentage-value="valueToShow(selectedOption)"></percentage-gauge>
    </div>
  </StatsSection>
</template>

<script>
import StatsSection from "./StatsSection.vue";
import {mapState} from "vuex";
import StatsSectionHeader from "./StatsSectionHeader.vue";
import PercentageGauge from "./PercentageGauge.vue";
import Dropdown from "../notifi/settings/Dropdown.vue";

export default {
  name: "StatsBullScoreSection",
  components: {Dropdown, PercentageGauge, StatsSectionHeader, StatsSection},
  mounted() {
    this.bullScoreService.allHedgeScores$.subscribe(allBullScores => {
      this.allValues = allBullScores;
      this.availableOptions = [{name: 'Total', value: 'ALL'}]
      for (const bullScoreType in allBullScores) {
        if (bullScoreType !== 'ALL') {
          this.availableOptions.push({name: bullScoreType, value: bullScoreType})
        }
      }
      this.$forceUpdate()
    })
  },
  computed: {
    ...mapState('serviceRegistry', [
      'bullScoreService',
    ]),
  },
  methods: {
    handleDropdownOption(option) {
      this.selectedOption = option.value
      this.$forceUpdate()
    },
    valueToShow(option) {
      return Math.round(this.allValues[option] * 100)
    }
  },
  data() {
    return {
      availableOptions: [{name: 'Total', value: 'ALL'}],
      selectedOption: 'ALL',
      allValues: null,
    }
  },
  watch: {
    smartLoanContract: {
      handler(smartLoanContract) {
        if (smartLoanContract) {
          this.setupData();
        }
      },
    },
  }
}
</script>

<style scoped lang="scss">
@import "~@/styles/variables";

.bullscore-dropdown {
  margin-top: 16px;
}

.loader {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 250px;
}
</style>
