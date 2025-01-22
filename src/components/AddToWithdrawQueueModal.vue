<template>
  <div v-if="asset" id="modal" class="withdraw-modal-component modal-component">
    <Modal :height="getModalHeight">
      <div class="modal__title">
        Add to Withdrawal Queue
      </div>
      <div class="modal-top-info-bar">
        <b>Queued amount cannot be used, as long as the corresponding withdrawal intent is active. Attempts to use queued assets will result in failed transactions.</b>
      </div>
      <div class="modal-top-info">
        <div class="top-info__label">Available:</div>
        <div class="top-info__value">
          {{ assetBalance | smartRound(5, true) }}
          <span class="top-info__currency">
            {{ asset.symbol }}
          </span>
        </div>
      </div>

      <CurrencyInput :symbol="asset.symbol"
                     :asset="asset"
                     v-on:newValue="withdrawValueChange"
                     :validators="validators"
                     :info="() => sourceAssetValue">
      </CurrencyInput>

      <div v-if="queue && queue.length > 0" class="queue">
        <div class="queue__border">
          <div class="queue__content">
            <div class="queue__title">{{ asset.symbol }} Withdrawal Queue</div>
            <div class="queue__entry" v-for="entry in queue">
              <div class="queue__divider"></div>
              <div class="queue__row">
                <div class="queue__value-cell">
                  <div class="queue__value">{{ entry.amount }}</div>
                  <div class="queue__symbol">{{ entry.symbol }}</div>
                </div>
                <div class="queue__status" v-bind:class="classRecord[entry.status]">
                  {{ statusLabel[entry.status] }}
                </div>
                <div class="queue__timer">
                  <div class="queue__timer-label">{{ statusTimerLabel[entry.status] }}:</div>
                  <Timer :status="entry.status" :date="entry.date"></Timer>
                </div>
              </div>
            </div>
            <div>
              <div v-if="extraIntents > 0" class="queue__divider"></div>
              <div v-if="extraIntents > 0" class="queue__more">
                And {{ extraIntents }} more
              </div>
            </div>
          </div>
        </div>
<!--        <div class="queue__cta" @click="close()">
          Go to Withdrawal Queue
          <DeltaIcon
            class="queue__cta-arrow"
            :icon-src="'src/assets/icons/left-arrow.svg'"
            :size="15"></DeltaIcon>
        </div>-->
      </div>
      <div class="button-wrapper">
        <Button :label="'Add to queue'"
                v-on:click="submit()"
                :disabled="currencyInputError && !(asset.inactive || asset.unsupported)"
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
import config from '../config';
import InfoIcon from './InfoIcon.vue';
import Timer from './Timer.vue';
import DeltaIcon from './DeltaIcon.vue';
import IconButton from './IconButton.vue';
import {mapState} from 'vuex';

