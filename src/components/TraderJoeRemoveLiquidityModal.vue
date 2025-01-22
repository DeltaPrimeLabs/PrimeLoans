<template>
  <div id="modal" v-if="lpToken" class="remove-liquidity-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Remove LB position
      </div>
      <div class="modal-top-desc">
          This transaction can take up to a minute to perform.
        <br>
      </div>
      <div class="liquidity-option">
        <div class="label-with-separator">
          Price range
        </div>
        <div class="liquidity-option__content price-slider-wrapper">
          <RangeSlider
            :min="minMaxRange[0]"
            :max="minMaxRange[1]"
            :value="selectedRange"
            :indicator="activeId"
            @input="updateBinRange"
          ></RangeSlider>
          <div class="price-range-inputs">
            <div class="price__input">
              <div class="input-label"><b>Min Price</b> | {{ secondAsset.symbol }} per {{ firstAsset.symbol }}</div>
              <FormInput
                :default-value="selectedRange && getBinPrice(selectedRange[0])"
                :fontSize="18"
                :disabled="true"
              ></FormInput>
            </div>
            <div class="price__input">
              <div class="input-label"><b>Max Price</b> | {{ secondAsset.symbol }} per {{ firstAsset.symbol }}</div>
              <FormInput
                :default-value="selectedRange && getBinPrice(selectedRange[1])"
                :fontSize="18"
                :disabled="true"
              ></FormInput>
            </div>
          </div>
        </div>
      </div>

      <Alert v-if="!hasLiquidityInRange">
        Liquidity not found in the range
      </Alert>

      <div class="slippage-bar">
        <div class="slippage__divider"></div>
        <div class="slippage-info">
          <span class="slippage-label">Max. amounts slippage:</span>
          <SimpleInput :percent="true" :default-value="amountsSlippage" v-on:newValue="amountsSlippageChange"></SimpleInput>
          <span class="percent">%</span>
        </div>
      </div>

      <div class="button-wrapper">
        <Button :label="'Remove Liquidity'"
                @click="submit"
                :waiting="transactionOngoing"
                :disabled="!hasLiquidityInRange">
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
import InfoIcon from './InfoIcon.vue';
import RangeSlider from './RangeSlider';
import FormInput from './FormInput';
import Alert from './Alert.vue';
import SimpleInput from "./SimpleInput.vue";
import {getBinPrice} from "../utils/calculate";

