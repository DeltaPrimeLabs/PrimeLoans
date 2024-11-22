<template>
  <div class="asset-filter-component">
    <div class="asset-filter__group" v-for="(group, index) in assetFilterGroups">
      <div class="asset-filter" v-if="group && group.options && filterValue">
        <div class="filter__option"
             v-for="option in group.options"
             v-on:click="selectOption(group, option)"
             v-bind:class="{'active': filterValue[group.key][option].active}"
             v-tooltip="{content: option, classes: 'info-tooltip'}">
          <img v-if="group.key === 'asset'" class="option__icon" :src="logoSrc(option)">
          <img v-if="group.key === 'dex'" class="option__icon" :src="`src/assets/logo/${dexesConfig[option].logo}`">
        </div>
      </div>
      <div v-if="index !== assetFilterGroups.length - 1" class="filter__separator"></div>
    </div>
    <div class="filter__clear" v-if="!allSelected">
      <button class="clear__button" type="button" v-on:click="resetAll()">
        <img class="clear__icon" src="src/assets/icons/cross.svg">
        <span class="clear__text">Clear all filters</span>
      </button>
    </div>
  </div>
</template>

<script>
import config from '../config';

export default {
  name: 'AssetFilter',
  props: {
    assetOptions: null,
    assetFilterGroups: null,
  },

  data() {
    return {
      dexesConfig: config.DEX_CONFIG,
      filterValue: null,
      allSelected: true,
    };
  },

  methods: {
    setupFilterValue() {
      this.filterValue = {};
      this.assetFilterGroups.forEach((group, index) => {
        this.filterValue[group.key] = {};
        group.options.forEach(option => {
          this.filterValue[group.key][option] = {asset: option, active: true};
        });
      });
    },

    selectOption(group, option) {
      const allSelected = Object.values(this.filterValue[group.key]).map(option => option.active).every(o => o);
      if (allSelected) {
        Object.keys(this.filterValue[group.key]).forEach(o => {
          this.filterValue[group.key][o].active = false;
          this.checkResetButton();
          this.$forceUpdate();
        });
        this.filterValue[group.key][option].active = true;
        this.checkResetButton();
        this.$forceUpdate();
      } else {
        this.filterValue[group.key][option].active = !this.filterValue[group.key][option].active;
        this.$forceUpdate();
        this.checkResetButton();
        const noneSelected = Object.values(this.filterValue[group.key]).map(option => option.active).every(o => !o);
        if (noneSelected) {
          this.resetGroup(group);
        }
      }
      this.emitFilterValue();
    },

    resetGroup(group) {
      Object.keys(this.filterValue[group.key]).forEach(option => {
        this.filterValue[group.key][option].active = true;
        this.checkResetButton();
        this.$forceUpdate();
      });
    },

    resetAll() {
      console.log(this.filterValue);
      this.assetFilterGroups.forEach(group => {
        this.resetGroup(group);
      });
      this.emitFilterValue();
    },

    emitFilterValue() {
      const filterValue = {};
      Object.keys(this.filterValue).forEach(groupKey => {
        filterValue[groupKey] = Object.values(this.filterValue[groupKey]).filter(option => option.active).map(option => option.asset);
      });
      this.$emit('filterChange', filterValue);
    },

    checkResetButton() {
      let allSelectedPerGroup = {};
      Object.keys(this.filterValue).forEach(group => {
        allSelectedPerGroup[group] = Object.keys(this.filterValue[group]).every(option => this.filterValue[group][option].active);
      });
      this.allSelected = Object.keys(allSelectedPerGroup).every(group => allSelectedPerGroup[group]);
    },
  },

  watch: {
    assetFilterGroups: {
      handler() {
        // this.setupFilterValue();
      }
    }
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.asset-filter-component {
  display: flex;
  flex-direction: row;


  .asset-filter__group {
    display: flex;
    flex-direction: row;
    align-items: center;

    .asset-filter {
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

    .filter__separator {
      width: 1.5px;
      height: 17px;
      background-color: $smoke-gray;
      margin: 0 15px;
    }
  }

  .filter__clear {
    display: flex;
    flex-direction: row;
    align-items: center;
    margin-left: 15px;

    .clear__button {
      display: flex;
      flex-direction: row;
      align-items: center;
      padding: 0;
      border: 0;
      margin: 0;
      background-color: transparent;
      cursor: pointer;

      &:hover {
        filter: brightness(0.85);
      }


      .clear__icon {
        width: 14px;
        height: 14px;
        margin-right: 3px;
      }

      .clear__text {
        font-size: $font-size-xsm;
        color: $delta-accent;
        font-weight: 600;
        font-stretch: normal;
        font-style: normal;
        line-height: normal;
        letter-spacing: normal;
      }
    }
  }
}


</style>