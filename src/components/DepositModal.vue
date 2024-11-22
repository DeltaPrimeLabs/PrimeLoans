<template>
  <div id="modal" class="deposit-modal-component modal-component">
    <Modal :height="getModalHeight">
      <div class="modal__title">
        Deposit
      </div>
      <div class="modal-top-desc">
        <b>It will require accepting several consecutive Metamask transactions.</b>
      </div>
      <div class="modal-top-info">
        <div class="top-info__label">APY:</div>
        <div class="top-info__value">{{ apy | percent }}</div>
        <div class="top-info__divider"></div>
        <div class="top-info__label">Available:</div>
        <div class="top-info__value">{{ available | smartRound }}<span class="top-info__currency"> {{ symbol }}</span></div>
      </div>

      <CurrencyInput v-on:newValue="depositValueChange"
                     :symbol="assetSymbol"
                     :validators="validators">
      </CurrencyInput>

      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            <div class="pool">
              <img v-if="assetSymbol === 'AVAX'" class="pool__icon" src="src/assets/logo/avax.svg">
              <img v-if="assetSymbol === 'USDC'" class="pool__icon" src="src/assets/logo/usdc.svg">
              <div class="pool__name">{{ assetSymbol }} Pool</div>
              ,
            </div>
            Values after confirmation:
          </div>
          <div class="summary__horizontal__divider"></div>
          <div class="summary__values">
            <div>
              <div class="summary__label">
                Deposit:
              </div>
              <div class="summary__value">
                {{ Number(deposit) + Number(depositValue) | smartRound(8, true) }} <span class="currency">{{ assetSymbol }}</span>
              </div>
            </div>
            <div class="summary__divider"></div>
            <div class="summary__label">
              Daily interest ≈
            </div>
            <div class="summary__value">
              {{ calculateDailyInterest | smartRound(8, true) }} <span class="currency">{{ assetSymbol }}</span>
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="toggle-container" v-if="assetSymbol === 'AVAX'">
        <Toggle v-on:change="assetToggleChange" :options="['AVAX', 'WAVAX']"></Toggle>
      </div>

      <div class="button-wrapper">
        <Button :label="'Deposit'" v-on:click="submit()" :waiting="transactionOngoing"></Button>
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
import ethers from "ethers";
import addresses from "../../common/addresses/avax/token_addresses.json";
import erc20ABI from '../../test/abis/ERC20.json';

export default {
  name: 'DepositModal',
  components: {
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal,
    Toggle
  },

  props: {
    apy: null,
    walletAssetBalance: null,
    accountBalance: null,
    deposit: 0,
    assetSymbol: null,
  },

  data() {
    return {
      depositValue: 0,
      selectedDepositAsset: 'AVAX',
      validators: [],
      transactionOngoing: false,
    };
  },

  mounted() {
    this.setupValidators();
  },

  computed: {
    calculateDailyInterest() {
      return this.apy / 365 * (Number(this.deposit) + this.depositValue);
    },

    getModalHeight() {
      return this.assetSymbol === 'AVAX' ? '561px' : null;
    },

    available() {
      return (this.assetSymbol === 'AVAX' && this.selectedDepositAsset === 'AVAX') ? this.accountBalance : this.walletAssetBalance;
    },

    symbol() {
      return this.assetSymbol === 'AVAX' ? this.selectedDepositAsset : this.assetSymbol;
    }
  },

  methods: {
    submit() {
      this.transactionOngoing = true;
      const depositEvent = {
        value: this.depositValue,
        depositNativeToken: this.assetSymbol === 'AVAX' && this.selectedDepositAsset === 'AVAX',
      };
      this.$emit('DEPOSIT', depositEvent);
    },

    depositValueChange(event) {
      this.depositValue = event.value;
    },

    assetToggleChange(asset) {
      this.selectedDepositAsset = asset;
    },

    setupValidators() {
      this.validators = [
        {
          validate: (value) => {
            if (value > this.available) {
              return 'Exceeds account balance'
            }
          }
        }
      ]
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";

</style>