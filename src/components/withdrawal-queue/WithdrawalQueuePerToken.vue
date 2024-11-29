<template>
  <div class="withdraw-queue-per-token-component">
    <div class="accordion" v-bind:class="{'accordion--expanded': isExpanded}">
      <div class="header" v-on:click="toggleExpanded($event)">
        <div v-if="selectedRows.length > 0" class="header__cta">
          <FlatButton :active="true" v-on:buttonClick="withdrawAll()">Withdraw selected</FlatButton>
        </div>
        <div class="asset">
          <img :src="logoSrc(assetSymbol)">
          {{ assetSymbol }}
        </div>
        <div class="summary">
          <div class="summary__label">Total:</div>
          <div class="summary__value">{{ getTotalToken() }} {{ assetSymbol }}</div>
          <div class="summary__additional-info">($ {{ getTotalToken() * assetPrice }})</div>
          <div class="summary__divider"></div>
          <div class="summary__label">Pending:</div>
          <div class="summary__value">{{ getPendingCount() }}</div>
          <div class="summary__divider"></div>
          <div class="summary__label">Ready:</div>
          <div class="summary__value">{{ entries.length - getPendingCount() }}</div>
        </div>
        <div class="arrow">
          <DeltaIcon class="chevron" :icon-src="'src/assets/icons/chevron-down.svg'" :size="21"></DeltaIcon>
        </div>
      </div>
      <div class="body" :style="{height: currentTableHeight}">
        <div class="table-header">
          <div class="checkbox">
            <Checkbox ref="allCheckbox" v-on:checkboxChange="allSelectionChanged"></Checkbox>
          </div>
          <div class="amount">Amount</div>
          <div>Status</div>
          <div>Ready In</div>
          <div>Expires In</div>
          <div>Withdraw</div>
          <div>Cancel</div>
        </div>
        <div class="entries">
          <div class="entry" v-for="(entry, index) in entries">
            <div class="divider"></div>
            <WithdrawalQueuePerTokenRow
              ref="row"
              v-on:selectionChange="rowSelectionChanged(index, $event)"
              v-on:expired="deleteRow(index)"
              :asset-symbol="assetSymbol"
              :entry="entry"
              :asset-price="assetPrice"
              :index="index"
            ></WithdrawalQueuePerTokenRow>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import config from '../../config';
import DeltaIcon from "../DeltaIcon.vue";
import Checkbox from "../Checkbox.vue";
import WithdrawalQueuePerTokenRow from "./WithdrawalQueuePerTokenRow.vue";
import FlatButton from "../FlatButton.vue";
import { mapState } from "vuex";

