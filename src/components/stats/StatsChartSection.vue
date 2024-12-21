<template>
  <StatsSection>
    <div class="stats-chart__section">
      <div v-if="!chartSelectedData" class="loader">
        <VueLoadersBallBeat color="#A6A3FF" scale="2"></VueLoadersBallBeat>
      </div>
      <template v-if="chartSelectedData">
        <div class="toggles">
          <div class="toggle--data">
            <Toggle v-on:change="onOptionChange" :options="['Total Value', 'Collateral', 'Borrowed', 'PnL']"
                    :initial-option="0"></Toggle>
          </div>
          <div class="toggle--metadata">
            <Toggle v-on:change="onPeriodChange" :options="['Max', '7 days', '30 days']"
                    :initial-option="0"></Toggle>
            <div class="toggle-metadata__separator"></div>
            <Toggle v-on:change="onCurrencyChange" :options="['USD']"
                    :initial-option="0"></Toggle>
          </div>
        </div>
        <div v-if="chartSelectedData.length === 0" class="chart__no-data">
          No Data
        </div>
        <div v-else class="stats-chart-section__chart">
          <LineChart ref="chart" :chart-options="this.chartOptions()" :chart-data="this.chartData()"
                     :theme="theme"></LineChart>
        </div>
      </template>
    </div>
  </StatsSection>
</template>

<script>
import LineChart from "./LineChart.vue";
import StatsSection from "./StatsSection.vue";
import {mapState} from "vuex";
import {getThemeVariable} from "../../utils/style-themes";
import Toggle from "../Toggle.vue";

const valuesNameForOptions = {
  'Total Value': 'totalValue',
  'Collateral': 'collateral',
  'Borrowed': 'borrowed',
  'PnL': 'pnl',
}

const valuesNameForPeriod = {
  '7 days': 'weekData',
  '30 days': 'monthData',
  'Max': 'allData',
}

const valuesNameForCurrency = {
  'USD': 'usd',
}

