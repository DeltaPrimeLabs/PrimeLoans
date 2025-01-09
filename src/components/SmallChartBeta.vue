<script>

import { Line } from 'vue-chartjs'
import {getThemeVariable} from "../utils/style-themes";
import {mapState} from "vuex";

export default {
  name: 'SmallChartBeta',
  extends: Line,
  props: {
    dataPoints: {
      type: Array,
      default: () => [],
    },
    height: null,
    width: null,
    lineWidth: null,
    stepped: 'none',
    isStableCoin: false,
    positiveChange: false,
    forceColor: false,
  },
  data() {
    return {
      gradient: null
    }
  },
  mounted () {
    this.rerenderChart();
    this.themeService.themeChange$.subscribe(() => {
      this.rerenderChart();
    })
  },
  computed: {
    ...mapState('serviceRegistry', [
      'themeService'
    ]),
    minX() {
      return this.dataPoints[0].x;
    },
    maxX() {
      return this.dataPoints.slice(-1)[0].x;
    },
  },
  watch: {
    dataPoints() {
      this.rerenderChart();
    },
    options() {
      this.rerenderChart();
    }
  },
  methods: {
    chartData() {
      return {
        datasets: [
          {
            fill: false,
            data: this.dataPoints,
            borderColor: getThemeVariable(this.forceColor ? '--small-chart-beta__line-forced-color' : this.positiveChange ? '--small-chart-beta__line-color--positive' : '--small-chart-beta__line-color--negative'),
            borderWidth: this.lineWidth,
            pointRadius: 0
          }
        ]
      };
    },
    options() {
      return {
        hover: {
          mode: null
        },
        aspectRatio: this.isStableCoin ? 10 : 1.4,
        height: null,
        width: null,
        legend: {
          display: false
        },
        elements: {
          point:{
            radius: 0
          }
        },
        scales: {
          xAxes: [{
            display: false,
            type: 'time',
            gridLines: {
              drawOnChartArea: false
            },
            ticks: {
              display: false
            }
          }],
          yAxes: [{
            gridLines: {
              zeroLineWidth: 0,
              borderDash: [8, 4],
              drawOnChartArea: false,
              tickMarkLength: 0,
              drawBorder: false,
            },
            ticks: {
              display: false
            }
          }]
        } ,
        tooltips: {
          enabled: false
        }
      }
    },
    rerenderChart() {
      this.renderChart(this.chartData(), this.options());
    }
  }
};
</script>

<style scoped>

</style>
