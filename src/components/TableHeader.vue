<template>
  <div class="table-header-component" v-if="config">
    <div class="table__header" :style="{'grid-template-columns': config.gridTemplateColumns}">
      <div class="header__cell"
           v-for="headerCell of config.cells"
           :class="headerCell.class">
        <span>{{ headerCell.label }}</span>
        <img v-if="headerCell.tooltip" class="info__icon"
             src="src/assets/icons/info.svg"
             v-tooltip="{content: headerCell.tooltip, placement: 'top', classes: 'info-tooltip'}">
        <div v-if="headerCell.sortable" class="cell__sort" v-on:click="sortClick(headerCell)">
          <img v-if="sortBy !== headerCell.id" src="src/assets/icons/icon_order.svg">
          <img v-if="sortBy === headerCell.id" src="src/assets/icons/icon_order_active.svg" v-bind:class="{'sort-descending': !sortAscending}">
        </div>
      </div>
    </div>
  </div>
</template>

<script>

export default {
  name: 'TableHeader',
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
  border: solid 2px $violet-smoke;
  background-color: $violet-mist;
  height: 34px;
  padding-left: 17px;
  margin-bottom: 5px;

  .header__cell {
    display: flex;
    flex-direction: row;
    align-items: center;
    font-size: $font-size-xsm;
    color: $dark-gray;
    font-weight: 500;

    &.asset {
    }

    &.balance {
      justify-content: flex-end;
    }

    &.loan {
      justify-content: flex-end;
    }

    &.impact {
      justify-content: center;
    }

    &.trend {
      justify-content: center;
    }

    &.price {
      justify-content: flex-end;
    }

    &.apr {
      justify-content: flex-end;
    }

    .info__icon {
      width: 16px;
      height: 16px;
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