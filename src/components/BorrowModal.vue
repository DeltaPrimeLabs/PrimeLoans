<template>
  <div v-if="asset" id="modal" class="borrow-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Borrow
      </div>

      <div class="modal-top-info">
        <div class="top-info__label">APY:</div>
        <div class="top-info__value">{{ loanAPY | percent }}</div>
        <div class="top-info__divider"></div>
        <div class="top-info__label">Available in pool:</div>
        <div class="top-info__value">{{ poolTVL | smartRound }}<span class="top-info__currency"> {{
            asset.symbol
          }}</span></div>
      </div>

      <CurrencyInput :symbol="asset.symbol"
                     :validators="validators"
                     v-on:inputChange="inputChange"
                     v-on:newValue="currencyInputChange">
      </CurrencyInput>

      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            Values after transaction:
          </div>
          <div class="summary__horizontal__divider"></div>
          <div class="summary__values">
            <div>
              <div class="summary__label" v-bind:class="{'summary__label--error': healthAfterTransaction === 0}">
                Health:
              </div>
              <div class="summary__value">
              <span class="summary__value--error"
                    v-if="healthAfterTransaction < MIN_ALLOWED_HEALTH">
                {{ healthAfterTransaction | percent }}
              </span>
                <span v-else>
                {{ healthAfterTransaction | percent }}
              </span>
              </div>
              <BarGaugeBeta :min="0" :max="1" :value="healthAfterTransaction" :slim="true"></BarGaugeBeta>
            </div>
            <div class="summary__divider"></div>
            <div>
              <div class="summary__label">
                Balance:
              </div>
              <div class="summary__value">
                {{ Number(assetBalance) + Number(value) | smartRound }} {{ asset.symbol }}
              </div>
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="button-wrapper">
        <Button :label="'Borrow'" v-on:click="submit()" :disabled="currencyInputError"
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
import config from '../config';
import {calculateHealth} from '../utils/calculate';

export default {
  name: 'BorrowModal',
  components: {
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal,
    BarGaugeBeta
  },

  props: {
    asset: {},
    assets: {},
    assetBalances: {},
    farms: {},
    debtsPerAsset: {},
    assetBalance: Number,
    debt: Number,
    thresholdWeightedValue: Number,
    loanAPY: Number,
    poolTVL: Number,
    maxUtilisation: Number
  },

  data() {
    return {
      value: 0,
      healthAfterTransaction: 0,
      validators: [],
      currencyInputError: true,
      transactionOngoing: false,
      MIN_ALLOWED_HEALTH: config.MIN_ALLOWED_HEALTH,
      maxBorrow: 0,
    };
  },

  mounted() {
    setTimeout(() => {
      this.calculateHealthAfterTransaction();
      this.setupValidators();
      this.calculateMaxBorrow();
    });
  },

  methods: {
    submit() {
      this.transactionOngoing = true;
      this.$emit('BORROW', this.value);
    },

    inputChange(change) {
      this.value = Number(change);
      this.calculateHealthAfterTransaction();
    },

    currencyInputChange(changeEvent) {
      this.currencyInputError = changeEvent.error;
    },

    calculateHealthAfterTransaction() {
      let addedBorrow = this.value ? this.value : 0;

      let tokens = [];
      for (const [symbol, data] of Object.entries(this.assets)) {
        let borrowed = this.debtsPerAsset[symbol] ? parseFloat(this.debtsPerAsset[symbol].debt) : 0;
        let balance = parseFloat(this.assetBalances[symbol]);
        if (symbol === this.asset.symbol) {
          borrowed += addedBorrow;
          balance += addedBorrow;
        }

        tokens.push({price: data.price, balance: balance, borrowed: borrowed, debtCoverage: data.debtCoverage});
      }

      for (const [symbol, data] of Object.entries(this.lpAssets)) {
        tokens.push({
          price: data.price,
          balance: parseFloat(this.lpBalances[symbol]),
          borrowed: 0,
          debtCoverage: data.debtCoverage
        });
      }

      for (const [, farms] of Object.entries(this.farms)) {
        farms.forEach(farm => {
          tokens.push({
            price: farm.price,
            balance: parseFloat(farm.totalBalance),
            borrowed: 0,
            debtCoverage: farm.debtCoverage
          });
        });
      }

      this.healthAfterTransaction = calculateHealth(tokens);
    },

    setupValidators() {
      this.validators = [
        {
          validate: (value) => {
            if (this.healthAfterTransaction < this.MIN_ALLOWED_HEALTH) {
              return `Health should be higher than 0%`;
            }
          },
        },
        {
          validate: (value) => {
            if (this.value > this.maxUtilisation * this.poolTVL) {
              return `You can borrow up to ${this.maxUtilisation * 100}% of this pool's TVL`;
            }
          }
        }
      ];
    },

    calculateMaxBorrow() {
      const MIN_HEALTH = 0.0182;
      const numerator = -this.debt + this.thresholdWeightedValue - MIN_HEALTH;
      const denominator = this.asset.price - (this.asset.price * this.asset.debtCoverage) + (MIN_HEALTH * this.asset.price * this.asset.debtCoverage);
      this.maxBorrow = numerator / denominator;
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";


</style>