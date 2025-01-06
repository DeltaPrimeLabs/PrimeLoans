<template>
  <div id="modal" v-if="pool" class="deposit-modal-component modal-component">
    <Modal :height="getModalHeight">
      <div class="modal__title">
        Deposit
      </div>
      <div class="modal-top-desc">
        <b>It will require accepting several consecutive Metamask transactions.</b>
      </div>
      <div class="modal-top-info">
        <div class="top-info__label">APY:</div>
        <div class="top-info__value">{{ apy + miningApy | percent }}</div>
        <div class="top-info__divider"></div>
        <div class="top-info__label">Available:</div>
        <div class="top-info__value">{{ available | smartRound }}<span class="top-info__currency"> {{ symbol }}</span>
        </div>
      </div>

      <CurrencyInput v-on:newValue="depositValueChange"
                     :symbol="assetSymbol"
                     :validators="validators"
                     :max="assetSymbol === config.nativeToken && selectedDepositAsset === config.nativeToken ? null : walletAssetBalance">
      </CurrencyInput>

      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            <div class="pool">
              <img class="pool__icon" v-if="assetSymbol" :src="getAssetIcon(assetSymbol)">
              <div class="pool__name">{{ assetSymbol }} Pool</div>
              ,
            </div>
            Values after confirmation:
          </div>
          <div class="summary__horizontal__divider"></div>
          <div class="summary__values">
            <div class="summary__value__pair">
              <div class="summary__label">
                Deposit:
              </div>
              <div class="summary__value">
                {{ Number(deposit) + Number(depositValue) | smartRound(8, true) }} <span class="currency">{{
                  assetSymbol
                }}</span>
              </div>
            </div>
            <div class="summary__divider divider--long"></div>
            <div class="summary__value__pair">
              <div class="summary__label">
                Mean daily interest (365D):
              </div>
              <div class="value__wrapper">
                <div class="summary__value">
                  ≈ {{ calculateDailyInterest | smartRound(8, true) }}
                  <span class="currency">{{ assetSymbol }}</span>
                </div>
                <div class="summary__value" v-if="miningApy">
                  + ≈ ${{ calculateDailyMiningInterest | smartRound(8, true) }} in
                  <span class="currency" v-if="rewardToken">{{ rewardToken }}
                    <img class="asset__icon" :src="getAssetIcon(rewardToken)">
                  </span>
                </div>
              </div>
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="toggle-container" v-if="assetSymbol === config.nativeToken">
        <Toggle v-on:change="assetToggleChange" :options="[config.nativeToken, `W${config.nativeToken}`]"></Toggle>
      </div>

      <div class="button-wrapper">
        <Button :label="'Deposit'"
                v-on:click="submit()"
                :waiting="transactionOngoing"
                :disabled="inputValidationError">
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
import ethers from 'ethers';
import addresses from '../../common/addresses/avalanche/token_addresses.json';
import erc20ABI from '../../test/abis/ERC20.json';
import config from '../config';

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
    pool: null,
    apy: null,
    walletAssetBalance: null,
    accountBalance: null,
    deposit: 0,
    assetSymbol: null,
    miningApy: null,
    rewardToken: null
  },

  data() {
    return {
      depositValue: 0,
      selectedDepositAsset: config.nativeToken,
      validators: [],
      transactionOngoing: false,
      inputValidationError: false,
    };
  },

  mounted() {
    this.setupValidators();
  },

  computed: {
    config() {
      return config;
    },
    calculateDailyInterest() {
      return (this.apy) / 365 * (Number(this.deposit) + this.depositValue);
    },
    calculateDailyMiningInterest() {
      return (this.miningApy) / 365 * (Number(this.deposit) + this.depositValue) * this.pool.assetPrice;
    },

    getModalHeight() {
      return this.assetSymbol === config.nativeToken ? '561px' : null;
    },

    available() {
      return (this.assetSymbol === config.nativeToken && this.selectedDepositAsset === config.nativeToken)
          ? this.accountBalance : this.walletAssetBalance;
    },

    symbol() {
      return this.assetSymbol === config.nativeToken ? this.selectedDepositAsset : this.assetSymbol;
    }
  },

  methods: {
    submit() {
      this.transactionOngoing = true;
      const depositEvent = {
        value: this.depositValue,
        depositNativeToken: this.assetSymbol === config.nativeToken && this.selectedDepositAsset === config.nativeToken,
      };
      this.$emit('DEPOSIT', depositEvent);
    },

    depositValueChange(event) {
      console.log(event);
      this.depositValue = Number(event.value);
      this.inputValidationError = event.error;
    },

    assetToggleChange(asset) {
      this.selectedDepositAsset = asset;
    },

    setupValidators() {
      this.validators = [
        {
          validate: (value) => {
            if (value > this.available) {
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

.value__wrapper {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;

  .asset__icon {
    cursor: pointer;
    width: 20px;
    height: 20px;
    opacity: var(--asset-table-row__icon-opacity);
  }

  .summary__value:last-child {
    margin-left: 5px;
  }
}

</style>
