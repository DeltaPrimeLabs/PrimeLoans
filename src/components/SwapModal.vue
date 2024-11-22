<template>
  <div id="modal" class="swap-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Swap
      </div>
      <div class="asset-info">
        Available:
        <span v-if="sourceAssetBalance" class="asset-info__value">{{ Number(sourceAssetBalance) | smartRound }}</span>
      </div>
      <CurrencyComboInput ref="sourceInput"
                          :asset-options="sourceAssetOptions"
                          :validators="sourceValidators"
                          :disabled="checkingPrices"
                          :max="sourceAssetBalance"
                          :info="() => `~ $${(Number(sourceAssetAmount) * sourceAssetData.price).toFixed(2)}`"
                          :typingTimeout="2000"
                          v-on:valueChange="sourceInputChange"
                          v-on:ongoingTyping="ongoingTyping"
      >
      </CurrencyComboInput>

      <div class="reverse-swap-button">
        <img src="src/assets/icons/swap-arrow.svg" class="reverse-swap-icon" v-on:click="reverseSwap">
      </div>

      <CurrencyComboInput ref="targetInput"
                          :asset-options="targetAssetOptions"
                          v-on:valueChange="targetInputChange"
                          :info="() => `~ $${(Number(targetAssetAmount) * targetAssetData.price).toFixed(2)}`"
                          :disabled="true"
                          :validators="targetValidators">
      </CurrencyComboInput>
      <div class="target-asset-info">
        <div class="usd-info">
          Price:&nbsp;<span
            class="price-info__value">1 {{ targetAsset }} = {{ estimatedNeededTokens / estimatedReceivedTokens | smartRound }} {{ sourceAsset }}</span>
        </div>
      </div>

      <div class="slippage-bar">
        <div class="slippage-info">
          <span class="slippage-label">Max. acceptable slippage:</span>
          <SimpleInput :percent="true" :default-value="userSlippage" v-on:newValue="userSlippageChange"></SimpleInput>
          <span class="percent">%</span>
        </div>
        <div class="slippage__divider"></div>
        DEX slippage: <span class="deviation-value">{{marketDeviation}}<span class="percent">%</span></span>
        <div class="info__icon__wrapper">
          <img class="info__icon"
               src="src/assets/icons/info.svg"
               v-tooltip="{content: 'The difference between DEX and market prices.', placement: 'top', classes: 'info-tooltip'}">
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
              <div class="summary__label"
                   v-bind:class="{'summary__label--error': healthAfterTransaction < MIN_ALLOWED_HEALTH}">
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
                <BarGaugeBeta :min="0" :max="1" :value="healthAfterTransaction" :slim="true"
                              :display-inline="true"></BarGaugeBeta>
              </div>
            </div>
            <div class="summary__divider divider--long light"></div>
            <div class="summary__value__pair">
              <div class="summary__label">
                {{ sourceAsset }} balance:
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
                {{ targetAsset }} balance:
              </div>
              <div class="summary__value">
                {{ formatTokenBalance(Number(assetBalances[targetAsset]) + Number(targetAssetAmount)) }}
              </div>
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="button-wrapper">
        <Button :label="'Swap'"
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
import {calculateHealth, formatUnits, parseUnits} from '../utils/calculate';
import {BigNumber} from "ethers";
import TOKEN_ADDRESSES from '../../common/addresses/avax/token_addresses.json';
import YAK_ROUTER from '../../test/abis/YakRouter.json';
import SimpleInput from "./SimpleInput";
const ethers = require('ethers');

