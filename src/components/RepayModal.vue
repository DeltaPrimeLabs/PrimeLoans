<template>
  <div v-if="asset" id="modal" class="repay-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Repay
      </div>

      <div class="modal-top-info">
        <div class="top-info__label">Available:</div>
        <div class="top-info__value"> {{assetBalances[asset.symbol] | smartRound}}</div>
        <div class="top-info__divider"></div>
        <div class="top-info__label">Debt:</div>
        <div class="top-info__value"> {{assetDebt | smartRound}}</div>
        <span class="top-info__currency">
          {{asset.symbol}}
        </span>
      </div>

      <CurrencyInput :symbol="asset.symbol"
                     v-on:newValue="repayValueChange"
                     :validators="validators"
                     :max="assetDebt"
      >
      </CurrencyInput>

      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            Values after confirmation:
          </div>
          <div class="summary__horizontal__divider"></div>
          <div class="summary__values">
            <div>
              <div class="summary__label">
                Health:
              </div>
              <div class="summary__value">
                {{ healthAfterTransaction | percent }}
              </div>
              <BarGaugeBeta :min="0" :max="1" :value="healthAfterTransaction" :slim="true"></BarGaugeBeta>
            </div>
            <div class="summary__divider"></div>
            <div>
              <div class="summary__label">
                Loan:
              </div>
              <div class="summary__value">
                {{ (assetDebt - repayValue) > 0 ? assetDebt - repayValue : 0 | smartRound }} {{ asset.symbol }}
              </div>
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="button-wrapper">
        <Button :label="'Repay'"
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
import BarGaugeBeta from './BarGaugeBeta';
import {calculateHealth} from "../utils/calculate";
import config from '../config';

const MAX_REPAYMENT_OF_DEBT = 1.000001;

export default {
  name: 'WithdrawModal',
  components: {
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal,
    BarGaugeBeta
  },

  props: {
    asset: {},
    health: {},
    initialLoan: {},
    thresholdWeightedValue: {},
    assetDebt: {},
    assetBalances: {},
    assets: {},
    debtsPerAsset: {},
    lpAssets: {},
    lpBalances: {},
    farms: {}
  },

  data() {
    return {
      repayValue: 0,
      healthAfterTransaction: 0,
      transactionOngoing: false,
      validators: [],
      currencyInputError: true,
      maxButtonUsed: false,
    }
  },

  mounted() {
    setTimeout(() => {
      this.loan = this.initialLoan;
      this.calculateHealthAfterTransaction();
      this.setupValidators();
    })
  },

  computed: {
    //because the debt is continously compounding, we have to allow repaying a little more to allow users to fully
    //repay their debts
    maxRepaymentOfDebt() {
      return MAX_REPAYMENT_OF_DEBT;
    },
  },

  methods: {
    submit() {
      this.transactionOngoing = true;
      const repayValue = this.maxButtonUsed ? this.repayValue * config.MAX_BUTTON_MULTIPLIER : this.repayValue;
      this.$emit('REPAY', { repayValue: repayValue, isMax: this.maxButtonUsed });
    },

    repayValueChange(event) {
      this.repayValue = event.value;
      this.currencyInputError = event.error;
      this.maxButtonUsed = event.maxButtonUsed;
      this.calculateHealthAfterTransaction();
    },

    calculateHealthAfterTransaction() {
      let repaid = this.repayValue ? this.repayValue : 0;

      let tokens = [];
      for (const [symbol, data] of Object.entries(this.assets)) {
        let borrowed = this.debtsPerAsset[symbol] ? parseFloat(this.debtsPerAsset[symbol].debt) : 0;
        let balance = parseFloat(this.assetBalances[symbol]);

        if (symbol === this.asset.symbol) {
          borrowed -= repaid;
          balance -= repaid;
        }

        tokens.push({ price: data.price, balance: balance, borrowed: borrowed, debtCoverage: data.debtCoverage});
      }

      for (const [symbol, data] of Object.entries(this.lpAssets)) {
        tokens.push({ price: data.price, balance: parseFloat(this.lpBalances[symbol]), borrowed: 0, debtCoverage: data.debtCoverage});
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
        // {
        //   validate: (value) => {
        //     if (value > this.assetDebt * this.maxRepaymentOfDebt) {
        //       return `Repay value exceeds debt`;
        //     }
        //   }
        // },
        {
          validate: (value) => {
            if (value > this.assetBalances[this.asset.symbol]) {
              return `Not enough funds to repay`;
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
</style>