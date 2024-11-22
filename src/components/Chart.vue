<script>
  import Chart from 'chart.js'
  import { generateChart } from 'vue-chartjs'

  Chart.defaults.LineWithLine = Chart.defaults.line;
  Chart.controllers.LineWithLine = Chart.controllers.line.extend({
    draw: function(ease) {
      Chart.controllers.line.prototype.draw.call(this, ease);

      if (this.chart.tooltip._active && this.chart.tooltip._active.length) {
        var activePoint = this.chart.tooltip._active[0],
        ctx = this.chart.ctx,
        x = activePoint.tooltipPosition().x,
        y = activePoint.tooltipPosition().y,
        topY = this.chart.scales['y-axis-0'].top,
        bottomY = this.chart.scales['y-axis-0'].bottom;

         // draw line
         ctx.save();
         ctx.beginPath();
         ctx.moveTo(x, topY);
         ctx.lineTo(x, bottomY);
         ctx.lineWidth = 1.5;
         ctx.strokeStyle = '#b9b7ff';
         ctx.stroke();

        // draw point
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.strokeStyle = '#6b70ed';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      }
   }
  })

  const CustomLine = generateChart('custom-line', 'LineWithLine')

  export default {
    name: 'Chart',
    extends: CustomLine,
    props: {
      dataPoints: {
        type: Array,
        default: () => [],
      },
      dateFormat: {
        default: 'HH:mm DD/MM/YYYY'
      },
      currencySymbol: {
        default: '$',
        type: String
      },
      minY: 0,
      maxY: null,
      height: null,
      width: null,
      lineWidth: null,
      stepped: false,
      positiveChange: false,
    },
    data() {
      return {
      }
    },
    mounted() {
      this.renderChart(this.chartData, this.options);
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
              steppedLine: this.stepped,
              data: this.dataPoints,
              borderColor: this.positiveChange ? '#00bf68' : '#f64254',
              borderWidth: this.lineWidth
            }
          ]
        };
      },
      options() {
        return {
          aspectRatio: this.isMobile ? 2 : 4,
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
              type: 'time',
              time: {
                displayFormats: {
                  day: 'MMM DD',
                  hour: 'MMM DD',
                  minute: 'MMM DD',
                }
              },
              gridLines: {
                drawOnChartArea: false,
                tickMarkLength: 0,
                lineWidth: 0,
              },
              ticks: {
                backdropPadding: 10,
                beginAtZero: true,
                maxTicksLimit: 1,
                maxRotation: 0,
                minRotation: 0,
                padding: 15,
                fontFamily: 'Montserrat'
              }
            }],
            yAxes: [{
              gridLines: {
                lineWidth: 2,
                zeroLineWidth: 0.5,
                borderDash: [8, 4],
                drawOnChartArea: true,
                tickMarkLength: 0,
                drawBorder: false
              },
              ticks: {
                display: true,
                maxTicksLimit: 1,
                min: this.minY,
                max: this.maxY + 0.01 * this.maxY,
                fontFamily: 'Montserrat',
                padding: 10,
              }
            }]
          } ,
          tooltips: {
            enabled: true,
            intersect: false,
            mode: "index",
            backgroundColor: '#6b70ed',
            titleFontFamily: 'Montserrat',
            bodyFontFamily: 'Montserrat',
            displayColors: false,
            caretPadding: 6,
            callbacks: {
              label: (tooltipItem, data) => {
                var label = data.datasets[tooltipItem.datasetIndex].label || '';

                if (label) {
                  label += ': ';
                }
                label += tooltipItem.yLabel.toPrecision(6);
                return this.currencySymbol + label;
              }
            }
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
    methods: {
    }
  }
</script>

<style lang="scss" scoped>
canvas {
  width: 100% !important;
  height: unset !important;
}
</style>

