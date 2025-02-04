<template>
  <div id="modal" v-if="lpToken" class="remove-liquidity-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Unwind Concentrated LP token
      </div>

      <div class="modal-top-info">
        <div class="top-info__label">Available:</div>
        <div class="top-info__value"> {{formatTokenBalance(lpTokenBalance, tokenAvailableDecimals, true)}}</div>
        <span class="top-info__currency">
          {{lpToken.name}}
        </span>
      </div>

      <CurrencyInput :symbol="lpToken.primary"
                     :symbol-secondary="lpToken.secondary"
                     v-on:newValue="inputChange"
                     :validators="validators">
      </CurrencyInput>

      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            Values after transaction:
          </div>
          <div class="summary__horizontal__divider"></div>
          <div class="summary__values">
            <div class="summary__value__pair">
              <div class="summary__label">
                LP token balance:
              </div>
              <div class="summary__value">
                {{ formatTokenBalance(((lpTokenBalance - amount) > 0 ? lpTokenBalance - amount : 0), 10, true) }}
              </div>
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="button-wrapper">
        <Button :label="'Unwind LP token'"
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
import Toggle from './Toggle';
import BarGaugeBeta from './BarGaugeBeta';
import config from '../config';

const ethers = require('ethers');

export default {
  name: 'RemoveLiquidityModal',
  components: {
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal,
    BarGaugeBeta,
    Toggle
  },

  props: {
    lpToken: {},
    lpTokenBalance: Number,
    firstBalance: Number,
    secondBalance: Number,
    tokenAvailableDecimals: Number,
  },

  data() {
    return {
      amount: null,
      validators: [],
      minReceivedFirst: 0,
      minReceivedSecond: 0,
      transactionOngoing: false,
      currencyInputError: true,
    };
  },

  mounted() {
    setTimeout(() => {
      this.setupValidators();
    });
  },

  computed: {
    firstAsset() {
      return config.ASSETS_CONFIG[this.lpToken.primary];
    },
    secondAsset() {
      return config.ASSETS_CONFIG[this.lpToken.secondary];
    },
    minBalanceAfterRemoveFirst() {
      return this.firstBalance + this.minReceivedFirst;
    },
    minBalanceAfterRemoveSecond() {
      return this.secondBalance + this.minReceivedSecond;
    }
  },

  methods: {
    async submit() {
      const lpTokenDecimals = config.CONCENTRATED_LP_ASSETS_CONFIG[this.lpToken.symbol].decimals;
      this.transactionOngoing = true;
      // const minReceivedAmounts = await this.calculateReceivedAmounts(this.amount);
      this.$emit('REMOVE_LIQUIDITY', {
        asset: this.lpToken.symbol,
        amount: Number(this.amount).toFixed(lpTokenDecimals),
        minReceivedFirst: 0,
        minReceivedSecond: 0
      });
    },

    async inputChange(event) {
      this.amount = event.value;
      this.currencyInputError = event.error;
      this.$forceUpdate();
      setTimeout(() => {
        this.$forceUpdate();
      }, 100);
      // await this.calculateReceivedAmounts(this.amount);
    },

    setupValidators() {
      this.validators = [
        {
          validate: (value) => {
            if (value > this.lpTokenBalance) {
              return 'Exceeds account balance';
            }
          }
        }
      ];
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";

.remove-liquidity-modal-component {

}


</style>