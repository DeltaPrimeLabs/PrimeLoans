<template>
  <div v-if="asset" id="modal" class="add-from-wallet-modal-component modal-component">
    <Modal :height="getModalHeight">
      <div class="modal__title">
        Deposit collateral
      </div>
      <div class="modal-top-desc" v-if="noSmartLoan">
        <div>
          This action will deploy your <b>Prime Account</b> and add your
          collateral.
          <br><br>
        </div>
        <div>
          <b>It will require accepting Terms and <span v-if="isNativeAvax">3</span><span v-else>2</span> consecutive Metamask transactions.</b>
        </div>
      </div>
      <div class="modal-top-desc" v-if="!noSmartLoan && (this.asset.symbol !== 'AVAX' || selectedDepositAsset !== 'AVAX')">
        <b>This action requires two separate transactions to be approved.</b>
      </div>
      <div class="modal-top-info">
        <div class="top-info__label">Available:</div>
        <div class="top-info__value" v-bind:class="{'available-balance--loading': !getAvailableAssetAmount && getAvailableAssetAmount !== 0}">
          <LoadedValue :check="() => getAvailableAssetAmount != null || Number.isNaN(getAvailableAssetAmount)"
                       :value="isLP ? formatTokenBalance(getAvailableAssetAmount, 10, true) : formatTokenBalance(getAvailableAssetAmount)"></LoadedValue>
          <div v-if="getAvailableAssetAmount != null">
            <span v-if="asset.name === 'AVAX'" class="top-info__currency">
              {{ selectedDepositAsset }}
            </span>
            <span v-if="asset.name !== 'AVAX'" class="top-info__currency">
              {{ isLP ? asset.name : asset.symbol }}
            </span>
          </div>
        </div>
      </div>

      <CurrencyInput ref="lpCurrencyInput"
                     v-if="isLP"
                     :symbol="asset.primary"
                     :symbol-secondary="asset.secondary"
                     v-on:newValue="inputChange"
                     :validators="validators"
      >
      </CurrencyInput>
      <CurrencyInput ref="currencyInput"
                     v-if="!isLP"
                     :symbol="asset.symbol"
                     v-on:newValue="inputChange"
                     :validators="validators"
      >
      </CurrencyInput>

      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            Values after transaction:
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
              <BarGaugeBeta :min="0" :max="1" :value="healthAfterTransaction ? healthAfterTransaction : 0"
                            :slim="true"></BarGaugeBeta>
            </div>
            <div class="summary__divider"></div>
            <div>
              <div class="summary__label">
                Balance:
              </div>
              <div class="summary__value">
                {{ (Number(assetBalance) + Number(value)) | smartRound(8, true) }}
                {{ isLP ? asset.primary + '-' + asset.secondary : asset.symbol }}
              </div>
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="toggle-container" v-if="asset.symbol === 'AVAX'">
        <Toggle v-on:change="assetToggleChange" :options="['AVAX', 'WAVAX']"></Toggle>
      </div>

      <div class="button-wrapper">
        <Button :label="'Add funds'"
                v-on:click="submit()"
                :disabled="validationError || (!getAvailableAssetAmount && getAvailableAssetAmount !== 0)"
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
import {mapState} from 'vuex';
import {calculateHealth} from '../utils/calculate';
import LoadedValue from './LoadedValue';