export default {
  name: 'AddToWithdrawQueue',
  components: {
    IconButton,
    DeltaIcon,
    Timer,
    InfoIcon,
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal,
    BarGaugeBeta,
    Toggle,
  },

  props: {
    asset: {},
    assetBalance: null,
    logo: null,
    queue: [],
    extraIntents: {},
  },

  data() {
    return {
      withdrawValue: 0,
      healthAfterTransaction: 0,
      validators: [],
      currencyInputError: true,
      toggleOptions: config.NATIVE_ASSET_TOGGLE_OPTIONS,
      transactionOngoing: false,
      valueAsset: 'USDC',
      classRecord: {
        READY: 'queue__status--ready',
        PENDING: 'queue__status--pending'
      },
      statusLabel: {
        READY: 'Ready',
        PENDING: 'Pending'
      },
      statusTimerLabel: {
        READY: 'Expires In',
        PENDING: 'Ready In'
      },
    };
  },

  mounted() {
    setTimeout(() => {
      this.setupValidators();
    });

    this.priceService.observePrices().subscribe(prices => {
      this.assetPrice = prices[this.asset.symbol];
    });
  },

  computed: {
    ...mapState('serviceRegistry', ['priceService']),
    getModalHeight() {
      return this.asset.symbol === this.toggleOptions[0] ? '561px' : null;
    },

    sourceAssetValue() {
      const sourceAssetUsdPrice = Number(this.withdrawValue) * this.asset.price;
      const nativeAssetUsdPrice = config.ASSETS_CONFIG[this.toggleOptions[0]].price;
      // const sourceAssetUsdPrice = 1;
      // const nativeAssetUsdPrice = 2;

      if (this.valueAsset === 'USDC') return `~ $${sourceAssetUsdPrice.toFixed(2)}`;
      // otherwise return amount in native symbol
      return `~ ${(sourceAssetUsdPrice / nativeAssetUsdPrice).toFixed(2)} ${this.toggleOptions[0]}`;
    },
  },

  methods: {
    close() {
      this.$emit('close');
      this.closeModal();
    },
    submit() {
      console.log('submit');
      this.transactionOngoing = true;
      let withdrawEvent = {};
      if (this.asset.symbol === this.toggleOptions[0]) {
        withdrawEvent = {
          withdrawAsset: this.selectedWithdrawAsset,
          value: this.withdrawValue,
        };
      } else {
        withdrawEvent = {
          withdrawAsset: this.asset.symbol,
          value: this.withdrawValue,
        };
      }

      console.log(withdrawEvent);
      this.$emit('WITHDRAW', withdrawEvent);
    },


    withdrawValueChange(event) {
      this.withdrawValue = event.value;
      this.currencyInputError = event.error;
    },

    assetToggleChange(asset) {
      this.selectedWithdrawAsset = asset;
    },

    setupValidators() {
      this.validators = [
        {
          validate: (value) => {
            if (this.assetBalance - value < 0) {
              return `Withdraw amount exceeds balance`;
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

.queue {
  margin-top: 30px;

  &__border {
    background-image: var(--add-to-withdraw-queue__queue-border);
    border-radius: 15px;
    display: inline-block;
    padding: 2px;
    width: 100%;
  }

  &__content {
    display: flex;
    flex-direction: column;
    border-radius: 13px;
    background-color: var(--add-to-withdraw-queue__queue-background);
    padding: 1px 16px 1px 16px;
    color: var(--add-to-withdraw-queue__queue-color)
  }

  &__title {
    display: flex;
    flex-direction: row;
    font-size: 14px;
    font-weight: 500;
    color: var(--add-to-withdraw-queue__queue-title-color);
    justify-content: center;
    padding: 3px 0;
  }

  &__divider {
    width: 100%;
    height: 2px;
    background: var(--add-to-withdraw-queue__queue-divider-background);
  }

  &__row {
    display: grid;
    grid-template-columns: 168px 1fr 224px;
    padding: 12px 29px;
  }

  &__value-cell {
    display: flex;
  }

  &__value {
    font-weight: 600;
    margin-right: 4px;
  }

  &__more {
    padding: 10px 0;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
  }

  &__status {
    display: flex;
    justify-content: center;
    font-weight: 600;

    &--ready {
      color: var(--add-to-withdraw-queue__queue-status-color--ready);
    }

    &--pending {
      color: var(--add-to-withdraw-queue__queue-status-color--pending);
    }
  }

  &__timer-label {
    margin-right: 4px;
  }

  &__timer {
    display: flex;
    justify-content: flex-end;
  }

  &__cta {
    margin-top: 4px;
    margin-bottom: 28px;
    font-size: 14px;
    font-weight: 600;
    display: flex;
    justify-content: flex-end;
    cursor: pointer;
    color: var(--add-to-withdraw-queue__queue-cta-color);
  }

  &__cta-arrow {
    transform: rotate(180deg);
    margin-left: 4px;
    background: var(--add-to-withdraw-queue__queue-cta-color);
  }
}

.modal__title {
  margin-bottom: 36px !important;
}

</style>
