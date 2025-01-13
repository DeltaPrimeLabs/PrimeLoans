<template>
  <div class="table-header-component" v-if="config">
    <div class="table__header" :style="{'grid-template-columns': config.gridTemplateColumns}">
      <div class="header__cell"
           v-for="headerCell of config.cells"
           :class="headerCell.class">
        <span>{{ headerCell.label }}</span>
        <InfoIcon v-if="headerCell.tooltip" class="info__icon" :tooltip="{content: headerCell.tooltip, placement: 'top', classes: 'info-tooltip'}" :classes="'info-tooltip'" ></InfoIcon>
        <div v-if="headerCell.sortable" class="cell__sort" v-on:click="sortClick(headerCell)">
          <img v-if="sortBy !== headerCell.id" src="src/assets/icons/icon_order.svg">
          <img v-if="sortBy === headerCell.id" src="src/assets/icons/icon_order_active.svg" v-bind:class="{'sort-descending': !sortAscending}">
        </div>
      </div>
    </div>
  </div>
</template>

<script>

import InfoIcon from "./InfoIcon.vue";

export default {
  name: 'TableHeader',
  components: {InfoIcon},
  props: {
    config: null,
    sortBy: null,
    sortAscending: null,
  },

  data() {
    return {
    }
  },

  methods: {
    sortClick(headerCell) {
      if (this.sortBy === headerCell.id) {
        this.sortAscending = !this.sortAscending;
      } else {
        this.sortBy = headerCell.id;
        this.sortAscending = true;
      }
      this.$emit('SORT', {sortBy: headerCell.id, directionAscending: this.sortAscending});
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.table__header {
  display: grid;
  border-radius: 30px;
  border: solid 2px var(--table-header__border-color);
  background-color: var(--table-header__background-color);
  height: 34px;
  padding-left: 17px;
  margin-bottom: 5px;

  .header__cell {
    display: flex;
    flex-direction: row;
    align-items: center;
    font-size: $font-size-xsm;
    color: var(--table-header__cell-color);
    font-weight: 500;

    &.asset {
    }

    &.balance, &.composition, &.staked, &.lp-balance, &.ggp-collected {
      justify-content: flex-end;
    }

    &.farmed {
      justify-content: flex-end;
    }

    &.loan {
      justify-content: flex-end;
    }

    &.rewards {
      justify-content: flex-end;
    }

    &.impact {
      justify-content: center;
    }

    &.trend {
      justify-content: center;
    }

    &.trend-level, &.rewards {
      justify-content: flex-end;
    }

    &.capacity {
      justify-content: flex-end;
    }

    //TODO: just make a flex-end class
    &.price {
      justify-content: flex-end;
    }

    &.apr {
      justify-content: flex-end;
    }

    &.deposit {
      justify-content: flex-end;
    }

    &.sprime {
      justify-content: flex-end;
    }

    &.apy {
      justify-content: flex-end;
    }

    &.interest {
      justify-content: center;
      margin-left: 40px;
    }

    &.tvl {
      justify-content: flex-end;
    }

    &.unlocked {
      justify-content: flex-end;
    }

    &.utilisation {
      justify-content: flex-end;
    }

    &.actions {
      justify-content: flex-end;
      padding-right: 22px;
    }

    &.date {
      justify-content: flex-start;
    }

    &.action {
      justify-content: flex-start;
    }

    &.amount {
      justify-content: flex-end;
      padding-right: 22px;
    }

    &.incentives-earned {
      justify-content: flex-end;
      padding-right: 22px;
    }

    &.justify-content-flex-start {
      justify-content: flex-start;
    }

    &.justify-content-center {
      justify-content: center;
    }

    &.justify-content-flex-end {
      justify-content: flex-end;
    }

    .info__icon {
      margin-left: 5px;
    }

    .cell__sort {
      cursor: pointer;
      margin-left: 8px;
      width: 11px;
      height: 20px;
      user-select: none;

      .sort-descending {
        transform: rotate(180deg);
      }
    }
  }
}

</style>