export default {
  name: 'AddFromWalletModal',
  components: {
    LoadedValue,
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal,
    BarGaugeBeta,
    Toggle
  },

  props: {
    asset: {},
    assets: {},
    assetBalances: {},
    debtsPerAsset: {},
    lpAssets: {},
    lpBalances: {},
    farms: {},
    thresholdWeightedValue: Number,
    loan: Number,
    assetBalance: Number,
    isLP: false,
    walletAssetBalance: {},
    walletNativeTokenBalance: {
      default: null,
    },
    noSmartLoan: false,
    transactionOngoing: false
  },

  data() {
    return {
      value: 0,
      healthAfterTransaction: 1,
      validators: [],
      selectedDepositAsset: 'AVAX',
      validationError: true,
      availableAssetAmount: 0,
    };
  },

  mounted() {
    setTimeout(() => {
      this.calculateHealthAfterTransaction();
      this.setupValidators();
    });
    setTimeout(() => {
      this.setupAvailableAssetAmount();
    }, 1);
  },

  computed: {
    ...mapState('network', ['account', 'accountBalance']),
    getModalHeight() {
      return this.asset.symbol === 'AVAX' ? '561px' : null;
    },

    getAvailableAssetAmount() {
      this.$forceUpdate();
      if (this.isNativeAvax) {
        return this.walletNativeTokenBalance;
      } else {
        console.log((!this.walletAssetBalance && this.walletAssetBalance !== 0) ? null : this.walletAssetBalance);
        return (!this.walletAssetBalance && this.walletAssetBalance !== 0) ? null : this.walletAssetBalance;
      }
    },

    isNativeAvax() {
      return this.asset.symbol === 'AVAX' && this.selectedDepositAsset === 'AVAX';
    }
  },

  methods: {
    submit() {
      this.transactionOngoing = true;
      if (this.asset.symbol === 'AVAX') {
        this.$emit('ADD_FROM_WALLET', {value: this.value.toFixed(this.asset.decimals), asset: this.selectedDepositAsset});
      } else {
        this.$emit('ADD_FROM_WALLET', {value: this.value.toFixed(this.asset.decimals), asset: this.asset});
      }
    },

    inputChange(changeEvent) {
      this.value = changeEvent.value;
      this.validationError = changeEvent.error;
      this.calculateHealthAfterTransaction();
    },

    calculateHealthAfterTransaction() {
      console.log('calculateHealthAfterTransaction')
      console.log(this.noSmartLoan)
      if (this.noSmartLoan) this.healthAfterTransaction = 1;

      let added = this.value ? this.value : 0;

      let tokens = [];
      for (const [symbol, data] of Object.entries(this.assets)) {
        let borrowed = (this.debtsPerAsset && this.debtsPerAsset[symbol]) ? parseFloat(this.debtsPerAsset[symbol].debt) : 0;
        let balance = parseFloat(this.assetBalances[symbol]);
        if (symbol === this.asset.symbol) {
          balance += added;
        }

        tokens.push({ price: data.price, balance: balance ? balance : 0, borrowed: borrowed, debtCoverage: data.debtCoverage});
      }

      for (const [symbol, data] of Object.entries(this.lpAssets)) {
        if (this.lpBalances) {
          let balance = parseFloat(this.lpBalances[symbol]);

          if (symbol === this.asset.symbol) {
            balance += added;
          }

          tokens.push({price: data.price, balance: balance ? balance : 0, borrowed: 0, debtCoverage: data.debtCoverage});
        }
      }

      for (const [, farms] of Object.entries(this.farms)) {
        farms.forEach(farm => {
          tokens.push({
            price: farm.price,
            balance: parseFloat(farm.totalBalance) ? parseFloat(farm.totalBalance) : 0,
            borrowed: 0,
            debtCoverage: farm.debtCoverage
          });
        });
      }

      console.log(tokens)

      this.healthAfterTransaction = calculateHealth(tokens);
    },

    setupValidators() {
      this.validators = [
        {
          validate: (value) => {
            if (value > this.getAvailableAssetAmount) {
              return 'Exceeds account balance';
            }
          }
        }
      ];
    },

    async assetToggleChange(asset) {
      this.selectedDepositAsset = asset;
      const error = await this.$refs.currencyInput.forceValidationCheck(this.value);
      this.validationError = error !== '';
    },

    setupAvailableAssetAmount() {
      if (this.asset.symbol === 'AVAX') {
        const balance = this.selectedDepositAsset === 'AVAX' ? this.walletNativeTokenBalance : this.walletAssetBalance;
        this.availableAssetAmount = balance;
      } else {
        this.availableAssetAmount = this.walletAssetBalance ? this.walletAssetBalance : null;
      }
      this.$forceUpdate();
    },

    setWalletNativeTokenBalance(balance) {
      this.walletNativeTokenBalance = balance;
      this.$forceUpdate();
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";


</style>

<style lang="scss">
.available-balance--loading {
  .loaded-value-component {
    height: 20px;
    display: flex;
    flex-direction: row;
    margin: -10px 0 -10px -10px;
  }
}
</style>