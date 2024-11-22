<template>
  <div v-if="asset" id="modal" class="borrow-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Wrap
      </div>

      <div class="modal-top-info">
        <div class="top-info__label">Native AVAX</div>
        <div class="top-info__value">{{ nativeTokenBalance }}<span class="top-info__currency">AVAX</span></div>
      </div>

      <CurrencyInput ref="currencyInput"
                     :symbol="asset.symbol"
                     :validators="validators"
                     v-on:inputChange="inputChange"
                     v-on:newValue="currencyInputChange"
                     :max="nativeTokenBalance">
      </CurrencyInput>

      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            Values after transaction:
          </div>
          <div class="summary__horizontal__divider"></div>
          <div class="summary__values">
            <div class="summary__label">
              Balance:
            </div>
            <div class="summary__value">
              {{ Number(assetBalance) + Number(value) | smartRound }} {{ asset.symbol }}
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="button-wrapper">
        <Button :label="'Wrap'" v-on:click="submit()" :disabled="currencyInputError"
                :waiting="transactionOngoing"></Button>
      </div>
    </Modal>
  </div>
</template>

<script>
import Modal from './Modal';
import TransactionResultSummaryBeta from './TransactionResultSummaryBeta';
import CurrencyInput from './CurrencyInput';
import Button from './Button';
import BarGaugeBeta from './BarGaugeBeta';

export default {
  name: 'WrapModal',
  components: {
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal,
    BarGaugeBeta
  },

  props: {
    asset: {},
    assetBalance: Number,
    nativeTokenBalance: {}
  },

  data() {
    return {
      value: 0,
      currencyInputError: true,
      transactionOngoing: false,
      validators: [],
    };
  },

  mounted() {

  },

  methods: {
    submit() {
      this.transactionOngoing = true;
      this.$emit('WRAP', this.value);
    },

    inputChange(change) {
      this.value = Number(change);
    },

    currencyInputChange(changeEvent) {
      this.currencyInputError = changeEvent.error;
    },

    setupValidators() {
      this.validators = [
        {
          validate: (value) => {
            if (this.nativeTokenBalance < value) {
              return `Amount exceeds balance`;
            }
          },
        },
      ];
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";


</style>