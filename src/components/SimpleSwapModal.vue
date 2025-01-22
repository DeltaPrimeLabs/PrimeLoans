<template>
  <div id="modal" class="swap-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Swap deposit
      </div>
      <div class="asset-info">
        Deposited:
        <span v-if="sourceAssetBalance" class="asset-info__value">{{
            Number(sourceAssetBalance) | smartRound(10, true)
          }}</span>
      </div>

      <CurrencyComboInput ref="sourceInput"
                          :asset-options="sourceAssetOptions"
                          :default-asset="sourceAsset"
                          :validators="sourceValidators"
                          :disabled="checkingPrices"
                          :info="() => sourceAssetValue"
                          :typingTimeout="2000"
                          v-on:valueChange="sourceInputChange"
                          v-on:ongoingTyping="ongoingTyping"
      >
      </CurrencyComboInput>

      <div class="reverse-swap-button" v-on:click="reverseSwap">
        <DeltaIcon class="reverse-swap-icon" :size="22" :icon-src="'src/assets/icons/swap-arrow.svg'"></DeltaIcon>
      </div>

      <CurrencyComboInput ref="targetInput"
                          :asset-options="targetAssetOptions"
                          :default-asset="targetAsset"
                          v-on:valueChange="targetInputChange"
                          :info="() => targetAssetValue"
                          :disabled="true"
                          info-icon-message="Minimum received amount"
                          :validators="targetValidators">
      </CurrencyComboInput>
      <div class="target-asset-info">
        <div class="usd-info"
             v-bind:style="{ 'visibility': estimatedNeededTokens !== 0 && estimatedNeededTokens !== 0 ? 'visible' : 'hidden' }"
        >
          Price:&nbsp;<span
          class="price-info__value">1 {{
            targetAsset
          }} = {{ estimatedNeededTokens / estimatedReceivedTokens | smartRound }} {{ sourceAsset }}</span>
        </div>
      </div>

      <div class="slippage-bar">
        <div class="slippage-info">
          <span class="slippage-label">Max. acceptable slippage:</span>
          <SimpleInput :percent="true" :default-value="userSlippage" v-on:newValue="userSlippageChange"></SimpleInput>
          <span class="percent">%</span>
        </div>
        <div class="slippage__divider"></div>
        DEX slippage: <span class="deviation-value">{{ marketDeviation }}<span class="percent">%</span></span>
        <div class="info__icon__wrapper">
          <InfoIcon
            class="info__icon"
            :tooltip="{content: 'The difference between DEX and market prices.', placement: 'top', classes: 'info-tooltip'}"
          ></InfoIcon>
        </div>
      </div>
      <div v-if="slippageWarning" class="slippage-warning">
        <img src="src/assets/icons/error.svg"/>
        {{ slippageWarning }}
      </div>

      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            Values after transaction
          </div>
          <div class="summary__horizontal__divider"></div>
          <div class="summary__values">

            <div class="summary__value__pair">
              <div class="summary__label">
                {{ sourceAsset }} deposit:
              </div>
              <div class="summary__value">
                {{
                  formatTokenBalance(Number(assetBalances[sourceAsset]) - Number(sourceAssetAmount)) > 0 ? formatTokenBalance(Number(assetBalances[sourceAsset]) - Number(sourceAssetAmount)) : 0
                }}
              </div>
            </div>

            <div class="summary__divider divider--long light"></div>

            <div class="summary__value__pair">
              <div class="summary__label">
                {{ targetAsset }} deposit:
              </div>
              <div class="summary__value">
                {{ formatTokenBalance(Number(assetBalances[targetAsset]) + Number(targetAssetAmount)) }}
              </div>
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="button-wrapper">
        <Button :label="'Swap deposit'"
                v-on:click="submit()"
                :disabled="sourceInputError || targetInputError"
                :waiting="transactionOngoing || isTyping">
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
import CurrencyComboInput from './CurrencyComboInput';
import BarGaugeBeta from './BarGaugeBeta';
import config from '../config';
import {formatUnits, parseUnits} from '../utils/calculate';
import {BigNumber} from 'ethers';
import SimpleInput from './SimpleInput';
import DeltaIcon from './DeltaIcon.vue';
import InfoIcon from './InfoIcon.vue';
import {constructSimpleSDK} from "@paraswap/sdk";
import axios from "axios";
import {getSwapData} from "../utils/paraSwapUtils";

