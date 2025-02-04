<template>
  <div id="modal" v-if="lpToken" class="provide-liquidity-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Create Concentrated LP token
      </div>

      <div class="modal-top-info">
        <div class="top-info__label">Available:</div>
        <div class="top-info__value"> {{firstAssetBalance | smartRound(10, true)}}</div>
        <span class="top-info__currency">
          {{firstAsset.symbol}}
        </span>
      </div>
      <CurrencyInput ref="firstInput"
                     :symbol="firstAsset.symbol"
                     v-on:inputChange="firstInputChange"
                     :defaultValue="firstAmount"
                     :validators="firstInputValidators">
      </CurrencyInput>
      <div class="modal-top-info">
        <div class="top-info__label">Available:</div>
        <div class="top-info__value"> {{secondAssetBalance | smartRound(10, true)}}</div>
        <span class="top-info__currency">
          {{secondAsset.symbol}}
        </span>
      </div>
      <CurrencyInput ref="secondInput"
                     :symbol="secondAsset.symbol"
                     v-on:inputChange="secondInputChange"
                     :defaultValue="secondAmount"
                     :validators="secondInputValidators">
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
                {{ firstAsset.symbol }} balance:
              </div>
              <div class="summary__value">
                {{ formatTokenBalance(Number(firstAssetBalance) - Number(firstAmount)) }}
              </div>
            </div>

            <div class="summary__divider divider--long"></div>
            <div class="summary__value__pair">
              <div class="summary__label">
                {{ secondAsset.symbol }} balance:
              </div>
              <div class="summary__value">
                {{ formatTokenBalance(Number(secondAssetBalance) - Number(secondAmount)) }}
              </div>
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="button-wrapper">
        <Button :label="'Create LP token'"
                v-on:click="submit()"
                :waiting="transactionOngoing"
                :disabled="firstInputError || secondInputError">
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
  name: 'ProvideLiquidityModal',
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
    firstAssetBalance: Number,
    secondAssetBalance: Number,
    totalFirstAmount: Number,
    totalSecondAmount: Number,
  },

  data() {
    return {
      firstAmount: null,
      secondAmount: null,
      firstInputValidators: [],
      secondInputValidators: [],
      addedLiquidity: 0,
      transactionOngoing: false,
      firstInputError: true,
      secondInputError: false,
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
    }
  },

  methods: {
    submit() {
      this.transactionOngoing = true;
      const provideLiquidityEvent = {
        firstAsset: this.firstAsset,
        secondAsset: this.secondAsset,
        firstAmount: this.firstAmount,
        secondAmount: this.secondAmount,
        addedLiquidity: this.addedLiquidity
      };
      this.$emit('PROVIDE_LIQUIDITY', provideLiquidityEvent);
    },

    async firstInputChange(change) {
      this.firstAmount = change;
      this.secondAmount = this.firstAmount * this.totalSecondAmount / this.totalFirstAmount;
      this.$refs.secondInput.setValue(this.secondAmount !== 0 ? this.secondAmount.toFixed(this.secondAsset.decimals) : 0);
      this.firstInputError = await this.$refs.firstInput.forceValidationCheck();
      this.secondInputError = await this.$refs.secondInput.forceValidationCheck();
    },

    async secondInputChange(change) {
      this.secondAmount = change;
      this.firstAmount = (this.secondAmount * this.totalFirstAmount) / (this.totalSecondAmount);
      this.$refs.firstInput.setValue(this.firstAmount !== 0 ? this.firstAmount.toFixed(this.firstAsset.decimals) : 0);
      this.firstInputError = await this.$refs.firstInput.forceValidationCheck();
      this.secondInputError = await this.$refs.secondInput.forceValidationCheck();
    },

    setupValidators() {
      this.firstInputValidators = [
        {
          validate: (value) => {
            if (value > this.firstAssetBalance) {
              return `Exceeds ${this.firstAsset.symbol} balance`;
            }
          }
        }
      ];

      this.secondInputValidators = [
        {
          validate: (value) => {
            if (value > this.secondAssetBalance) {
              return `Exceeds ${this.secondAsset.symbol} balance`;
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

.provide-liquidity-modal-component {

}


</style>