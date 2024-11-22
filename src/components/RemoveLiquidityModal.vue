<template>
  <div id="modal" v-if="lpToken" class="remove-liquidity-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Unwind LP token
      </div>

      <div class="modal-top-info">
        <div class="top-info__label">Available:</div>
        <div class="top-info__value"> {{formatTokenBalance(lpTokenBalance, 10, true)}}</div>
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
            <div class="summary__divider divider--long"></div>
            <div class="summary__value__pair">
              <div class="summary__label">
                {{ firstAsset.symbol }} balance:
              </div>
              <div class="summary__value">
                {{ formatTokenBalance(firstBalance + minReceivedFirst) }}
              </div>
            </div>
            <div class="summary__divider divider--long"></div>
            <div class="summary__value__pair">
              <div class="summary__label">
                {{ secondAsset.symbol }} balance:
              </div>
              <div class="summary__value">
                {{ formatTokenBalance(secondBalance + minReceivedSecond) }}
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
import erc20ABI from '../../test/abis/ERC20.json';
import {parseUnits, formatUnits} from 'ethers/lib/utils';

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
      const lpTokenDecimals = config.LP_ASSETS_CONFIG[this.lpToken.symbol].decimals;
      this.transactionOngoing = true;
      const minReceivedAmounts = await this.calculateReceivedAmounts(this.amount);
      this.$emit('REMOVE_LIQUIDITY', {
        asset: this.lpToken.symbol,
        amount: Number(this.amount).toFixed(lpTokenDecimals),
        minReceivedFirst: minReceivedAmounts.minReceivedFirst,
        minReceivedSecond: minReceivedAmounts.minReceivedSecond
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
        const slippage = 0.005; // 0.5% slippage

        const firstTokenContract = new ethers.Contract(this.firstAsset.address, erc20ABI, provider.getSigner());
        const secondTokenContract = new ethers.Contract(this.secondAsset.address, erc20ABI, provider.getSigner());
        const lpTokenContract = new ethers.Contract(this.lpToken.address, erc20ABI, provider.getSigner());

        const lpTokenDecimals = config.LP_ASSETS_CONFIG[this.lpToken.symbol].decimals;

        const firstTokenBalance = await firstTokenContract.balanceOf(this.lpToken.address);
        const secondTokenBalance = await secondTokenContract.balanceOf(this.lpToken.address);
        const totalSupply = await lpTokenContract.totalSupply();

        this.$forceUpdate();

        console.log('calculateReceivedAmounts')
        console.log(lpRemoved)
        const firstAmount =
          parseUnits(Number(lpRemoved).toFixed(lpTokenDecimals), lpTokenDecimals)
            .mul(firstTokenBalance)
            .div(totalSupply)
            .mul((1 - slippage) * 1000)
            .div(1000);
        const secondAmount =
          parseUnits(Number(lpRemoved).toFixed(lpTokenDecimals), lpTokenDecimals)
            .mul(secondTokenBalance)
            .div(totalSupply)
            .mul((1 - slippage) * 1000)
            .div(1000);

        const minReceivedFirst = Number(formatUnits(firstAmount, this.firstAsset.decimals));
        this.minReceivedFirst = minReceivedFirst;
        const minReceivedSecond = Number(formatUnits(secondAmount, this.secondAsset.decimals));
        this.minReceivedSecond = minReceivedSecond;

        this.$forceUpdate();

        return {
          minReceivedFirst: minReceivedFirst,
          minReceivedSecond: minReceivedSecond,
        };
      }
    }
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";

.remove-liquidity-modal-component {

}


</style>