const ethers = require('ethers');
let TOKEN_ADDRESSES;

export default {
  name: 'SimpleSwapModal',
  components: {
    InfoIcon,
    DeltaIcon,
    SimpleInput,
    CurrencyComboInput,
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal,
    BarGaugeBeta
  },

  props: {},

  data() {
    return {
      sourceAssets: null,
      targetAssets: null,
      sourceAssetOptions: null,
      targetAssetOptions: null,
      sourceAsset: null,
      targetAsset: null,
      sourceAssetData: null,
      targetAssetData: null,
      sourceAssetBalance: 0,
      targetAssetBalance: null,
      conversionRate: null,
      sourceAssetAmount: 0,
      targetAssetAmount: 0,
      userSlippage: 0,
      queryMethod: null,
      sourceValidators: [],
      sourceWarnings: [],
      slippageWarning: '',
      targetValidators: [],
      sourceInputError: true,
      targetInputError: false,
      checkingPrices: false,
      isTyping: false,
      marketDeviation: 0,
      assetBalances: {},
      transactionOngoing: false,
      thresholdWeightedValue: 0,
      estimatedReceivedTokens: 0,
      estimatedNeededTokens: 0,
      receivedAccordingToOracle: 0,
      neededAccordingToOracle: 0,
      path: null,
      adapters: null,
      maxButtonUsed: false,
      assetPrices: {},
      swapData: {},
    };
  },

  mounted() {
    setTimeout(async () => {
      await this.setupFiles();
      this.setupSourceAssetOptions();
      this.setupTargetAssetOptions();
      this.setupSourceAsset();
      this.setupTargetAsset();
      this.setupValidators();
      this.setupWarnings();
    });
  },

  computed: {
    sourceAssetValue() {
      const sourceAssetUsdPrice = Number(this.sourceAssetAmount) * this.assetPrices[this.sourceAssetData.symbol];
      return `~ $${sourceAssetUsdPrice.toFixed(2)}`;
    },

    targetAssetValue() {
      const targetAssetUsdPrice = Number(this.targetAssetAmount) * this.assetPrices[this.targetAssetData.symbol];
      return `~ $${targetAssetUsdPrice.toFixed(2)}`;
    }
  },

  methods: {
    async setupFiles() {
      TOKEN_ADDRESSES = await import(`/common/addresses/${window.chain}/token_addresses.json`);
    },
    submit() {
      this.transactionOngoing = true;
      const sourceAssetAmount = this.maxButtonUsed ? this.sourceAssetAmount * config.MAX_BUTTON_MULTIPLIER : this.sourceAssetAmount;
      this.$emit('SWAP', {
        sourceAsset: this.sourceAsset,
        targetAsset: this.targetAsset,
        sourceAmount: sourceAssetAmount,
        targetAmount: this.targetAssetAmount,
        swapData: this.swapData
      });
    },

    async query(sourceAsset, targetAsset, amountIn) {
      let queryResult = await this.queryMethod(sourceAsset, targetAsset, amountIn);
      console.log('queryResult', queryResult);
      return queryResult;
    },

    async chooseBestTrade(basedOnSource = true) {
      console.log('chooseBestTrade', basedOnSource);
      if (this.sourceAssetAmount == null) return;
      if (this.sourceAssetAmount === 0) {
        this.targetAssetAmount = 0;
        return;
      }

      let decimals = this.sourceAssetData.decimals;
      let amountInWei = parseUnits(this.sourceAssetAmount.toFixed(decimals), BigNumber.from(decimals));

      console.log(amountInWei);

      const sourceAssetAddress = TOKEN_ADDRESSES[this.sourceAsset];
      const targetAssetAddress = TOKEN_ADDRESSES[this.targetAsset];
      const paraSwapSDK = constructSimpleSDK({chainId: config.chainId, axios});
      console.log('config.ASSETS_CONFIG[this.targetAsset].decimals', config.ASSETS_CONFIG[this.targetAsset].decimals);
      console.log('config.ASSETS_CONFIG[this.targetAsset].decimals', config.ASSETS_CONFIG[this.sourceAsset].decimals);
      console.log(this.sourceAsset);
      console.log(this.targetAsset);
      const swapData = await getSwapData(
        paraSwapSDK,
        config.depositSwapAddress,
        sourceAssetAddress,
        targetAssetAddress,
        amountInWei,
        config.ASSETS_CONFIG[this.sourceAsset].decimals,
        config.ASSETS_CONFIG[this.targetAsset].decimals,
      );
      this.swapData = swapData;
      console.log(this.swapData.simpleData);

      const estimated = swapData.simpleData.destAmount;

      this.estimatedNeededTokens = this.sourceAssetAmount;
      this.estimatedReceivedTokens = parseFloat(formatUnits(estimated, BigNumber.from(this.targetAssetData.decimals)));
      console.log(this.estimatedReceivedTokens);

      this.updateSlippageWithAmounts();

    },

    async updateAmountsWithSlippage() {
      this.targetAssetAmount = this.receivedAccordingToOracle * (1 - this.userSlippage / 100);
      const targetInputChangeEvent = await this.$refs.targetInput.setCurrencyInputValue(this.targetAssetAmount);
      this.setSlippageWarning();
    },

    async updateSlippageWithAmounts() {
      let dexSlippage = 0;
      this.receivedAccordingToOracle = this.estimatedNeededTokens * this.assetPrices[this.sourceAssetData.symbol] / this.assetPrices[this.targetAssetData.symbol];
      dexSlippage = (this.receivedAccordingToOracle - this.estimatedReceivedTokens) / this.estimatedReceivedTokens;

      const SLIPPAGE_MARGIN = 0.3;
      this.marketDeviation = parseFloat((100 * dexSlippage).toFixed(3));

      let updatedSlippage = SLIPPAGE_MARGIN + 100 * dexSlippage;

      this.userSlippage = parseFloat(updatedSlippage.toFixed(3));

      await this.updateAmountsWithSlippage();
    },

    setSlippageWarning() {
      this.slippageWarning = '';
      if (this.userSlippage > 2) {
        this.slippageWarning = 'Slippage exceeds 2%. Be careful.';
      } else if (this.userSlippage < this.marketDeviation) {
        this.slippageWarning = 'Slippage below current DEX slippage. Transaction will likely fail.';
      } else if (parseFloat((this.userSlippage - this.marketDeviation).toFixed(3)) < 0.1) {
        this.slippageWarning = 'Slippage close to current DEX slippage. Transaction can fail.';
      }
    },

    setupSourceAssetOptions() {
      this.sourceAssetOptions = [];
      console.log('this.sourceAssets', this.sourceAssets);
      this.sourceAssets.forEach(assetSymbol => {
        console.log(assetSymbol);
        const asset = config.ASSETS_CONFIG[assetSymbol];
        const assetOption = {
          symbol: assetSymbol,
          name: asset.name,
          logo: `src/assets/logo/${assetSymbol.toLowerCase()}.${asset.logoExt ? asset.logoExt : 'svg'}`
        };
        this.sourceAssetOptions.push(assetOption);
      });
    },

    setupTargetAssetOptions() {
      this.targetAssetOptions = [];
      this.targetAssets.forEach(assetSymbol => {
        const asset = config.ASSETS_CONFIG[assetSymbol];
        const assetOption = {
          symbol: assetSymbol,
          name: asset.name,
          logo: `src/assets/logo/${assetSymbol.toLowerCase()}.${asset.logoExt ? asset.logoExt : 'svg'}`
        };
        this.targetAssetOptions.push(assetOption);
      });

      this.targetAssetOptions = this.targetAssetOptions.filter(option => option.symbol !== this.sourceAsset);
    },

    setupSourceAsset() {
      this.sourceAssetData = config.ASSETS_CONFIG[this.sourceAsset];
    },

    setupTargetAsset() {
      if (this.targetAsset) {
        this.targetAssetData = config.ASSETS_CONFIG[this.targetAsset];
      }
    },

    async sourceInputChange(changeEvent) {
      console.log(changeEvent);
      this.maxButtonUsed = changeEvent.maxButtonUsed;
      this.checkingPrices = true;
      let targetInputChangeEvent;
      if (changeEvent.asset === this.targetAsset) {
        this.reverseSwap();
      } else {
        if (this.sourceAsset !== changeEvent.asset) {
          this.sourceAsset = changeEvent.asset;
          this.calculateSourceAssetBalance();
          this.sourceAssetData = config.ASSETS_CONFIG[this.sourceAsset];
          await this.chooseBestTrade(false);
        } else {
          let value = Number.isNaN(changeEvent.value) ? 0 : changeEvent.value;
          this.sourceAssetAmount = value;

          if (value !== 0) {
            await this.chooseBestTrade();
          } else {
            this.targetAssetAmount = 0;
            this.estimatedReceivedTokens = 0;
            this.estimatedNeededTokens = 0;
            await this.$refs.targetInput.setCurrencyInputValue(0);
          }
        }
      }

      this.sourceInputError = changeEvent.error;
      if (targetInputChangeEvent) {
        this.targetInputError = targetInputChangeEvent.error;
      }
      this.checkingPrices = false;
    },

    async targetInputChange(changeEvent) {
      let sourceInputChangeEvent;

      if (changeEvent.asset === this.sourceAsset) {
        this.reverseSwap();
      } else {
        if (this.targetAsset !== changeEvent.asset) {
          this.targetAsset = changeEvent.asset;
          this.targetAssetData = config.ASSETS_CONFIG[this.targetAsset];
          await this.chooseBestTrade(true);
        } else {
          this.targetAssetAmount = changeEvent.value;
          this.estimatedReceivedTokens = changeEvent.value;
          await this.chooseBestTrade(false);
        }

      }
      this.targetInputError = changeEvent.error;
      if (sourceInputChangeEvent) {
        this.sourceInputError = sourceInputChangeEvent.error;
      }
    },

    ongoingTyping(event) {
      this.isTyping = event.typing;
    },

    async userSlippageChange(changeEvent) {
      this.userSlippage = changeEvent.value ? changeEvent.value : 0;

      await this.updateAmountsWithSlippage();
    },

    calculateSourceAssetBalance() {
      const sourceAssetBalance = this.assetBalances[this.sourceAsset];
      this.sourceAssetBalance = sourceAssetBalance;
    },

    async delay(ms) {
      return new Promise(res => setTimeout(res, ms));
    },

    reverseSwap() {
      const tempSource = this.sourceAsset;
      this.sourceAssetData = config.ASSETS_CONFIG[this.targetAsset];
      this.targetAssetData = config.ASSETS_CONFIG[this.sourceAsset];
      this.sourceAsset = this.targetAsset;
      this.targetAsset = tempSource;

      const tempSourceAssetsOptions = this.sourceAssetOptions;
      this.sourceAssetOptions = this.targetAssetOptions;
      this.targetAssetOptions = tempSourceAssetsOptions;

      this.setupSourceAsset();
      this.setupTargetAsset();

      this.chooseBestTrade();

      this.calculateSourceAssetBalance();
    },
    setupWarnings() {
    },
    setupValidators() {
      this.sourceValidators = [
        {
          validate: async (value) => {
            if (value > parseFloat(this.assetBalances[this.sourceAsset])) {
              return 'Amount exceeds the current deposit.';
            }
          }
        },
      ];
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";

.swap-modal-component {

  .modal__title {
    margin-bottom: 53px;
  }

  .asset-info {
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
    font-size: $font-size-xsm;
    color: var(--swap-modal__asset-info-color);
    padding-right: 8px;

    .asset-info__value {
      font-weight: 600;
      margin-left: 5px;
    }
  }

  .usd-info {
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    font-size: $font-size-xsm;
    color: var(--swap-modal__usd-info-color);
    margin-top: 3px;

    .asset-info__value {
      margin-left: 5px;
    }

    .price-info__value {
      font-weight: 600;
    }
  }

  .reverse-swap-button {
    position: relative;
    cursor: pointer;
    margin: 28px auto;
    height: 40px;
    width: 40px;
    border: var(--swap-modal__reverse-swap-button-border);
    background: var(--swap-modal__reverse-swap-button-background);
    box-shadow: var(--swap-modal__reverse-swap-button-box-shadow);
    border-radius: 999px;

    .reverse-swap-icon {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: var(--swap-modal__reverse-swap-icon-color);
    }
  }
}

.received-amount {
  display: flex;
  font-size: 14px;
  color: var(--swap-modal__received-amount-color);
}

.target-asset-info {
  display: flex;
  justify-content: flex-end;
}

.bar-gauge-tall-wrapper {
  padding-top: 5px;
}

.slippage-warning {
  color: var(--swap-modal__slippage-warning-color);
  margin-top: 4px;

  img {
    width: 20px;
    height: 20px;
    transform: translateY(-1px);
  }
}

</style>
