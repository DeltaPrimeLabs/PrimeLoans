<template>
  <div class="range-slider">
    <div class="slider-container">
      <div class="slider-indicator" v-if="indicator" :style="{'left': (indicator - min) * 100 / (max - min) + '%'}"></div>
      <div class="slider-track" :style="trackStyle"></div>
      <div
        ref="slider"
        class="slider-thumb"
        v-for="(thumb, index) in thumbs"
        :key="index"
        :style="thumbStyle(index)"
        @mousedown="startDrag(index)"
      ></div>
    </div>
    <div class="error">
        <span v-if="error">
          <img src="src/assets/icons/error.svg"/>
          {{ error }}
        </span>
    </div>
  </div>
</template>

<script>
export default {
  name: 'RangeSlider',
  props: {
    min: {
      type: Number,
      default: 0
    },
    max: {
      type: Number,
      default: 50
    },
    indicator: null,
    value: {
      type: Array,
      default: [10, 40]
    },
    validators: {
      type: Array, default: () => []
    },
    trackOpacity: 1
  },
  data() {
    return {
      dragging: false,
      thumbs: [0, 1], // Number of thumbs in the slider
      error: '',
      range: []
    };
  },
  computed: {
    trackStyle() {
      const leftThumbValue = this.getThumbValue(0);
      const rightThumbValue = this.getThumbValue(1);
      return {
        left: leftThumbValue + "%",
        width: rightThumbValue - leftThumbValue + "%",
        opacity: this.trackOpacity,
      };
    },
  },
  // mounted() {
  //   console.error(this.$props.indicator);
  //   console.error(this.$props.min);
  //   console.error(this.$props.max);
  // },
  methods: {
    getThumbValue(index) {
      const range = this.max - this.min;
      return ((this.range[index] - this.min) / range) * 100;
    },
    async updateValue(index, newValue) {
      const range = this.max - this.min;
      const percentage = Math.max(0, Math.min(100, (newValue / this.$el.offsetWidth) * 100));
      const newValueInRange = this.min + (range * percentage) / 100;
      const newValueRounded = Math.round(newValueInRange);

      if (index === 0 && newValueRounded > this.range[1]) return;
      if (index === 1 && newValueRounded < this.range[0]) return;

      this.$set(this.value, index, newValueRounded);
    },

    async forceValidationCheck() {
      return this.checkErrors(this.value);
    },

    async checkErrors(newValue) {
      this.error = '';

      for (const validator of [...this.validators]) {
        let validatorResult = await validator.validate(newValue);
        if (validatorResult) {
          this.error = validatorResult;
        }
      }

      return this.error.length > 0;
    },
    thumbStyle(index) {
      return {
        left: this.getThumbValue(index) + "%",
      };
    },
    startDrag(index) {
      this.dragging = index;
      window.addEventListener("mousemove", this.handleDrag);
      window.addEventListener("mouseup", this.endDrag);
    },
    handleDrag(event) {
      if (this.dragging !== false) {
        this.updateValue(this.dragging, event.pageX - this.$el.getBoundingClientRect().left);
      }
    },
    async endDrag() {
      this.dragging = false;
      window.removeEventListener("mousemove", this.handleDrag);
      window.removeEventListener("mouseup", this.endDrag);
      const hasError = await this.checkErrors(this.value);

      this.$emit("input", {
        value: this.value,
        dragging: this.dragging,
        error: hasError
      });
    },
  },
  watch: {
    value: {
      async handler(value) {
        if (value.length != 2) return;
        this.range = [Math.min(Math.max(value[0], this.min), this.max), Math.max(Math.min(value[1], this.max), this.min)];
        const hasError = await this.checkErrors(value);
        this.$emit("input", {
          value: value,
          dragging: this.dragging,
          error: hasError
        });
      },
      immediate: true
    },
  }
};
</script>

<style lang="scss" scoped>

.range-slider {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 100%;

  .slider-container {
    position: relative;
    width: 100%;
    height: 20px;
    border-radius: 10.5px;
    box-shadow: var(--range-slider__container-box-shadow);
    background-color: var(--range-slider__container-box-background);

    .slider-track {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      border-radius: 10.5px;
      background-color: var(--range-slider__slider-track);
      z-index: 1;
    }

    .slider-thumb {
      position: absolute;
      transform: translate(-12px, -2px);
      width: 24px;
      height: 24px;
      border-radius: 50%;
      box-shadow: var(--range-slider__slider-thumb-box-shadow);
      border: var(--range-slider__slider-thumb-border);
      background-color: var(--range-slider__slider-thumb-background);
      cursor: pointer;
      z-index: 2;

      &::after {
        content: "";
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background-color: var(--range-slider__slider-thumb-background);
      }
    }

    .slider-indicator {
      position: absolute;
      height: calc(100% + 8px);
      border-radius: 999px;
      z-index: 2;
      width: 2px;
      top: 50%;
      background: var(--range-slider__indicator-background);
      transform: translate(-50%, -50%);
    }
  }

  .error {
    margin-top: 10px;
    align-self: flex-start;
    color: var(--currency-input__error-color);
  }
}
</style>