export default {
  name: "StatsChartSection",
  components: {Toggle, StatsSection, LineChart},
  mounted() {
    this.themeService.observeThemeChange().subscribe(theme => {
      this.onThemeChange(theme)
    });
    if (this.smartLoanContract) {
      this.setupData();
    }
  },
  computed: {
    ...mapState('serviceRegistry', [
      'themeService',
      'loanHistoryService'
    ]),
    ...mapState('fundsStore', ['smartLoanContract']),
  },
  methods: {
    setupData() {
      this.loanHistoryService.getLoanHistoryData(this.smartLoanContract.address).then(loanHistory => {
        this.weekData = this.processData(loanHistory.week)
        this.monthData = this.processData(loanHistory.month)
        this.allData = this.processData(loanHistory.all)
        this.updateChartData();
      })
      this.loanHistoryService.getPnLData(this.smartLoanContract.address).then(pnlData => {
        this.pnlData = pnlData
        this.updateChartData();
      })
    },
    processData(data) {
      return {
        totalValue: {
          usd: data.map(historyEntry => historyEntry.totalValue)
        },
        timestamps: data.map(historyEntry => historyEntry.timestamp),
        collateral: {
          usd: data.map(historyEntry => historyEntry.collateral),
        },
        borrowed: {
          usd: data.map(historyEntry => historyEntry.totalValue - historyEntry.collateral),
        },
        events: data.map(historyEntry => historyEntry.events),
      }
    },
    onThemeChange(theme) {
      this.theme = theme;
      if (this.$refs.chart) {
        setTimeout(() => {
          this.$refs.chart.rerender();
        })
      }
    },
    onOptionChange(dataOption) {
      this.selectedOption = valuesNameForOptions[dataOption]
      this.updateChartData()
    },
    onPeriodChange(periodOption) {
      this.selectedPeriod = valuesNameForPeriod[periodOption]
      this.updateChartData()
    },
    onCurrencyChange(currencyOption) {
      this.selectedCurrency = valuesNameForCurrency[currencyOption]
      this.updateChartData()
    },
    updateChartData() {
      if (this.selectedOption === 'pnl') {
        this.chartSelectedData = this.pnlData[this.selectedPeriod].map(({timestamp, pnl}, index) => {
          if (index === 0) {
            this.chartMin = pnl;
            this.chartMax = pnl;
          } else if (this.chartMin > pnl) {
            this.chartMin = pnl
          } else if (this.chartMax < pnl) {
            this.chartMax = pnl
          }
          return {
            x: timestamp,
            y: pnl
          }
        })
      } else {
        const selectedDataset = this[this.selectedPeriod];
        this.chartSelectedData = selectedDataset.timestamps.map((timestamp, index) => {
          const valueForTimestamp = selectedDataset[this.selectedOption][this.selectedCurrency][index];
          if (index === 0) {
            this.chartMin = valueForTimestamp;
            this.chartMax = valueForTimestamp;
          } else if (this.chartMin > valueForTimestamp) {
            this.chartMin = valueForTimestamp
          } else if (this.chartMax < valueForTimestamp) {
            this.chartMax = valueForTimestamp
          }

          return {
            x: timestamp,
            y: valueForTimestamp,
            event: selectedDataset.events[index] && selectedDataset.events[index].length > 0 ? selectedDataset.events[index] : null
          }
        })

        this.chartPointRadius = this.chartSelectedData.map(chartDataEntry => chartDataEntry.event ? 4 : 0)
        this.chartPointHoverBorderWidth = this.chartSelectedData.map(chartDataEntry => chartDataEntry.event ? 3 : 0)
      }
      if (this.chartMin === this.chartMax) {
        this.chartMax += 1
      }
      setTimeout(() => {
        if (this.$refs.chart) {
          this.$refs.chart.rerender();
        }
      })
    },
    // TODO move to service
    formatTokenBalance(value, precision = 5, toFixed = false) {
      const balanceOrderOfMagnitudeExponent = String(value).split('.')[0].length - 1;
      const precisionMultiplierExponent = precision - balanceOrderOfMagnitudeExponent;
      const precisionMultiplier = Math.pow(10, precisionMultiplierExponent >= 0 ? precisionMultiplierExponent : 0);
      if (value !== null) {
        if (!toFixed) {
          return String(Math.round(value * precisionMultiplier) / precisionMultiplier);
        } else {
          return (Math.round(value * precisionMultiplier) / precisionMultiplier).toFixed(precision).replace(/([0-9]+(\.[0-9]+[1-9])?)(\.?0+$)/, '$1');
        }
      } else {
        return '';
      }
    },
    chartOptions() {
      return {
        height: 256,
        width: 960,
        showLineAtZeroY: this.selectedOption === 'pnl',
        hover: {
          intersect: false,
          mode: "index",
          animationDuration: 250
        },
        legend: {
          display: false
        },
        maintainAspectRatio: false,
        responsive: true,
        tooltips: {
          custom: (tooltipData) => {
            if (tooltipData && tooltipData.body && !tooltipData.body[0].lines[0]) {
              // tooltipData.opacity = 0;
            }
          },
          enabled: true,
          intersect: false,
          mode: "index",
          backgroundColor: getThemeVariable('--chart__tooltip-background'),
          titleFontFamily: 'Montserrat',
          titleFontColor: getThemeVariable('--chart__tooltip-color'),
          bodyFontColor: getThemeVariable('--chart__tooltip-color'),
          bodyFontFamily: 'Montserrat',
          displayColors: false,
          caretPadding: 6,
          callbacks: {
            label: (tooltipItem, data) => {
              return `$ ${this.formatTokenBalance(data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index].y)}`
            }
          },
        },
        scales: {
          xAxes: [{
            type: 'time',
            time: {
              displayFormats: {
                day: 'MMM DD',
                hour: 'MMM DD',
                minute: 'MMM DD',
              },
            },
            gridLines: {
              drawOnChartArea: false,
              tickMarkLength: 0,
              lineWidth: 0,
              precision: 4,
              stepSize: 0.001
            },
            ticks: {
              backdropPadding: 10,
              beginAtZero: true,
              maxTicksLimit: 1,
              maxRotation: 0,
              minRotation: 0,
              padding: 15,
              fontFamily: 'Montserrat',
              fontColor: getThemeVariable('--stats-chart-section__axes-text-color'),
              precision: 4,
              stepSize: 0.001
            }
          }],
          yAxes: [{
            gridLines: {
              lineWidth: 2,
              zeroLineWidth: 0.5,
              borderDash: [8, 4],
              drawOnChartArea: true,
              tickMarkLength: 0,
              drawBorder: false,
              color: getThemeVariable('--stats-chart-section__tick-color'),
              precision: 4,
              stepSize: 0.001
            },
            ticks: {
              display: true,
              maxTicksLimit: 1,
              min: this.chartMin,
              max: this.chartMax,
              fontFamily: 'Montserrat',
              padding: 10,
              fontColor: getThemeVariable('--stats-chart-section__axes-text-color'),
              precision: 4,
              stepSize: 0.001
            }
          }]
        },
      }
    },
    chartData() {
      return {
        datasets: [
          {
            fill: false,
            data: this.chartSelectedData,
            borderWidth: 5,
            pointRadius: this.selectedOption === 'pnl' ? 0 : this.chartPointRadius,
            pointHoverRadius: this.chartPointHoverRadius,
            pointBorderWidth: 0,
            pointHoverBorderWidth: this.chartPointHoverBorderWidth,
            pointBorderColor: 'transparent',
            pointBackgroundColor: getThemeVariable('--stats-chart-section__point-color'),
            pointHoverBackgroundColor: 'transparent',
            pointHoverBorderColor: getThemeVariable('--stats-chart-section__point-color'),
          }
        ]
      }
    }
  },
  data() {
    return {
      theme: 'DARK',
      loaded: false,
      timestamps: null,
      chartSelectedData: null,
      chartPointRadius: null,
      chartPointHoverRadius: null,
      chartPointHoverBorderWidth: null,
      chartMin: null,
      chartMax: null,
      collateral: null,
      events: null,
      weekData: null,
      allData: null,
      monthData: null,
      selectedOption: 'totalValue',
      selectedPeriod: 'allData',
      selectedCurrency: 'usd',
      pnlData: null,
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

.stats-chart__section {
  padding: 30px 70px 50px 70px;
}

.stats-chart-section__chart {
  display: flex;
  position: relative;
  width: 960px;
  height: 256px;

  div {
    width: 100%;
  }
}

.stats-chart-section__chart canvas {
  height: 256px !important;
}

.toggles {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 60px;
}

.toggle--metadata {
  display: flex;
  flex-direction: row;
  gap: 16px;
}

.toggle-metadata__separator {
  width: 2px;
  background: var(--stats-chart-section__toggle-metadata-separator-color);
}

.loader {
  width: 100%;
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chart__no-data {
  width: 100%;
  text-align: center;
  font-size: $font-size-mlg;
  color: var(--stats-shares-section__no-data-text-color);
  font-weight: 500;
  margin-top: 30px;
}
</style>