export default {
  name: 'RemoveLiquidityModal',
  components: {
    SimpleInput,
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal,
    BarGaugeBeta,
    Toggle,
    InfoIcon,
    RangeSlider,
    FormInput,
    Alert
  },

  props: {
    lpToken: {},
    firstAsset: null,
    secondAsset: null,
    firstAssetBalance: Number,
    secondAssetBalance: Number,
    activeId: null,
    binStep: null,
    binIds: []
  },

  data() {
    return {
      selectedRange: [],
      minMaxRange: [],
      transactionOngoing: false,
      priceRadius: 5,
      maxPriceRadius: 29,
      minAboveActive: false,
      maxBelowActive: false,
      hasLiquidityInRange: false,
      amountsSlippage: 0.5
    };
  },

  mounted() {
    setTimeout(() => {
      this.setupSlider();
    });
  },

  watch: {
    selectedRange: {
      handler(newRange) {
        if (!this.binIds) return;
        this.hasLiquidityInRange = this.binIds.some(binId => binId >= newRange[0] && binId <= newRange[1]);
      },
      immediate: true
    }
  },

  methods: {
    setupSlider() {
      console.log(this.binIds);
      this.minMaxRange = [this.binIds[0], this.binIds[this.binIds.length - 1]];
      this.selectedRange = [this.binIds[0], this.binIds[this.binIds.length - 1]];
    },

    getBinPrice(binId) {
      const binPrice = (1 + this.binStep / 10000) ** (binId - 8388608) * 10 ** (this.firstAsset.decimals - this.secondAsset.decimals);
      return this.formatTokenBalance(binPrice, 8, true)
    },

    submit(event) {
      this.transactionOngoing = true;

      console.log(event);

      const selectedBinIds = Array.from(
        { length: this.selectedRange[1] - this.selectedRange[0] + 1 },
        (value, index) => this.selectedRange[0] + index
      );

      const removeLiquidityEvent = {
        binIdsToRemove: selectedBinIds.filter(binId => this.binIds.indexOf(binId) !== -1),
        remainingBinIds: this.binIds.filter((binId) => binId < this.selectedRange[0] || binId > this.selectedRange[1]),
        allowedAmountsSlippage: this.amountsSlippage,
        forceTransaction: Boolean(event.metaKey)
      };

      console.log(removeLiquidityEvent);

      this.$emit('REMOVE_LIQUIDITY', removeLiquidityEvent);
    },

    updateBinRange(event) {
      let newRange = event.value;
      this.selectedRange = newRange;
      if (this.activeId < newRange[0] && this.minAboveActive === false) {
        this.minAboveActive = true;
      } else if (this.activeId >= newRange[0] && this.minAboveActive === true) {
        this.minAboveActive = false;
      }

      if(newRange[1] < this.activeId && this.maxBelowActive === false) {
        this.maxBelowActive = true;
      } else if (newRange[1] >= this.activeId && this.maxBelowActive === true) {
        this.maxBelowActive = false;
      }
    },

    async amountsSlippageChange(changeEvent) {
      this.amountsSlippage = changeEvent.value ? changeEvent.value : 0;
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";

.remove-liquidity-modal-component {
  .modal__title {
    margin-bottom: 43px;
  }
  .modal-top-info {
    margin-top: 5px;
  }
  .liquidity-option {
    display: flex;
    flex-direction: column;
    &.shape {
      margin-top: 10px;
    }
    .label-with-separator {
      font-family: Montserrat;
      font-size: $font-size-sm;
      font-weight: 600;
      font-stretch: normal;
      font-style: normal;
      line-height: normal;
      letter-spacing: normal;
      text-align: left;
      color: var(--traderjoe-remove-liquidity-modal__label-with-separator);
      display: flex;
      align-items: center;
      &:after {
        content: "";
        display: block;
        background-color: var(--traderjoe-remove-liquidity-modal__label-with-separator-background);
        height: 2px;
        flex-grow: 1;
        margin-left: 10px;
      }
      .label__info-icon {
        margin-left: 8px;;
      }
    }
    .liquidity-option__content {
      width: 100%;
      margin: 30px 0;
      display: flex;
      justify-content: space-between;
      .liquidity-shape {
        width: 170px;
        height: 100px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        padding: 18px 0 6px;
        border-radius: 15px;
        border: var(--traderjoe-remove-liquidity-modal__liquidity-shape-border);
        cursor: pointer;
        .shape-icon {
          margin: 0 37px;
          filter: grayscale(1);
          opacity: 0.75;
        }
        .shape-label {
          margin-top: 6px;
          font-family: Montserrat;
          font-size: $font-size-sm;
          font-weight: 500;
          font-stretch: normal;
          font-style: normal;
          line-height: normal;
          letter-spacing: normal;
          text-align: left;
        }
        &.active {
          border: var(--traderjoe-remove-liquidity-modal__liquidity-shape-border-active);
          box-shadow: var(--traderjoe-remove-liquidity-modal__liquidity-shape-box-shadow);
          background-color: var(--traderjoe-remove-liquidity-modal__liquidity-shape-background);
          .shape-icon {
            filter: grayscale(0);
            opacity: 1;
          }
          .shape-label {
            font-weight: 600;
          }
        }
        &:hover {
          border-color: var(--traderjoe-remove-liquidity-modal__liquidity-shape-border-hover);
        }
      }
      &.price-slider-wrapper {
        display: flex;
        flex-direction: column;
        margin-top: 20px;
        .price-range-inputs {
          margin-top: 25px;
          display: flex;
          justify-content: space-around;
          .price__input {
            width: 260px;
            .input-label {
              font-family: Montserrat;
              font-size: $font-size-xsm;
              color: var(--traderjoe-remove-liquidity-modal__price-slider-input-color);
            }
          }
        }
      }
    }
  }
  .slippage-bar {
    margin-top: 5px;
    margin-bottom: 40px;
  }
  .button-wrapper {
    margin-top: 20px;
  }
}


</style>
