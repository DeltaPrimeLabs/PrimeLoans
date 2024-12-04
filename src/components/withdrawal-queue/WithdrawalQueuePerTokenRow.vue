<template>
  <div class="withdraw-queue-per-token-row-component">
    <div class="row">
      <div class="checkbox">
        <Checkbox ref="checkbox" v-on:checkboxChange="selectionChanged" :disabled="entry.isPending"></Checkbox>
<!--        <Checkbox ref="checkbox" v-on:checkboxChange="selectionChanged" :disabled="false"></Checkbox>-->
      </div>
      <div class="amount">
        <div class="double-value staked-balance">
          <div class="double-value__pieces">
            <img v-if="availableToWithdraw < entry.amount"
                 src="src/assets/icons/warning.svg"
                 v-tooltip="{content: `This witdraw will likely fail, available withdrawal amount is less than the intent`, classes: 'info-tooltip long'}">
            {{ formatTokenBalanceWithLessThan(entry.amount, 8) }}
          </div>
          <div class="double-value__usd">{{ entry.amount * assetPrice | usd }}</div>
        </div>
      </div>
      <div>
        <div class="status-label" v-bind:class="statusLabelClasses[entry.isPending ? 'PENDING' : 'READY']">
          {{ statusLabelText[entry.isPending ? 'PENDING' : 'READY'] }}
        </div>
      </div>
      <div>
        <Timer v-if="entry.isPending" v-on:timerEnded="pendingTimerEnded" :date="entry.actionableAt" :status="'PENDING'"></Timer>
        <div v-else class="no-value-dash"></div>
      </div>
      <div>
        <Timer v-if="!entry.isPending" v-on:timerEnded="expiresTimerEnded" :date="entry.expiresAt" :status="'READY'"></Timer>
        <div v-else class="no-value-dash"></div>
      </div>
      <div>
        <FlatButton :active="!entry.isPending" v-on:buttonClick="onWithdrawClick()">withdraw</FlatButton>
      </div>
      <div v-on:click="onCancelClick()">
        <DeltaIcon class="cross-icon" :icon-src="'src/assets/icons/cross.svg'" :size="19"></DeltaIcon>
      </div>
    </div>
  </div>
</template>

<script>
import config from '../../config';
import DeltaIcon from "../DeltaIcon.vue";
import Checkbox from "../Checkbox.vue";
import Timer from "../Timer.vue";
import FlatButton from "../FlatButton.vue";
import { mapState } from "vuex";

export default {
  name: 'WithdrawalQueuePerTokenRow',
  components: {
    FlatButton,
    Timer,
    Checkbox,
    DeltaIcon
  },

  props: {
    assetSymbol: {},
    assetPrice: {},
    entry: {},
    index: {},
    availableToWithdraw: {},
  },

  data() {
    return {
      assets: config.ASSETS_CONFIG,
      statusLabelClasses: {
        PENDING: 'status-label--pending',
        READY: 'status-label--ready',
      },
      statusLabelText: {
        PENDING: 'Pending',
        READY: 'Ready',
      }
    };
  },

  mounted() {
  },

  computed: {
    ...mapState('serviceRegistry', [
      'withdrawQueueService'
    ]),
  },

  methods: {
    selectionChanged(isSelected) {
      this.$emit('selectionChange', isSelected);
    },
    onWithdrawClick() {
      this.withdrawQueueService.executeWithdrawalIntent(this.assetSymbol, [this.entry.id]);
    },

    onCancelClick() {
      console.log('cancel');
      this.withdrawQueueService.cancelWithdrawalIntent(this.assetSymbol, [this.entry.id]);

    },
    selectionFromParentChange(isSelected) {
      this.$refs.checkbox.changeValueWithoutEvent(isSelected)
    },
    pendingTimerEnded() {
      this.entry.isPending = false
    },
    expiresTimerEnded() {
      this.$emit('expired')
    },

    refresh() {
      this.$forceUpdate();
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";

.row {
  display: grid;
  grid-template-columns: var(--withdrawal-queue-per-token-templatecolumns);
  padding: 14px 24px 14px 26px;

  > * {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .amount {
    justify-content: flex-end;
  }

  .checkbox {
    justify-content: unset;
  }
}

.double-value {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  text-align: end;

  .double-value__pieces {
    font-weight: 500;
    font-size: $font-size-xsm;
  }

  &.balance-balance {
    height: 17px;
    margin-bottom: 3px;

    .double-value__pieces {
      font-weight: 600;
    }
  }

  .double-value__usd {
    height: 13px;
    font-size: $font-size-xxs;
    color: var(--staking-protocol-table-row__secondary-text-color);
  }
}

.status-label {
  padding: 4px 10px;
  border-width: 1px;
  border-radius: 7px;
  border-style: solid;

  &--ready {
    background: var(--withdrawal-queue-per-token-row__status-label-background--ready);
    border-color: var(--withdrawal-queue-per-token-row__status-label-border--ready);
    color: var(--withdrawal-queue-per-token-row__status-label-color--ready);
  }

  &--pending {
    color: var(--withdrawal-queue-per-token-row__status-label-color--pending);
    background: var(--withdrawal-queue-per-token-row__status-label-background--pending);
    border-color: var(--withdrawal-queue-per-token-row__status-label-border--pending);
  }
}

.no-value-dash {
  height: 1px;
  width: 15px;
  background-color: var(--withdrawal-queue-per-token-row__no-value-dash-background);
}

.cross-icon {
  background: var(--withdrawal-queue-per-token-row__cross-icon-background);
  cursor: pointer;
}
</style>
