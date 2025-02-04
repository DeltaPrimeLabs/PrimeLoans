<template>
  <div id="modal" v-if="lpToken" class="balancer-unwind-lp-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Unwind LP token
      </div>

      <div class="modal-top-info">
        <div class="top-info__label">Available:</div>
        <div class="top-info__value"> {{ formatTokenBalance(lpTokenBalance, 10, true) }}</div>
        <span class="top-info__currency">
          {{ lpToken.name }}
        </span>
      </div>

      <CurrencyInput :symbol="lpToken.primary"
                     :symbol-secondary="lpToken.secondary"
                     v-on:newValue="inputChange"
                     :max="lpTokenBalance"
                     :validators="validators">
      </CurrencyInput>

      <AssetDropdown v-if="unwindAssetOptions"
                     :asset-options="unwindAssetOptions"
                     :default-asset="Object.keys(unwindAssetOptions)[0]"
                     v-on:valueChange="unwindAssetChange">
      </AssetDropdown>

      <div class="slippage-bar">
        <div class="slippage-info">
          <span class="slippage-label">Max. acceptable slippage:</span>
          <SimpleInput :percent="true" :default-value="defaultSlippage" v-on:newValue="slippageChange"></SimpleInput>
          <span class="percent">%</span>
        </div>
      </div>

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
            <div class="summary__divider divider--long"></div>
            <div class="summary__value__pair">
              <div class="summary__label">
                {{ firstAsset.symbol }} balance:
              </div>
              <div class="summary__value">
                {{ formatTokenBalance(firstBalance + minReceivedFirst, 10, true) }}
              </div>
            </div>
            <div class="summary__divider divider--long"></div>
            <div class="summary__value__pair">
              <div class="summary__label">
                {{ secondAsset.symbol }} balance:
              </div>
              <div class="summary__value">
                {{ formatTokenBalance(secondBalance + minReceivedSecond, 10, true) }}
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
import AssetDropdown from "./AssetDropdown.vue";
import SimpleInput from "./SimpleInput.vue";

const ethers = require('ethers');

const DEFAULT_SLIPPAGE = 0.5 // 0.5%

export default {
  name: 'BalancerUnwindLpModal',
  components: {
    SimpleInput,
    AssetDropdown,
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
    lpTokenDecimals: null,
    firstBalance: Number,
    secondBalance: Number,
  },

  data() {
    return {
      amount: null,
      validators: [],
      minReceivedFirst: 0,
      minReceivedSecond: 0,
      transactionOngoing: false,
      currencyInputError: true,
      unwindAssetOptions: [],
      targetAsset: null,
      defaultSlippage: DEFAULT_SLIPPAGE,
      slippage: DEFAULT_SLIPPAGE,
      assets: [],
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
      const lpTokenDecimals = this.lpTokenDecimals ? this.lpTokenDecimals : config.LP_ASSETS_CONFIG[this.lpToken.symbol].decimals;
      this.transactionOngoing = true;
      const minReceivedAmounts = await this.calculateReceivedAmounts(this.amount);
      this.$emit('REMOVE_LIQUIDITY', {
        asset: this.lpToken.symbol,
        amount: Number(this.amount).toFixed(lpTokenDecimals),
        minReceivedFirst: minReceivedAmounts.minReceivedFirst,
        minReceivedSecond: minReceivedAmounts.minReceivedSecond,
        targetAsset: this.targetAsset,
      });
    },

    async inputChange(event) {
      this.amount = event.value;
      this.currencyInputError = event.error;
      this.$forceUpdate();
      setTimeout(() => {
        this.$forceUpdate();
      }, 100);
      await this.calculateReceivedAmounts(this.amount);
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

    async calculateReceivedAmounts(lpRemoved) {
      this.$forceUpdate();
      if (this.lpTokenBalance - this.amount < 0) {
        this.minReceivedFirst = 0;
        this.minReceivedSecond = 0;
      } else {
        //TODO: hardcoded slippage
        const slippage = this.slippage / 100
        console.log(slippage);

        console.log(this.lpToken.price);
        console.log(this.lpTokenBalance);
        console.log(this.assets);
        console.log(this.assets[this.targetAsset]);

        const minReceivedTargetAsset = (this.lpToken.price * lpRemoved / this.assets[this.targetAsset].price) * (1 - slippage);
        console.log(minReceivedTargetAsset);

        this.minReceivedFirst = !Number.isNaN(minReceivedTargetAsset) && this.targetAsset === this.lpToken.primary ? minReceivedTargetAsset : 0;
        this.minReceivedSecond = !Number.isNaN(minReceivedTargetAsset) && this.targetAsset === this.lpToken.secondary ? minReceivedTargetAsset : 0;

        this.$forceUpdate();

        const receivedValues = {
          minReceivedFirst: this.minReceivedFirst,
          minReceivedSecond: this.minReceivedSecond,
        };

        console.log(receivedValues);
        return receivedValues;
      }
    },

    unwindAssetChange(asset) {
      console.log(asset.chosen);
      this.targetAsset = asset.chosen;
      this.calculateReceivedAmounts(this.amount);
    },

    slippageChange(slippageChange) {
      console.log(slippageChange);
      this.slippage = slippageChange.value;
      this.calculateReceivedAmounts(this.amount);
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