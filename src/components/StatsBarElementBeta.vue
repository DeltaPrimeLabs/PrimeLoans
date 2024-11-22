<template>
  <div class="stats-bar-element-beta-component">
    <div class="stat">
      <div class="stat__label">
        {{ label }}
        <div v-if="infoTooltip" class="stat__info">
          <img class="info__icon"
               src="src/assets/icons/info.svg"
               v-tooltip="{content: infoTooltip, classes: 'info-tooltip'}">
        </div>
      </div>
      <div class="stat__content">
        <div class="stat__extras">
          <slot></slot>
        </div>
        <div class="stat__value" v-bind:class="{'stat__value--zero': value === '0.00%'}">
          <LoadedValue :check="() => value !== null" :value="value"></LoadedValue>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import LoadedValue from './LoadedValue';

export default {
  name: 'StatsBarElementBeta',
  components: {LoadedValue},
  props: {
    label: {
      type: String,
      required: true,
    },
    value: null,
    redIfZero: {
      type: Boolean,
      default: false
    },
    infoTooltip: {}
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.stats-bar-element-beta-component {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  width: 292px;

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    .stat__label {
      display: flex;
      flex-direction: row;
      align-items: center;
      font-size: $font-size-sm;
      font-weight: 500;
      color: $dark-gray;

      .stat__info {
        display: flex;
        flex-direction: row;
        align-items: center;
        margin-left: 5px;
      }
    }

    .stat__content {
      display: flex;
      flex-direction: row;

      .stat__value {
        margin-top: 8px;
        font-size: $font-size-mlg;

        &.stat__value--zero {
          color: $red;
          font-weight: 600;
        }
      }

      .stat__extras {
      }
    }

  }
}
</style>

<style lang="scss">
.info-tooltip {
  max-width: 156px;
}
</style>