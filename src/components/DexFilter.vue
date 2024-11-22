<template>
  <div class="dex-filter-component">
    <div class="dex-filter" v-if="dexOptions && filterValue">
      <div class="filter__option"
           v-for="option in dexOptions"
           v-on:click="selectOption(option)"
           v-bind:class="{'active': filterValue[option].active}">
        <img class="option__icon" :src="`src/assets/logo/${dexesConfig[option].logo}`">
      </div>
    </div>
  </div>
</template>

<script>
import config from "../config";

export default {
  name: 'DexFilter',
  props: {
    dexOptions: null
  },

  data() {
    return {
      filterValue: null,
      dexesConfig: config.DEX_CONFIG
    }
  },

  methods: {
    setupFilterValue() {
      this.filterValue = {};
      this.dexOptions.forEach(option => {
        this.filterValue[option] = {dex: option, active: true};
      });
    },

    selectOption(option) {
      const allSelected = Object.values(this.filterValue).map(option => option.active).every(o => o);
      if (allSelected) {
        Object.keys(this.filterValue).forEach(dex => {
          this.filterValue[dex].active = false;
        });
        this.filterValue[option].active = true;
      } else {
        this.filterValue[option].active = !this.filterValue[option].active;
        const noneSelected = Object.values(this.filterValue).map(option => option.active).every(o => !o);
        if (noneSelected) {
          this.resetFilter();
        }
      }

      this.$forceUpdate();
      const selectedDexs = Object.values(this.filterValue).filter(option => option.active).map(option => option.dex);
      this.$emit('filterChange', selectedDexs);
    },

    resetFilter() {
      Object.keys(this.filterValue).forEach(dex => {
        this.filterValue[dex].active = true;
      });
      this.$forceUpdate();
      const selectedDexs = Object.values(this.filterValue).filter(option => option.active).map(option => option.dex);
      this.$emit('filterChange', selectedDexs);
    },
  },

  watch: {
    dexOptions: {
      handler() {
        this.setupFilterValue();
      }
    }
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.dex-filter-component {

  .dex-filter {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;

    .filter__option {
      width: 26px;
      height: 26px;
      padding: 2px;
      background-color: white;
      border-radius: 26px;
      filter: grayscale(1);
      margin-right: 8px;
      transition: all 200ms ease-in-out;
      cursor: pointer;

      &:last-child {
        margin-right: 0;
      }

      &:hover {
        filter: grayscale(0.3);
      }

      &.active {
        box-shadow: 1px 2px 5px 0 rgba(191, 188, 255, 0.9);
        filter: grayscale(0);
      }

      .option__icon {
        height: 22px;
        width: 22px;
      }
    }
  }
}

</style>