export default {
  name: 'WithdrawalQueuePerToken',
  components: {
    FlatButton,
    WithdrawalQueuePerTokenRow,
    Checkbox,
    DeltaIcon
  },

  props: {
    assetSymbol: {},
    entries: [],
  },

  data() {
    return {
      currentTableHeight: 0,
      fullTableHeight: 0,
      selectedRows: [],
      isExpanded: false,
      totalValue: 0,
      pendingCount: 0,
      readyCount: 0,
      statusLabelClasses: {
        PENDING: 'status-label--pending',
        READY: 'status-label--ready',
      },
      assetPrice: 0,
      selectedIds: [],
    };
  },

  mounted() {
    this.poolService.observePools().subscribe(pools => {
      this.assetPrice = pools.find(pool => pool.asset.symbol === this.assetSymbol).price
    })
  },

  computed: {
    ...mapState('serviceRegistry', ['poolService', 'withdrawQueueService'])
  },

  methods: {
    getPendingCount() {
      return this.entries.filter(({isPending}) => isPending).length
    },
    getTotalToken() {
      return this.entries.reduce((acc, current) => acc + Number(current.amount), 0)
    },
    deleteRow(index) {
      this.entries.splice(index, 1)
      const newSelectedRows = []
      this.selectedRows.forEach(idx => {
        if (idx !== index) {
          newSelectedRows.push(idx > index ? idx - 1 : idx)
        }
      })
      this.selectedRows = newSelectedRows
      this.currentTableHeight = this.isExpanded ? (this.entries.length * 63 + 53) + 'px' : '0px'
      this.withdrawQueueService.getIntents();
    },
    rowSelectionChanged(index, isSelected) {
      if (isSelected) {
        this.selectedRows.push(index)
      } else {
        this.selectedRows.splice(this.selectedRows.findIndex(idx => idx === index), 1)
      }
      this.$refs.allCheckbox.changeValueWithoutEvent(
          this.selectedRows.length === this.entries.length - this.getPendingCount()
      )

      this.selectedIds = [];
      this.selectedRows.forEach(index => {
        this.selectedIds.push(this.entries[index].id);
      });

      console.log(this.selectedIds);

    },
    toggleExpanded($event) {

      this.isExpanded = !this.isExpanded
      this.currentTableHeight = this.isExpanded ? (this.entries.length * 63 + 53) + 'px' : '0px'
    },
    allSelectionChanged(isSelected) {
      if (!isSelected) {
        this.selectedRows = []
        this.$refs.row.forEach(row => row.selectionFromParentChange(false))
        return
      }
      const rowsToSelect = []
      this.entries.forEach((entry, index) => {
        if (!entry.isPending) {
          rowsToSelect.push(index)
        }
      })
      this.selectedRows = rowsToSelect
      this.selectedRows.forEach(index => this.$refs.row[index].selectionFromParentChange(isSelected))
      console.log(this.selectedRows);

      this.selectedIds = [];
      this.selectedRows.forEach(index => {
        this.selectedIds.push(this.entries[index].id);
      })
      console.log(this.selectedIds);
    },

    withdrawAll() {

      this.withdrawQueueService.executeWithdrawalIntent(this.assetSymbol, this.selectedIds);
    },

    refresh() {
      this.toggleExpanded();
      this.$refs.row.forEach(row => row.refresh())
      setTimeout(() => {
        this.toggleExpanded();
      })
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";

.accordion {
  //--withdrawal-queue-per-token-templatecolumns: 16px 220px 1fr 130px 312px 96px;
  --withdrawal-queue-per-token-templatecolumns: 16px 220px 1fr 99px 257px 191px 55px;

  &--expanded {
    .header {
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
    }

    .chevron {
      transform: rotate(180deg);
    }

    .body {
      border: 2px solid var(--withdrawal-queue-per-token__body-border);
      border-top: none;
    }
  }
}

.header {
  position: relative;
  transition: border-radius 200ms ease-in-out;
  cursor: pointer;
  display: grid;
  grid-template-columns: 1fr 10fr 1fr;
  background: var(--withdrawal-queue-per-token__header-background);
  border: 2px solid var(--withdrawal-queue-per-token__header-border);
  border-radius: 32px;
  padding: 20px 24px 20px 26px;

  &__cta {
    position: absolute;
    right: 70px;
    top: 50%;
    transform: translateY(-50%);
  }
}

.asset {
  font-size: 16px;
  font-weight: bold;
  color: var(--withdrawal-queue-per-token__asset-color);

  img {
    height: 22px;
    width: 22px;
    margin-right: 10px;
  }
}

.summary {
  display: flex;
  flex-direction: row;
  justify-content: center;
  font-size: 16px;
  font-weight: 500;
  gap: 8px;

  &__label {
    color: var(--withdrawal-queue-per-token__summary-label-color);
  }

  &__value {
    color: var(--withdrawal-queue-per-token__summary-value-color);
  }

  &__additional-info {
    color: var(--withdrawal-queue-per-token__summary-additional-info-color);
  }

  &__divider {
    height: 100%;
    width: 2px;
    margin: 0 19px;
    background: var(--withdrawal-queue-per-token__summary-divider-background);
  }
}

.arrow {
  display: flex;
  justify-content: flex-end;
}

.chevron {
  transition: transform 200ms ease-in-out;
  background: var(--withdrawal-queue-per-token__header-chevron-background);
}

.body {
  transition: height 200ms ease-in-out;
  background: var(--withdrawal-queue-per-token__body-background);
  border-bottom-left-radius: 32px;
  border-bottom-right-radius: 32px;
  overflow: hidden;
  border-left: 2px solid transparent;
  border-right: 2px solid transparent;
}

.table-header {
  padding: 25px 26px 8px 26px;
  font-size: 14px;
  font-weight: 500;
  color: var(--withdrawal-queue-per-token__table-header-color);
  display: grid;
  grid-template-columns: var(--withdrawal-queue-per-token-templatecolumns);
  text-align: center;
}

.divider {
  width: 100%;
  height: 2px;
  background: var(--withdrawal-queue-per-token__divider-background);
}

.amount {
  display: flex;
  justify-content: flex-end;
}

</style>
