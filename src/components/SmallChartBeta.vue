<script>

import { Line } from 'vue-chartjs'

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
  },
  data() {
    return {
      gradient: null
    }
  },
  mounted () {
    this.renderChart(this.chartData, this.options)
  },
  computed: {
    minX() {
      return this.dataPoints[0].x;
    },
    maxX() {
      return this.dataPoints.slice(-1)[0].x;
    },
    chartData() {
      return {
        datasets: [
          {
            fill: false,
            data: this.dataPoints,
            borderColor: this.positiveChange ? '#00bf68' : '#f64254',
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
    }
  },
  watch: {
    dataPoints() {
      this.renderChart(this.chartData, this.options);
    },
    options() {
      this.renderChart(this.chartData, this.options);
    }
  },
};
</script>

<style scoped>

</style>