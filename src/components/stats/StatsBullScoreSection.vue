<template>
  <StatsSection>
    <div style="padding: 30px 40px">
      <StatsSectionHeader style="margin-bottom: 0px">
        Bull Score <img src="src/assets/icons/icon_circle_star.svg"
                        v-tooltip="{content: `Enjoy your free trial of this <a href='https://docs.deltaprime.io/protocol/business-model#prime-features' target='_blank'>PRIME Feature</a>!`, classes: 'info-tooltip long'}"/>
      </StatsSectionHeader>
      <div v-if="!allValues" class="loader">
        <VueLoadersBallBeat color="#A6A3FF" scale="2"></VueLoadersBallBeat>
      </div>

      <Dropdown class="bullscore-dropdown" v-if="allValues"
                :options="availableOptions"
                @dropdownSelected="handleDropdownOption"></Dropdown>
      <div class="gauge-wrapper" v-if="allValues">
        <percentage-gauge :percentage-value="valueToShow(selectedOption)" :range="500"></percentage-gauge>
        <InfoIcon :size="24" class="gauge-wrapper__info-icon" :tooltip="{content: selectedOption === 'ALL' ? 'The percentage change of your collateral value if all volatile assets appreciate with 100%; your bullishness on the cryptomarket. This Feature is currently in <b>Beta</b>, and excludes liquidation effects.' : 'The percentage change of your collateral value if the underlying asset appreciates with 100%; your bullishness on this asset. This Feature is currently in <b>Beta</b>, and excludes liquidation effects.'}"></InfoIcon>
      </div>
    </div>
  </StatsSection>
</template>

<script>
import StatsSection from "./StatsSection.vue";
import {mapState} from "vuex";
import StatsSectionHeader from "./StatsSectionHeader.vue";
import PercentageGauge from "./PercentageGauge.vue";
import Dropdown from "../notifi/settings/Dropdown.vue";
import InfoIcon from "../InfoIcon.vue";

export default {
  name: "StatsBullScoreSection",
  components: {InfoIcon, Dropdown, PercentageGauge, StatsSectionHeader, StatsSection},
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

.gauge-wrapper {
  position: relative;
}

.gauge-wrapper__info-icon {
  position: absolute;
  top: 8px;
  right: 0;
}
</style>
