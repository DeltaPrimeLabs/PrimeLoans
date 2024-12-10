<template>
  <div class="wrapper">
    <div class="range">
      <img class="shadow" src="src/assets/images/percentage-gauge-range-mini-mini.svg" alt="">
      <img class="bull-sign" src="src/assets/images/bull-sign.svg" alt="">
      <div ref="rangeMask" class="range__mask"></div>
      <div class="gauge-hand"
           v-bind:style="{'transform': `rotate(${gaugeHandRotation}deg)`}"
      >
        <div class="gauge-hand__pointer"></div>
      </div>
      <div class="center"></div>
    </div>
    <div class="value" v-bind:style="{color: valueColor}">
      {{ smartRound(percentageValue, 2) }}%
    </div>
  </div>
</template>

<script>

import { getThemeVariable } from "../../utils/style-themes";
import { smartRound } from "../../utils/calculate";

export default {
  name: 'MiniPercentageGauge',
  props: {
    percentageValue: null
  },
  data() {
    return {
      gaugeHandRotation: 0,
      valueColor: getThemeVariable('--mini-percentage-gauge__gradient-color-5'),
    }
  },
  mounted() {
    this.$refs.rangeMask.style.webkitMaskImage = 'url(src/assets/images/percentage-gauge-range-mini.svg)';
    this.$refs.rangeMask.style.maskImage = 'url(src/assets/images/percentage-gauge-range-mini.svg)';
    this.calculateValueColor(this.percentageValue)
  },
  methods: {
    smartRound,
    calculateValueColor(value) {
      this.gaugeHandRotation = ((value + 100) / 2) * 1.7 + 270
      const breakpoints = [0, 0.12, 0.26, 0.37, 0.5, 0.63]
      const percentage = (value + 100) / 200
      console.log(value);
      console.log(percentage);
      console.log(breakpoints.findLastIndex(breakpoint => breakpoint <= percentage));
      this.valueColor = getThemeVariable(`--mini-percentage-gauge__gradient-color-${breakpoints.findLastIndex(breakpoint => breakpoint <= percentage) + 1}`)
    }
  },
  watch: {
    percentageValue: function (newValue) {
      this.calculateValueColor(newValue)
    }
  }
}
</script>

<style scoped lang="scss">
.wrapper {
  position: relative;
  width: 80px;
  height: 70px;
}

.range__mask {
  position: absolute;
  inset: 0;
  background: conic-gradient(from -0.33turn, var(--mini-percentage-gauge__gradient-color-1), var(--mini-percentage-gauge__gradient-color-2) 0.13turn, var(--mini-percentage-gauge__gradient-color-3) 0.26turn, var(--mini-percentage-gauge__gradient-color-4) 0.37turn, var(--mini-percentage-gauge__gradient-color-5) 0.5turn, var(--mini-percentage-gauge__gradient-color-6) 0.63turn, var(--mini-percentage-gauge__gradient-color-7));
}

.range {
  position: relative;
  width: 73px;
  height: 43px;
}

.range__mask {
  mask-size: contain;
  -webkit-mask-size: contain;
  mask-repeat: no-repeat;
  -webkit-mask-repeat: no-repeat;
  mask-position: center;
  -webkit-mask-position: center;
}

.shadow {
  filter: var(--mini-percentage-gauge__shadow);
}

.gauge-hand {
  height: 38.5px;
  width: 2px;
  position: absolute;
  left: calc(50% - 1px);
  top: 0px;
  transform-origin: bottom;

  &__pointer {
    height: 10.5px;
    width: 2px;
    background: var(--mini-percentage-gauge__indicator-color);
    box-shadow: var(--mini-percentage-gauge__indicator-shadow);
    border-radius: 99px;
  }
}

.value {
  font-size: 17px;
  font-weight: bold;
  display: flex;
  justify-content: center;
  line-height: 0.8;
}

.bull-sign {
  position: absolute;
  left: 50%;
  bottom: 4px;
  transform: translateX(-50%);
}
</style>
