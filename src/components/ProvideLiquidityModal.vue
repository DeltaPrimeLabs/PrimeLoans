<template>
  <div id="modal" v-if="lpToken" class="provide-liquidity-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Create LP token
      </div>

      <div class="modal-top-info">
        <div class="top-info__label">Available:</div>
        <div class="top-info__value"> {{ firstAssetBalance }}</div>
        <span class="top-info__currency">
          {{ firstAsset.symbol }}
        </span>
      </div>
      <CurrencyInput ref="firstInput"
                     :symbol="firstAsset.symbol"
                     v-on:inputChange="firstInputChange"
                     :defaultValue="firstAmount"
                     :max="firstAssetBalance"
                     :allow-zero-value="!areAmountsLinked"
                     :validators="firstInputValidators">
      </CurrencyInput>
      <div class="modal-top-info">
        <div class="top-info__label">Available:</div>
        <div class="top-info__value"> {{ secondAssetBalance }}</div>
        <span class="top-info__currency">
          {{ secondAsset.symbol }}
        </span>
      </div>
      <CurrencyInput ref="secondInput"
                     :symbol="secondAsset.symbol"
                     v-on:inputChange="secondInputChange"
                     :defaultValue="secondAmount"
                     :max="secondAssetBalance"
                     :allow-zero-value="!areAmountsLinked"
                     :validators="secondInputValidators">
      </CurrencyInput>

      <div class="modal-top-info">
        <div class="top-info__label">Max. slippage is 1%.</div>
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
                LP balance:
              </div>
              <div class="summary__value">
                {{ formatTokenBalance(Number(lpTokenBalance) + Number(addedLiquidity), 10, true) }}
              </div>
            </div>
            <div class="summary__divider divider--long"></div>
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
import erc20ABI from '../abis/ERC20.json';
import {fromWei} from '../utils/calculate';
import {formatUnits} from 'ethers/lib/utils';
import {BigNumber} from 'ethers';

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
    areAmountsLinked: true,
    lpToken: {},
    lpTokenBalance: Number,
    firstAssetBalance: Number,
    secondAssetBalance: Number,
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
      console.log('firstInputChange', change);
      this.firstAmount = change;
      if (this.areAmountsLinked) {
        this.secondAmount = this.firstAmount * this.lpToken.firstPrice / this.lpToken.secondPrice;
        this.$refs.secondInput.setValue(this.secondAmount !== 0 ? this.secondAmount.toFixed(this.secondAsset.decimals) : 0);
      }
      console.log(this.secondAmount);
      console.log('firstInputChange')
      this.firstInputError = await this.$refs.firstInput.forceValidationCheck();
      console.log('this.firstInputError: ', this.firstInputError)
      this.secondInputError = await this.$refs.secondInput.forceValidationCheck();
      await this.calculateLpBalance();

    },

    async secondInputChange(change) {
      console.log('secondInputChange', change);
      this.secondAmount = change;
      if (this.areAmountsLinked) {
        this.firstAmount = this.secondAmount * this.lpToken.secondPrice / this.lpToken.firstPrice;
        this.$refs.firstInput.setValue(this.firstAmount !== 0 ? this.firstAmount.toFixed(this.firstAsset.decimals) : 0);
      }
      this.firstInputError = await this.$refs.firstInput.forceValidationCheck();
      this.secondInputError = await this.$refs.secondInput.forceValidationCheck();
      await this.calculateLpBalance();
      console.log('secondInputChange')
    },

    async calculateLpBalance() {
      const lpToken = new ethers.Contract(this.lpToken.address, erc20ABI, provider.getSigner());
      const firstToken = new ethers.Contract(this.firstAsset.address, erc20ABI, provider.getSigner());
      const secondToken = new ethers.Contract(this.secondAsset.address, erc20ABI, provider.getSigner());

      const totalSupply = fromWei(await lpToken.totalSupply());
      const firstTokenBalance = formatUnits(await firstToken.balanceOf(this.lpToken.address), BigNumber.from(this.firstAsset.decimals));
      const secondTokenBalance = formatUnits(await secondToken.balanceOf(this.lpToken.address), BigNumber.from(this.secondAsset.decimals));

      this.addedLiquidity =
        (this.firstAmount ? this.firstAmount * this.firstAsset.price / this.lpToken.price : 0)
        +
        (this.secondAmount ? this.secondAmount * this.secondAsset.price / this.lpToken.price : 0);

      this.addedLiquidity = this.addedLiquidity.toFixed(18)
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