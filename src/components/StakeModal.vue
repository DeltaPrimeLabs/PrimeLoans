<template>
  <div id="modal" class="stake-modal-component modal-component">
    <Modal v-if="asset">
      <div class="modal__title">
        Stake
      </div>

      <div class="modal-top-info">
        <div class="top-info__label">APY:</div>
        <div class="top-info__value">{{ apy | percent }}</div>
        <div class="top-info__divider"></div>
        <div class="top-info__label">Available:</div>
        <div class="top-info__value">{{ available }}
          <span class="top-info__currency"> {{ asset.name }}</span>
        </div>
      </div>

      <CurrencyInput v-if="isLP"
                     :symbol="asset.primary"
                     :symbol-secondary="asset.secondary"
                     v-on:newValue="stakeValueChange"
                     :validators="validators"
                     :max="available"
                     :info="() => sourceAssetValue">
      </CurrencyInput>
      <CurrencyInput ref="currencyInput"
                     v-else
                     :symbol="asset.symbol"
                     :logo="assetLogo"
                     :force-asset-name="forceAssetName"
                     v-on:newValue="stakeValueChange"
                     :validators="validators"
                     :max="available"
                     :info="() => sourceAssetValue">
      </CurrencyInput>
      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            Values after confirmation:
          </div>
          <div class="summary__horizontal__divider"></div>
          <div class="summary__values" v-if="asset">
            <div class="summary__value__pair">
              <div class="summary__label">
                Balance:
              </div>
              <div class="summary__value">
                {{ (Number(available) - Number(stakeValue)) > 0 ? Number(available) - Number(stakeValue) : 0 | smartRound(8, true) }}
                <div class="currency">
                  {{asset.name}}
                </div>
              </div>
            </div>
            <div class="summary__divider divider--super-long"></div>
            <div class="summary__value__pair">

              <div class="summary__label">
                Staked:
              </div>
              <div class="summary__value">
                {{ Number(underlyingTokenStaked) + Number(stakeValue) | smartRound(8, true) }}
              </div>
            </div>
            <div class="summary__divider divider--super-long"></div>
            <div class="summary__value__pair">

              <div class="summary__label">
                Mean daily interest (365D):
              </div>
              <div class="summary__value">
                ≈ $ {{ calculateDailyInterest | smartRound(10, true) }}
              </div>
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="button-wrapper">
        <Button :label="'Stake'"
                @click="submit"
                :disabled="currencyInputError"
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
import config from '../config';

export default {
  name: 'StakeModal',
  components: {
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal
  },

  props: {
    apy: {},
    available: {},
    underlyingTokenStaked: {},
    asset: {},
    isLp: false,
    protocol: null,
    assetLogo: null,
    forceAssetName: null,
  },

  data() {
    return {
      stakeValue: 0,
      validators: [],
      transactionOngoing: false,
      currencyInputError: true,
      maxButtonUsed: false,
      valueAsset: "USDC",
    };
  },

  mounted() {
    this.setupValidators();
  },
  computed: {
    calculateDailyInterest() {
      return (this.apy / 365 * (Number(this.underlyingTokenStaked) + Number(this.stakeValue))) * this.asset.price;
    },

    sourceAssetValue() {
      const nativeSymbol = config.nativeToken;
      const sourceAssetUsdPrice = Number(this.stakeValue) * this.asset.price;
      const nativeUsdPrice = config.ASSETS_CONFIG[nativeSymbol].price;

      if (this.valueAsset === "USDC") return `~ $${sourceAssetUsdPrice.toFixed(2)}`;
      // otherwise return amount in AVAX
      return `~ ${(sourceAssetUsdPrice / nativeUsdPrice).toFixed(2)} ${nativeSymbol}`;
    },
  },

  methods: {
    submit(event) {
      this.transactionOngoing = true;
      const stakeValue = this.maxButtonUsed ? parseFloat(this.stakeValue) * config.MAX_BUTTON_MULTIPLIER : parseFloat(this.stakeValue);
      this.$emit('STAKE', {
        stakeValue: stakeValue.toFixed(this.asset.decimals),
        forceTransaction: Boolean(event.metaKey)
      });
    },


    stakeValueChange(event) {
      this.stakeValue = event.value;
      this.currencyInputError = event.error;
      this.maxButtonUsed = event.maxButtonUsed;
    },

    setupValidators() {
      this.validators = [
        {
          validate: (value) => {
            if (value > this.available) {
              return `Exceeds available`;
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
