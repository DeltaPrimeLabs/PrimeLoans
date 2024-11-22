<template>
  <div v-if="asset" id="modal" class="unstake-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Unstake
      </div>

      <div class="modal-top-info">
        <div class="top-info__label">APY:</div>
        <div class="top-info__value">{{ apy | percent }}</div>
        <div class="top-info__divider"></div>
        <div class="top-info__label">Staked:</div>
        <div class="top-info__value">{{ staked | smartRound(12, true) }}</div>
      </div>

      <CurrencyInput v-if="isLP"
                     :symbol="asset.primary"
                     :symbol-secondary="asset.secondary"
                     v-on:newValue="unstakeValueChange"
                     :validators="validators"
                     :max="staked">
      </CurrencyInput>
      <CurrencyInput ref="currencyInput"
                     v-else
                     :symbol="asset.symbol"
                     v-on:newValue="unstakeValueChange"
                     :validators="validators"
                     :max="staked">
      </CurrencyInput>


      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            Values after confirmation:
          </div>
          <div class="summary__horizontal__divider"></div>
          <div class="summary__values">
            <div class="summary__label">
              Staked:
            </div>
            <div class="summary__value">
              {{ staked - unstakeValue > 0 ? staked - unstakeValue : 0 | smartRound(8, true) }}
            </div>
            <div class="summary__divider"></div>
            <div class="summary__label">
              Daily interest ≈
            </div>
            <div class="summary__value">
              {{ calculateDailyInterest | smartRound(8, true) }} <span class="currency">&nbsp;{{ asset.name }}</span>
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="button-wrapper">
        <Button :label="'Unstake'"
                v-on:click="submit()"
                :waiting="transactionOngoing"
                :disabled="currencyInputError">
        </Button>
      </div>
    </Modal>
  </div>
</template>

<script>
import Modal from './Modal';
import TransactionResultSummaryBeta from './TransactionResultSummaryBeta';
import CurrencyInput from './CurrencyInput';
import Button from './Button';
import config from '../config';

export default {
  name: 'StakeModal',
  components: {
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal
  },

  props: {
    apy: {},
    available: {},
    staked: {},
    receiptTokenBalance: {},
    asset: {},
    isLp: false,
    protocol: null
  },

  data() {
    return {
      unstakeValue: 0,
      validators: [],
      transactionOngoing: false,
      currencyInputError: true,
    }
  },

  mounted() {
    this.setupValidators();
  },

  computed: {
    calculateDailyInterest() {
      const staked = this.staked - this.unstakeValue;
      if (staked <= 0) {
        return 0;
      } else {
        return this.apy / 365 * staked;
      }
    }
  },

  methods: {
    submit() {
      this.transactionOngoing = true;
      let unstakedPart = this.unstakeValue / this.staked;
      const unstakeValue = this.maxButtonUsed ? this.receiptTokenBalance * config.MAX_BUTTON_MULTIPLIER : unstakedPart * this.receiptTokenBalance;
      const unstakedReceiptToken = Math.min(unstakeValue / this.staked * this.receiptTokenBalance, this.staked)

      const unstakeEvent = {
        receiptTokenUnstaked: unstakeValue,
        underlyingTokenUnstaked: unstakedReceiptToken,
        isMax: this.maxButtonUsed
      };

      this.$emit('UNSTAKE', unstakeEvent);
    },

    unstakeValueChange(event) {
      this.unstakeValue = event.value;
      this.currencyInputError = event.error;
      this.maxButtonUsed = event.maxButtonUsed;
    },

    setupValidators() {
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";
</style>