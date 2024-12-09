<template>
  <div v-if="asset" id="modal" class="borrow-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Borrow
      </div>

      <div class="modal-top-info">
        <div class="top-info__label">APY:</div>
        <div class="top-info__value">{{ loanAPY | percent }}</div>
        <div class="top-info__divider"></div>
        <div class="top-info__label">Available in pool:</div>
        <div class="top-info__value">
          {{ (availableToBorrow > 0 ? availableToBorrow : 0) | smartRound }}
          <span class="top-info__currency"> {{asset.symbol}}</span>
        </div>
      </div>

      <CurrencyInput :symbol="asset.symbol"
                     :validators="validators"
                     v-on:inputChange="inputChange"
                     v-on:newValue="currencyInputChange"
                     :info="() => sourceAssetValue">
      </CurrencyInput>

      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            Values after transaction:
          </div>
          <div class="summary__horizontal__divider"></div>
          <div class="summary__values">
            <div>
              <div class="summary__label" v-bind:class="{'summary__label--error': healthAfterTransaction === 0}">
                Health:
              </div>
              <div class="summary__value">
              <span class="summary__value--error"
                    v-if="healthAfterTransaction < MIN_ALLOWED_HEALTH">
                {{ healthAfterTransaction | percent }}
              </span>
                <span v-else>
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
                {{ Number(assetBalance) + Number(value) | smartRound }} {{ asset.symbol }}
              </div>
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="button-wrapper">
        <Button :label="'Borrow'" v-on:click="submit()" :disabled="currencyInputError"
                :waiting="transactionOngoing"></Button>
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
import config from '../config';
import {calculateHealth} from '../utils/calculate';

export default {
  name: 'BorrowModal',
  components: {
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal,
    BarGaugeBeta
  },

  props: {
    asset: {},
    assets: {},
    assetBalances: {},
    lpAssets: {},
    lpBalances: {},
    concentratedLpAssets: {},
    concentratedLpBalances: {},
    levelLpAssets: {},
    levelLpBalances: {},
    traderJoeV2LpAssets: {},
    gmxV2Assets: {},
    gmxV2Balances: {},
    balancerLpAssets: {},
    balancerLpBalances: {},
    penpieLpAssets: {},
    penpieLpBalances: {},
    wombatLpAssets: {},
    wombatLpBalances: {},
    wombatYYFarmsBalances: {},
    farms: {},
    debtsPerAsset: {},
    assetBalance: Number,
    debt: Number,
    thresholdWeightedValue: Number,
    loanAPY: Number,
    availableInPool: Number,
    totalBorrowedFromPool: Number,
    poolTVL: Number,
    maxUtilisation: Number,
    availableToBorrow: Number,
  },

  data() {
    return {
      value: 0,
      healthAfterTransaction: 0,
      validators: [],
      currencyInputError: true,
      transactionOngoing: false,
      MIN_ALLOWED_HEALTH: config.MIN_ALLOWED_HEALTH,
      maxBorrow: 0,
      valueAsset: "USDC",
    };
  },

  mounted() {
    setTimeout(() => {
      this.calculateHealthAfterTransaction();
      this.setupValidators();
      this.calculateMaxBorrow();
    });
  },

  computed: {
    sourceAssetValue() {
      const nativeSymbol = config.nativeToken;
      const sourceAssetUsdPrice = Number(this.value) * this.asset.price;
      const nativeUsdPrice = config.ASSETS_CONFIG[nativeSymbol].price;

      if (this.valueAsset === "USDC") return `~ $${sourceAssetUsdPrice.toFixed(2)}`;
      // otherwise return amount in AVAX
      return `~ ${(sourceAssetUsdPrice / nativeUsdPrice).toFixed(2)} ${nativeSymbol}`;
    },
  },

  methods: {
    submit() {
      this.transactionOngoing = true;
      this.$emit('BORROW', this.value);
    },

    inputChange(change) {
      this.value = Number(change);
      this.calculateHealthAfterTransaction();
    },

    currencyInputChange(changeEvent) {
      this.currencyInputError = changeEvent.error;
    },

    calculateHealthAfterTransaction() {
      let addedBorrow = this.value ? this.value : 0;

      let tokens = [];
      for (const [symbol, data] of Object.entries(this.assets)) {
        let borrowed = this.debtsPerAsset[symbol] ? parseFloat(this.debtsPerAsset[symbol].debt) : 0;
        let balance = parseFloat(this.assetBalances[symbol]);
        if (symbol === this.asset.symbol) {
          borrowed += addedBorrow;
          balance += addedBorrow;
        }

        tokens.push({price: data.price ? data.price : 0, balance: balance, borrowed: borrowed, debtCoverage: data.debtCoverage});
      }

      for (const [symbol, data] of Object.entries(this.lpAssets)) {
        tokens.push({
          price: data.price,
          balance: parseFloat(this.lpBalances[symbol]),
          borrowed: 0,
          debtCoverage: data.debtCoverage
        });
      }

      for (const [symbol, data] of Object.entries(this.concentratedLpAssets)) {
        tokens.push({
          price: data.price,
          balance: parseFloat(this.concentratedLpBalances[symbol]),
          borrowed: 0,
          debtCoverage: data.debtCoverage
        });
      }

      for (const [symbol, data] of Object.entries(this.levelLpAssets)) {
        tokens.push({
          price: data.price,
          balance: parseFloat(this.levelLpBalances[symbol]),
          borrowed: 0,
          debtCoverage: data.debtCoverage
        });
      }

      for (const [symbol, data] of Object.entries(this.balancerLpAssets)) {
        if (this.balancerLpBalances) {
          let balance = parseFloat(this.balancerLpBalances[symbol]);

          tokens.push({price: data.price, balance: balance ? balance : 0, borrowed: 0, debtCoverage: data.debtCoverage});
        }
      }

      if (this.penpieLpAssets) {
        for (const [symbol, data] of Object.entries(this.penpieLpAssets)) {
          if (this.penpieLpBalances) {
            let balance = parseFloat(this.penpieLpBalances[symbol]);
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
            balance: parseFloat(farm.totalBalance),
            borrowed: 0,
            debtCoverage: farm.debtCoverage
          });
        });
      }

      let lbTokens = Object.values(this.traderJoeV2LpAssets);

      console.log('tokens: ', tokens)
      console.log('lbTokens: ', tokens)

      this.healthAfterTransaction = calculateHealth(tokens, lbTokens);
    },

    setupValidators() {
      this.validators = [
        {
          validate: (value) => {
            if (this.healthAfterTransaction < this.MIN_ALLOWED_HEALTH) {
              return `Health should be higher than 0%`;
            }
          },
        },
        {
          validate: (value) => {
            if (this.value > this.availableToBorrow) {
              return `You can borrow up to ${this.maxUtilisation * 100}% of this pool's TVL`;
            }
          }
        }
      ];
    },

    calculateMaxBorrow() {
      const MIN_HEALTH = 0.0182;
      const numerator = -this.debt + this.thresholdWeightedValue - MIN_HEALTH;
      const denominator = this.asset.price - (this.asset.price * this.asset.debtCoverage) + (MIN_HEALTH * this.asset.price * this.asset.debtCoverage);
      this.maxBorrow = numerator / denominator;
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";


</style>
