<template>
  <div v-if="asset" id="modal" class="repay-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Repay
      </div>

      <div class="modal-top-info">
        <div class="top-info__label">Available:</div>
        <div class="top-info__value"> {{assetAvailableBalances[asset.symbol] | smartRound(10, true)}}</div>
        <div class="top-info__divider"></div>
        <div class="top-info__label">Debt:</div>
        <div class="top-info__value"> {{assetDebt | smartRound(10, true)}}</div>
        <span class="top-info__currency">
          {{asset.symbol}}
        </span>
      </div>

      <CurrencyInput :symbol="asset.symbol"
                     v-on:newValue="repayValueChange"
                     :validators="validators"
                     :max="calculateMaxRepay"
                     :info="() => sourceAssetValue"
      >
      </CurrencyInput>

      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            Values after confirmation:
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
              <BarGaugeBeta :min="0" :max="1" :value="healthAfterTransaction" :slim="true"></BarGaugeBeta>
            </div>
            <div class="summary__divider"></div>
            <div>
              <div class="summary__label">
                Borrowed:
              </div>
              <div class="summary__value">
                {{ (assetDebt - repayValue) > 0 ? assetDebt - repayValue : 0 | smartRound(10, true) }} {{ asset.symbol }}
              </div>
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="button-wrapper">
        <Button :label="'Repay'"
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
import BarGaugeBeta from './BarGaugeBeta';
import {calculateHealth} from "../utils/calculate";
import config from '../config';

export default {
  name: 'WithdrawModal',
  components: {
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal,
    BarGaugeBeta
  },

  props: {
    asset: {},
    health: {},
    initialLoan: {},
    thresholdWeightedValue: {},
    assetDebt: {},
    assetBalances: {},
    assetAvailableBalances: {},
    assets: {},
    debtsPerAsset: {},
    lpAssets: {},
    lpBalances: {},
    concentratedLpAssets: {},
    concentratedLpBalances: {},
    levelLpAssets: {},
    levelLpBalances: {},
    balancerLpAssets: {},
    balancerLpBalances: {},
    penpieLpAssets: {},
    penpieLpBalances: {},
    wombatLpAssets: {},
    wombatLpBalances: {},
    wombatYYFarmsBalances: {},
    traderJoeV2LpAssets: {},
    gmxV2Assets: {},
    gmxV2Balances: {},
    farms: {}
  },

  data() {
    return {
      repayValue: 0,
      healthAfterTransaction: 0,
      transactionOngoing: false,
      validators: [],
      currencyInputError: true,
      maxButtonUsed: false,
      valueAsset: "USDC",
    }
  },

  mounted() {
    setTimeout(() => {
      this.loan = this.initialLoan;
      this.calculateHealthAfterTransaction();
      this.setupValidators();
    })
  },

  computed: {
    calculateMaxRepay() {
      const assetBalance = this.assetAvailableBalances[this.asset.symbol];
      return this.assetDebt < assetBalance ? this.assetDebt : assetBalance;
    },

    isMaxFromDebt() {
      return this.assetDebt < this.assetBalances[this.asset.symbol];
    },

    sourceAssetValue() {
      const nativeSymbol = config.nativeToken;
      const sourceAssetUsdPrice = Number(this.repayValue) * this.asset.price;
      const nativeUsdPrice = config.ASSETS_CONFIG[nativeSymbol].price;

      if (this.valueAsset === "USDC") return `~ $${sourceAssetUsdPrice.toFixed(2)}`;
      // otherwise return amount in AVAX
      return `~ ${(sourceAssetUsdPrice / nativeUsdPrice).toFixed(2)} ${nativeSymbol}`;
    },
  },

  methods: {
    submit() {
      this.transactionOngoing = true;
      const repayValue = (this.maxButtonUsed && this.isMaxFromDebt) ? this.repayValue * config.MAX_BUTTON_MULTIPLIER : this.repayValue;
      this.$emit('REPAY', { repayValue: repayValue, isMax: this.maxButtonUsed && this.isMaxFromDebt });
    },

    repayValueChange(event) {
      this.repayValue = event.value;
      this.currencyInputError = event.error;
      this.maxButtonUsed = event.maxButtonUsed;
      this.calculateHealthAfterTransaction();
    },

    calculateHealthAfterTransaction() {
      let repaid = this.repayValue ? this.repayValue : 0;

      let tokens = [];
      for (const [symbol, data] of Object.entries(this.assets)) {
        let borrowed = this.debtsPerAsset[symbol] ? parseFloat(this.debtsPerAsset[symbol].debt) : 0;
        let balance = parseFloat(this.assetBalances[symbol]);

        if (symbol === this.asset.symbol) {
          borrowed -= repaid;
          balance -= repaid;
        }

        tokens.push({ price: data.price, balance: balance, borrowed: borrowed, debtCoverage: data.debtCoverage});
      }

      for (const [symbol, data] of Object.entries(this.lpAssets)) {
        tokens.push({ price: data.price, balance: parseFloat(this.lpBalances[symbol]), borrowed: 0, debtCoverage: data.debtCoverage});
      }

      for (const [symbol, data] of Object.entries(this.concentratedLpAssets)) {
        tokens.push({ price: data.price, balance: parseFloat(this.concentratedLpBalances[symbol]), borrowed: 0, debtCoverage: data.debtCoverage});
      }

      for (const [symbol, data] of Object.entries(this.levelLpAssets)) {
        tokens.push({ price: data.price, balance: parseFloat(this.levelLpBalances[symbol]), borrowed: 0, debtCoverage: data.debtCoverage});
      }

      for (const [symbol, data] of Object.entries(this.balancerLpAssets)) {
        if (this.balancerLpBalances) {
          let balance = parseFloat(this.balancerLpBalances[symbol]);

          tokens.push({price: data.price, balance: balance ? balance : 0, borrowed: 0, debtCoverage: data.debtCoverage});
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

      this.healthAfterTransaction = calculateHealth(tokens, lbTokens);
    },

    setupValidators() {
      this.validators = [
        {
          validate: (value) => {
            if (value > this.assetAvailableBalances[this.asset.symbol]) {
              return `Not enough funds to repay`;
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
</style>
