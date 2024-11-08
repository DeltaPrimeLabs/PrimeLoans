<template>
  <div class="wrapper">
    <div ref="x" class="number">
      <div ref="text" class="number__text">
        {{ percentageValue }}%
      </div>
    </div>
    <div class="range">
      <img class="shadow" src="src/assets/images/percentage-gauge-range.svg" alt="">
      <div ref="rangeMask" class="range__mask"></div>
      <div class="gauge-hand"
           v-bind:style="{'transform': `rotate(${gaugeHandRotation}deg)`}"
      ></div>
      <div class="center"></div>
      <div class="labels">
        <div>
          -100%
        </div>
        <div>
          100%
        </div>
      </div>
    </div>
  </div>
</template>

<script>

export default {
  name: 'PercentageGauge',
  props: {
    percentageValue: null
  },
  data() {
    return {
      gaugeHandRotation: 0
    }
  },
  mounted() {
    this.$refs.rangeMask.style.webkitMaskImage = 'url(src/assets/images/percentage-gauge-range.svg)';
    this.$refs.rangeMask.style.maskImage = 'url(src/assets/images/percentage-gauge-range.svg)';
    this.calculateIndicatorRotation(this.percentageValue)
  },
  methods: {
    calculateIndicatorRotation(value) {
      this.gaugeHandRotation = ((value + 100) / 2) * 2.25 + 247.5
      const radians = (90 - this.gaugeHandRotation) * (Math.PI / 180);

      const BASE_R = 102.5
      const MAX_ADDED_LENGTH = 120 - 102.5
      const normalizedDegree = this.gaugeHandRotation > 180 ? Math.abs(this.gaugeHandRotation - 360) : this.gaugeHandRotation

      const percentageFromLast90 = normalizedDegree % 90 / 90

      let final

      if (normalizedDegree < 90) {
        final = BASE_R + (percentageFromLast90 * MAX_ADDED_LENGTH)
      } else {
        final = BASE_R + MAX_ADDED_LENGTH - (percentageFromLast90 * MAX_ADDED_LENGTH)
      }

      const x = Math.cos(radians) * final
      const y = Math.sin(radians) * final

      this.$refs.text.style.marginLeft = `calc(50% - ${this.$refs.text.clientWidth / 2}px + ${x}px)`
      this.$refs.text.style.marginTop = `calc(112.5px - ${y}px)`

    }
  },
  watch: {
    percentageValue: function (newValue) {
      this.calculateIndicatorRotation(newValue)
    }
  }
}
</script>

<style scoped lang="scss">
.wrapper {
  position: relative;
  width: 280px;
  height: 200px;
}

.range__mask, .number {
  position: absolute;
  inset: 0;
  background: var(--percentage-gauge__gradient);
}

.range {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 178px;
  height: 131px;
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
  filter: var(--percentage-gauge__shadow);
}

.number {
  font-size: 18px;
  font-weight: bold;
  color: var(--percentage-gauge__number-color);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.number__text {
  display: inline-block;
}

.gauge-hand {
  height: 82px;
  width: 4px;
  position: absolute;
  left: calc(50% - 2px);
  top: 8px;
  background: var(--percentage-gauge__indicator-color);
  box-shadow: var(--percentage-gauge__indicator-shadow);
  border-radius: 99px;
  transform-origin: bottom;
}

.center {
  position: absolute;
  left: 50%;
  top: 78px;
  transform: translateX(-50%);
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--percentage-gauge__indicator-color);
  box-shadow: var(--percentage-gauge__indicator-shadow);
}

.labels {
  display: flex;
  justify-content: space-between;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  font-weight: 500;
  color: var(--percentage-gauge__labels-color);
  bottom: -22px;
  width: 162px;

  div:first-child {
    padding-left: 6px;
  }
}
</style>
