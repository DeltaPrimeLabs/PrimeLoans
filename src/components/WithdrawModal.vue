<template>
  <div v-if="asset" id="modal" class="withdraw-modal-component modal-component">
    <Modal :height="getModalHeight">
      <div class="modal__title">
        Withdraw collateral
      </div>
      <div class="modal-top-desc">
        You can withdraw only if you have enough debt tokens to repay all borrows. <a target="_blank" href="https://docs.deltaprime.io/protocol/safety#withdrawal-guard"><b>Read more</b></a>
      </div>
      <div class="modal-top-info">
        <div class="top-info__label">Available:</div>
        <div class="top-info__value">
          {{ isLP ? formatTokenBalance(assetBalance, 10, true) : formatTokenBalance(assetBalance) }}
          <span class="top-info__currency">
            {{ asset.name }}
          </span>
        </div>
      </div>

      <CurrencyInput v-if="isLP"
                     :symbol="asset.primary"
                     :symbol-secondary="asset.secondary"
                     v-on:newValue="withdrawValueChange"
                     :validators="validators">
      </CurrencyInput>
      <CurrencyInput v-else
                     :symbol="asset.symbol"
                     v-on:newValue="withdrawValueChange"
                     :validators="validators">
      </CurrencyInput>

      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            Values after confirmation:
          </div>
          <div class="summary__horizontal__divider"></div>
          <div class="summary__values">
            <div>
              <div class="summary__label"
                   v-bind:class="{'summary__label--error': healthAfterTransaction < MIN_ALLOWED_HEALTH}">
                Health:
              </div>
              <div class="summary__value">
              <span class="summary__value--error" v-if="healthAfterTransaction < MIN_ALLOWED_HEALTH">
                {{ healthAfterTransaction | percent }}
              </span>
                <span v-if="healthAfterTransaction >= MIN_ALLOWED_HEALTH">
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
                {{
                  (Number(assetBalance) - Number(withdrawValue)) > 0 ? (Number(assetBalance) - Number(withdrawValue)) : 0 | smartRound
                }}
                {{ isLP ? asset.primary + '-' + asset.secondary : asset.name }}
              </div>
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="toggle-container" v-if="asset.name === 'AVAX'">
        <Toggle v-on:change="assetToggleChange" :options="['AVAX', 'WAVAX']"></Toggle>
      </div>

      <div class="button-wrapper">
        <Button :label="'Withdraw'"
                v-on:click="submit()"
                :disabled="currencyInputError"
                :waiting="transactionOngoing">
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
import {calculateHealth} from '../utils/calculate';

export default {
  name: 'WithdrawModal',
  components: {
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal,
    BarGaugeBeta,
    Toggle,
  },

  props: {
    asset: {},
    health: {},
    assetBalances: {},
    assets: {},
    farms: {},
    debtsPerAsset: {},
    lpAssets: {},
    lpBalances: {},
  },

  data() {
    return {
      withdrawValue: 0,
      healthAfterTransaction: 0,
      validators: [],
      currencyInputError: true,
      MIN_ALLOWED_HEALTH: config.MIN_ALLOWED_HEALTH,
      selectedWithdrawAsset: 'AVAX',
      isLP: false,
      transactionOngoing: false,
      debt: 0,
      thresholdWeightedValue: 0,
      maxWithdraw: 0,
    };
  },

  mounted() {
    setTimeout(() => {
      this.setupValidators();
      this.calculateHealthAfterTransaction();
      this.calculateMaxWithdraw();
    });
  },

  computed: {
    getModalHeight() {
      return this.asset.symbol === 'AVAX' ? '561px' : null;
    },
  },

  methods: {
    submit() {
      this.transactionOngoing = true;
      let withdrawEvent = {};
      if (this.asset.symbol === 'AVAX') {
        withdrawEvent = {
          withdrawAsset: this.selectedWithdrawAsset,
          value: this.withdrawValue,
        };
      } else {
        withdrawEvent = {
          withdrawAsset: this.asset.symbol,
          value: this.withdrawValue,
        };
      }

      this.$emit('WITHDRAW', withdrawEvent);
    },


    withdrawValueChange(event) {
      this.withdrawValue = event.value;
      this.currencyInputError = event.error;
      this.calculateHealthAfterTransaction();
    },

    calculateHealthAfterTransaction() {
      let withdrawn = this.withdrawValue ? this.withdrawValue : 0;

      let tokens = [];
      for (const [symbol, data] of Object.entries(this.assets)) {
        let borrowed = this.debtsPerAsset[symbol] ? parseFloat(this.debtsPerAsset[symbol].debt) : 0;
        let balance = parseFloat(this.assetBalances[symbol]);
        if (symbol === this.asset.symbol) {
          balance -= withdrawn;
        }

        tokens.push({ price: data.price, balance: balance, borrowed: borrowed, debtCoverage: data.debtCoverage});
      }

      for (const [symbol, data] of Object.entries(this.lpAssets)) {
        let balance = parseFloat(this.lpBalances[symbol]);

        if (symbol === this.asset.symbol) {
          balance -= withdrawn;
        }

        tokens.push({ price: data.price, balance: balance, borrowed: 0, debtCoverage: data.debtCoverage});
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

      this.$forceUpdate();
    },

    assetToggleChange(asset) {
      this.selectedWithdrawAsset = asset;
    },

    setupValidators() {
      this.validators = [
        {
          validate: (value) => {
            if (this.healthAfterTransaction <= 0) {
              return `Health should be higher than 0%`;
            }
          }
        },
        {
          validate: (value) => {
            if (this.assetBalance - value < 0) {
              return `Withdraw amount exceeds balance`;
            }
          }
        },
        {
          validate: (value) => {
            let canRepayAllDebts = Object.values(this.debtsPerAsset).every(
                debt => {
                  let balance = parseFloat(this.assetBalances[debt.asset]);
                  if (debt.asset === this.asset.symbol) {
                    balance -= value;
                  }
                  return parseFloat(debt.debt) <= balance;
                }
            );

            if (!canRepayAllDebts) {
              return 'Missing AVAX/USDC in portfolio. Please make sure you can repay your debt before withdrawing.'
            }
          }
        }
      ];
    },

    calculateMaxWithdraw() {
      //TODO: we should check it and use correct formula
      // const MIN_HEALTH = 0.0182;
      // const numerator = -this.debt + this.thresholdWeightedValue - MIN_HEALTH;
      // const denominator = this.asset.price - (this.asset.price * this.asset.debtCoverage) + (MIN_HEALTH * this.asset.price * this.asset.debtCoverage);
      // const maxWithdrawLimitedByHealth = numerator / denominator;
      // this.maxWithdraw = Math.min(maxWithdrawLimitedByHealth, this.assetBalance);
      this.maxWithdraw = this.assetBalance;
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";

</style>