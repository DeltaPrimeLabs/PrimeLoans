<template>
  <div v-if="asset" id="modal" class="add-from-wallet-modal-component modal-component">
    <Modal :height="getModalHeight">
      <div class="modal__title">
        {{ title }}
      </div>
      <div class="modal-top-desc" v-if="noSmartLoan">
        <div>
          This action will deploy your <b>Prime Account</b> and add your
          collateral.
          <br><br>
        </div>
        <div>
          <b>It will require accepting Terms and <span v-if="isNativeAsset">3</span><span v-else>2</span> consecutive Metamask transactions.</b>
        </div>
      </div>
      <div class="modal-top-desc" v-if="!noSmartLoan && (this.asset.symbol !== toggleOptions[0] || selectedDepositAsset !== toggleOptions[0])">
        <b>This action requires two separate transactions to be approved.</b>
      </div>
      <div class="modal-top-info">
        <div class="top-info__label">Available:</div>
        <div class="top-info__value" v-bind:class="{'available-balance--loading': !getAvailableAssetAmount && getAvailableAssetAmount !== 0}">
          <LoadedValue :check="() => getAvailableAssetAmount != null || Number.isNaN(getAvailableAssetAmount)"
                       :value="isLP ? formatTokenBalance(getAvailableAssetAmount, 12, true) : formatTokenBalance(getAvailableAssetAmount, 10, true)"></LoadedValue>
          <div v-if="getAvailableAssetAmount != null">
            <span v-if="asset.name === toggleOptions[0]" class="top-info__currency">
              {{ selectedDepositAsset }}
            </span>
            <span v-if="asset.name !== toggleOptions[0]" class="top-info__currency">
              {{ asset.short ? asset.short : (isLP || isFarm ? asset.name : asset.symbol) }}
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
                     :max="getAvailableAssetAmount"
                     :info="() => sourceAssetValue"
      >
      </CurrencyInput>
      <CurrencyInput ref="currencyInput"
                     v-if="!isLP"
                     :symbol="asset.short ? asset.short : asset.symbol"
                     :logo="logo"
                     v-on:newValue="inputChange"
                     :validators="validators"
                     :max="asset.symbol === toggleOptions[0] && selectedDepositAsset === toggleOptions[0] ? null : getAvailableAssetAmount"
                     :info="() => sourceAssetValue"
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
                {{ isLP ? asset.primary + '-' + asset.secondary : (asset.short ? asset.short : asset.symbol) }}
              </div>
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="toggle-container" v-if="asset.symbol === toggleOptions[0]">
        <Toggle v-on:change="assetToggleChange" :options="toggleOptions"></Toggle>
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
import config from '../config';
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
    logo: null,
    assetBalances: {},
    debtsPerAsset: {},
    lpAssets: {},
    lpBalances: {},
    concentratedLpAssets: {},
    concentratedLpBalances: {},
    levelLpAssets: {},
    levelLpBalances: {},
    gmxV2Assets: {},
    gmxV2Balances: {},
    penpieLpAssets: {},
    penpieLpBalances: {},
    wombatLpAssets: {},
    wombatLpBalances: {},
    wombatYYFarmsBalances: {},
    traderJoeV2LpAssets: {},
    balancerLpAssets: {},
    balancerLpBalances: {},
    farms: {},
    thresholdWeightedValue: Number,
    loan: Number,
    assetBalance: Number,
    isLP: false,
    isFarm: false,
    walletAssetBalance: {}, // this prop is string, we need to convert when it's being used in calculation
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
      selectedDepositAsset: config.NATIVE_ASSET_TOGGLE_OPTIONS[0], // native token e.g. AVAX in Avalanche
      toggleOptions: config.NATIVE_ASSET_TOGGLE_OPTIONS,
      validationError: true,
      availableAssetAmount: 0,
      valueAsset: "USDC",
      title: "Deposit collateral",
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
    ...mapState('network', ['account']),
    getModalHeight() {
      return this.asset.symbol === this.toggleOptions[0] ? '561px' : null;
    },

    getAvailableAssetAmount() {
      this.$forceUpdate();
      if (this.isNativeAsset) {
        return this.walletNativeTokenBalance;
      } else {
        const walletAssetBalance = parseFloat(this.walletAssetBalance);
        return (!walletAssetBalance && walletAssetBalance !== 0) ? null : walletAssetBalance;
      }
    },

    isNativeAsset() {
      return this.asset.symbol === this.toggleOptions[0] && this.selectedDepositAsset === this.toggleOptions[0];
    },

    sourceAssetValue() {
      const sourceAssetUsdPrice = Number(this.value) * this.asset.price;

      if (this.valueAsset === "USDC") {
        return `~ $${sourceAssetUsdPrice.toFixed(2)}`;
      }
    },

  },

  methods: {
    submit() {
      this.transactionOngoing = true;
      if (this.asset.symbol === this.toggleOptions[0]) {
        this.$emit('ADD_FROM_WALLET', {value: parseFloat(this.value).toFixed(this.asset.decimals), asset: this.selectedDepositAsset});
      } else {
        this.$emit('ADD_FROM_WALLET', {value: parseFloat(this.value).toFixed(this.asset.decimals), asset: this.asset});
      }
    },

    inputChange(changeEvent) {
      this.value = changeEvent.value;
      this.validationError = changeEvent.error;
      this.calculateHealthAfterTransaction();
    },

    calculateHealthAfterTransaction() {
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

      for (const [symbol, data] of Object.entries(this.concentratedLpAssets)) {
        if (this.concentratedLpBalances) {
          let balance = parseFloat(this.concentratedLpBalances[symbol]);

          if (symbol === this.asset.symbol) {
            balance += added;
          }

          tokens.push({price: data.price, balance: balance ? balance : 0, borrowed: 0, debtCoverage: data.debtCoverage});
        }
      }

      for (const [symbol, data] of Object.entries(this.balancerLpAssets)) {
        if (this.balancerLpBalances) {
          let balance = parseFloat(this.balancerLpBalances[symbol]);

          tokens.push({price: data.price, balance: balance ? balance : 0, borrowed: 0, debtCoverage: data.debtCoverage});
        }
      }

      for (const [symbol, data] of Object.entries(this.levelLpAssets)) {
        if (this.levelLpBalances) {
          let balance = parseFloat(this.levelLpBalances[symbol]);

          if (symbol === this.asset.symbol) {
            balance += added;
          }

          tokens.push({price: data.price, balance: balance ? balance : 0, borrowed: 0, debtCoverage: data.debtCoverage});
        }
      }

      if (this.penpieLpAssets) {
        for (const [symbol, data] of Object.entries(this.penpieLpAssets)) {
          if (this.penpieLpBalances) {
            let balance = parseFloat(this.penpieLpBalances[symbol]);

            if (symbol === this.asset.symbol) {
              balance += added;
            }

            tokens.push({
              price: data.price,
              balance: balance ? balance : 0,
              borrowed: 0,
              debtCoverage: data.debtCoverage
            });
          }
        }
      }

      if (this.wombatLpAssets) {
        for (const [symbol, data] of Object.entries(this.wombatLpAssets)) {
          if (this.wombatLpBalances) {
            let balance = parseFloat(this.wombatLpBalances[symbol]);

            if (symbol === this.asset.symbol) {
              balance += added;
            }

            tokens.push({
              price: data.price,
              balance: balance ? balance : 0,
              borrowed: 0,
              debtCoverage: data.debtCoverage
            });
          }
        }
      }

      if (config.WOMBAT_YY_FARMS) {
        for (const farm of config.WOMBAT_YY_FARMS) {
          if (this.wombatLpAssets && this.wombatYYFarmsBalances) {
            const symbol = farm.apyKey
            let balance = parseFloat(this.wombatYYFarmsBalances[symbol]);

            tokens.push({
              price: this.wombatLpAssets[farm.lpAssetToken].price,
              balance: balance ? balance : 0,
              borrowed: 0,
              debtCoverage: farm.debtCoverage
            });
          }
        }
      }

      for (const [symbol, data] of Object.entries(this.gmxV2Assets)) {
        tokens.push({
          price: data.price,
          balance: parseFloat(this.gmxV2Balances[symbol]),
          borrowed: 0,
          debtCoverage: data.debtCoverage
        });
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

      let lbTokens = Object.values(this.traderJoeV2LpAssets);

      this.healthAfterTransaction = calculateHealth(tokens, lbTokens);
    },

    setupValidators() {
      this.validators = [
        {
          validate: (value) => {
            if (value > this.getAvailableAssetAmount) {
              return 'Exceeds account balance';
            }
          }
        },
        {
          validate: async (value) => {
            const allowed = this.asset.maxExposure - this.asset.currentExposure;
        
            if (value > allowed) {
              return `Max. allowed amount is ${allowed.toFixed(2)}.`;
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
      if (this.asset.symbol === this.toggleOptions[0]) {
        const balance = this.selectedDepositAsset === this.toggleOptions[0] ? this.walletNativeTokenBalance : this.walletAssetBalance;
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
