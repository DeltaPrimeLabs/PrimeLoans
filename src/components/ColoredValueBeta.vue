<template>
  <div class="colored-value-component">
    <div class="colored-value" v-bind:class="{ positive: value > 0, negative: value < 0 , big: big}" :style="styleObject">
      <div class="plus-sign" v-if="value > 0 && showSign">+</div>
        <LoadedValue :value="!isUndefined ? formattedValue : null"></LoadedValue>
    </div>
  </div>
</template>

<script>
import LoadedValue from "./LoadedValue.vue";

export default {
  name: 'ColoredValueBeta',
  components: {LoadedValue},

  props: {
    formatting: {
      type: String,
      required: true,
    },
    value: {
      type: Number,
      required: true,
    },
    percentageRoundingPrecision: {
      type: Number,
      required: false,
      default: 3,
    },
    showSign: {
      type: Boolean,
      default: false
    },
    big: {
      type: Boolean,
      default: false,
    },
    fontWeight: {
      type: Number,
      default: 400,
    },
    fontSize: {
      type: Number,
      default: 14,
    }
  },
  computed: {
    formattedValue() {
      switch (this.formatting) {
        case 'usd':
          return this.$options.filters.usd(this.value);
        case 'percent':
          return this.$options.filters.percent(this.value, this.percentageRoundingPrecision);
      }
    },
    styleObject() {
      return this.big ? {} : { 'font-weight': this.fontWeight, 'font-size': `${this.fontSize}px` }
    },
    isUndefined() {
      return isNaN(this.value) || this.value == null;
    }
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.colored-value {
  &.positive {
    color: var(--colored-value-beta__color--positive);
  }

  &.negative {
    color: var(--colored-value-beta__color--negative);
  }

  .plus-sign {
    margin-right: -3px;
  }

  &.big {
    font-size: 17px;
    font-weight: 600;
  }
}

</style>

<style lang="scss">
.colored-value {
  display: flex;
  flex-direction: row;
  gap: 5px;

  .loaded-value-component {
    height: 20px;
  }
}
</style>