export default {
  name: 'SwapModal',
  components: {
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
      sourceAssetOptions: [],
      targetAssetOptions: [],
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
      lastChangedSource: true,
      sourceValidators: [],
      sourceWarnings: [],
      slippageWarning: '',
      targetValidators: [],
      sourceInputError: true,
      targetInputError: false,
      checkingPrices: false,
      isTyping: false,
      marketDeviation: 0,
      MIN_ALLOWED_HEALTH: config.MIN_ALLOWED_HEALTH,
      healthAfterTransaction: 0,
      assetBalances: {},
      assets: {},
      debtsPerAsset: {},
      lpAssets: {},
      lpBalances: {},
      transactionOngoing: false,
      debt: 0,
      thresholdWeightedValue: 0,
      chosenDex: config.DEX_CONFIG[0],
      estimatedReceivedTokens: 0,
      estimatedNeededTokens: 0,
      receivedAccordingToOracle: 0,
      neededAccordingToOracle: 0,
      path: null,
      adapters: null,
      maxButtonUsed: false,
    };
  },

  mounted() {
    this.setupSourceAssetOptions();
    this.setupTargetAssetOptions();
    setTimeout(() => {
      this.setupSourceAsset();
      this.setupTargetAsset();
      this.setupValidators();
      this.setupWarnings();
      this.calculateHealthAfterTransaction();
    });
  },

  computed: {
  },

  methods: {
    submit() {
      this.transactionOngoing = true;
      const sourceAssetAmount = this.maxButtonUsed ? this.sourceAssetAmount * config.MAX_BUTTON_MULTIPLIER : this.sourceAssetAmount;
      this.$emit('SWAP', {
        sourceAsset: this.sourceAsset,
        targetAsset: this.targetAsset,
        sourceAmount: sourceAssetAmount,
        targetAmount: this.targetAssetAmount,
        path: this.path,
        adapters: this.adapters
      });
    },

    async query(tknFrom, tknTo, amountIn) {
      const yakRouter = new ethers.Contract(config.yakRouterAddress, YAK_ROUTER, provider.getSigner());

      const maxHops = 3
      const gasPrice = ethers.utils.parseUnits('225', 'gwei')

      return await yakRouter.findBestPathWithGas(
          amountIn,
          tknFrom,
          tknTo,
          maxHops,
          gasPrice,
          { gasLimit: 1e9 }
      )
    },

    async chooseBestTrade(basedOnSource = true) {
      if (this.sourceAssetAmount == null) return;
      if (this.sourceAssetAmount === 0) {
        this.targetAssetAmount = 0;
        return;
      }

      this.lastChangedSource = true;
      let decimals = this.sourceAssetData.decimals;
      let amountInWei = parseUnits(this.sourceAssetAmount.toFixed(decimals), BigNumber.from(decimals));

      const queryRes = await this.query(TOKEN_ADDRESSES[this.sourceAsset], TOKEN_ADDRESSES[this.targetAsset], amountInWei);

      this.path = queryRes.path;
      this.adapters = queryRes.adapters;
      const estimatedReceivedTokens = queryRes.amounts[queryRes.amounts.length - 1];

      this.estimatedReceivedTokens = parseFloat(formatUnits(estimatedReceivedTokens, BigNumber.from(this.targetAssetData.decimals)));

      this.updateSlippageWithAmounts();
      this.calculateHealthAfterTransaction();
    },

    async updateAmountsWithSlippage() {
      console.log('slippage');
      this.targetAssetAmount = this.receivedAccordingToOracle * (1 - this.userSlippage / 100);
      const targetInputChangeEvent = await this.$refs.targetInput.setCurrencyInputValue(this.targetAssetAmount);
      this.setSlippageWarning();
    },

    async updateSlippageWithAmounts() {
      let dexSlippage = 0;
      this.receivedAccordingToOracle = this.estimatedNeededTokens * this.sourceAssetData.price / this.targetAssetData.price;
      dexSlippage = (this.receivedAccordingToOracle - this.estimatedReceivedTokens) / this.estimatedReceivedTokens;

      const SLIPPAGE_MARGIN = 0.1;
      this.marketDeviation = parseFloat((100 * dexSlippage).toFixed(3));

      let updatedSlippage = SLIPPAGE_MARGIN + 100 * dexSlippage;

      this.userSlippage = parseFloat(updatedSlippage.toFixed(3));

      await this.updateAmountsWithSlippage();
    },

    setSlippageWarning() {
      this.slippageWarning = '';
      if (this.userSlippage > 2) { this.slippageWarning =  'Slippage exceeds 2%. Be careful.' }
      else if (this.userSlippage < this.marketDeviation) { this.slippageWarning =  'Slippage below current DEX slippage. Transaction will likely fail.' }
      else if (parseFloat((this.userSlippage - this.marketDeviation).toFixed(3)) < 0.1) { this.slippageWarning =  'Slippage close to current DEX slippage. Transaction can fail.' }
      },

    setupSourceAssetOptions() {
      Object.keys(config.ASSETS_CONFIG).forEach(assetSymbol => {
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
      this.targetAssetOptions = JSON.parse(JSON.stringify(this.sourceAssetOptions));
      this.targetAssetOptions = this.targetAssetOptions.filter(option => option.symbol !== this.sourceAsset);
    },

    setupSourceAsset() {
      this.$refs.sourceInput.setSelectedAsset(this.sourceAsset, true);
      this.sourceAssetData = config.ASSETS_CONFIG[this.sourceAsset];
    },

    setupTargetAsset() {
      if (this.targetAsset) {
        this.$refs.targetInput.setSelectedAsset(this.targetAsset, true);
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
          this.estimatedNeededTokens = value;

          if (value !== 0) {
            await this.chooseBestTrade();
          } else {
            this.targetAssetAmount = 0;
            this.estimatedReceivedTokens = 0;
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

    async delay(ms) { return new Promise(res => setTimeout(res, ms)) },

    reverseSwap() {
      const tempSource = this.sourceAsset;
      this.sourceAssetData = config.ASSETS_CONFIG[this.targetAsset]
      this.targetAssetData = config.ASSETS_CONFIG[this.sourceAsset]
      this.sourceAsset = this.targetAsset;
      this.targetAsset = tempSource;

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
              return 'Amount exceeds the current balance.';
            }
          }
        },
      ];
      this.targetValidators = [
        {
          validate: async (value) => {
            if (this.healthAfterTransaction < this.MIN_ALLOWED_HEALTH) {
              return 'The health is below allowed limit.';
            }
          }
        },
      ];
    },

    calculateHealthAfterTransaction() {
      let tokens = [];
      for (const [symbol, data] of Object.entries(this.assets)) {
        let borrowed = this.debtsPerAsset[symbol] ? parseFloat(this.debtsPerAsset[symbol].debt) : 0;
        let balance = parseFloat(this.assetBalances[symbol]);

        if (symbol === this.sourceAsset) {
          balance -= this.sourceAssetAmount;
        }

        if (symbol === this.targetAsset) {
          balance += this.targetAssetAmount;
        }

        tokens.push({ price: data.price, balance: balance, borrowed: borrowed, debtCoverage: data.debtCoverage});
      }

      for (const [symbol, data] of Object.entries(this.lpAssets)) {
        tokens.push({ price: data.price, balance: parseFloat(this.lpBalances[symbol]), borrowed: 0, debtCoverage: data.debtCoverage});
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

      this.healthAfterTransaction = calculateHealth(tokens);
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
    color: $steel-gray;
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
    color: $steel-gray;
    margin-top: 3px;

    .asset-info__value {
      margin-left: 5px;
    }

    .price-info__value {
      font-weight: 600;
    }
  }

  .reverse-swap-button {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    margin-top: 40px;

    .reverse-swap-icon {
      width: 52px;
      height: 52px;
      margin: -6px 0 14px 0;
    }
  }
}

.received-amount {
  display: flex;
  font-size: 14px;
  color: #7d7d7d;
}

.target-asset-info {
  display: flex;
  justify-content: flex-end;
}

.slippage-bar {
  border-top: solid 2px #f0f0f0;
  border-bottom: solid 2px #f0f0f0;
  margin-top: 26px;
  height: 42px;
  font-family: Montserrat;
  font-size: 16px;
  color: #7d7d7d;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-left: 15px;
  padding-right: 15px;

  .info__icon {
    transform: translateY(-1px);
  }

  .percent {
    font-weight: 600;
  }

  .slippage-info {
    display: flex;
    align-items: center;

    .percent {
      margin-left: 6px;
    }

    .slippage-label {
      margin-right: 6px;
    }
  }

  .deviation-value {
    font-weight: 600;
  }

  .slippage__divider {
    width: 2px;
    height: 17px;
    background-color: #f0f0f0;
    margin: 0 10px;
  }
}

.bar-gauge-tall-wrapper {
  padding-top: 5px;
}

.slippage-warning {
  color: $red;
  margin-top: 4px;

  img {
    width: 20px;
    height: 20px;
    transform: translateY(-1px);
  }
}

</style>