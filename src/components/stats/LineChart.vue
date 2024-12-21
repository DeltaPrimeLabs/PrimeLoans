<script>
import {generateChart} from 'vue-chartjs'
import Chart from "chart.js";
import {getThemeVariable} from "../../utils/style-themes";

Chart.defaults.GradientLine = Chart.defaults.line;
Chart.controllers.GradientLine = Chart.controllers.line.extend({
  draw: function (ease) {
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
      ctx.strokeStyle = getThemeVariable('--chart__active-point-line-color');
      ctx.stroke();
    }
    if (this.chart.config.options.showLineAtZeroY) {
      const ctx = this.chart.ctx
      const lineY = this.chart.scales['y-axis-0'].getPixelForValue(0)
      const right = this.chart.scales['x-axis-0'].right;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(30, lineY - 4);
      ctx.lineTo(right, lineY);
      ctx.lineWidth = 1;
      ctx.strokeStyle = getThemeVariable('--chart__active-point-line-color');
      ctx.stroke();
    }
  }
})

const GradientLine = generateChart('gradient-line', 'GradientLine')
const COLOR_PALETTES = {
  LIGHT: [
    {color: '#fa91bf', offset: 1},
    {color: '#babafe', offset: 0.2}
  ],
  DARK: [
    {color: '#7986ff', offset: 0.19},
    {color: '#f06adb', offset: 0.93}
  ]
};
export default {
  name: 'LineChart',
  extends: GradientLine,
  props: {
    chartData: null,
    chartOptions: null,
    theme: null
  },
  methods: {
    rerender() {
      const newData = {...this.chartData}
      newData.datasets[0].borderColor = this.getGradient()
      this.renderChart(this.chartData, this.chartOptions)
    },
    getGradient() {
      const ctx = this.$refs.canvas.getContext('2d')
      const gradient = ctx.createLinearGradient(0, 0, 0, this.chartOptions.height)
      gradient.addColorStop(COLOR_PALETTES[this.theme][0].offset, COLOR_PALETTES[this.theme][0].color)
      gradient.addColorStop(COLOR_PALETTES[this.theme][1].offset, COLOR_PALETTES[this.theme][1].color)
      return gradient
    }
  },
  mounted() {
    this.rerender();
  },
}
</script>

<style scoped>
</style>
