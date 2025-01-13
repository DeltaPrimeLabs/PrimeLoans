<template>
  <div id="modal" class="rtkn-cancel-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        rTKN cancelation
      </div>

      <div class="modal-top-info">
        <div class="top-info__value">{{ available | smartRound(5, true) }}<span class="top-info__currency"> rTKN</span>
        </div>
      </div>

      <CurrencyInput v-on:newValue="cancelValueChange"
                     :symbol="'rTKN'"
                     :logo="'rtkn.svg'"
                     :validators="validators">
      </CurrencyInput>

      <div class="transaction-summary-wrapper">
        <TransactionResultSummaryBeta>
          <div class="summary__title">
            Values after transaction:
          </div>
          <div class="summary__horizontal__divider"></div>
          <div class="summary__values">
            <div class="summary__value__pair">
              <div class="summary__label">
                my committed rTKNs:
              </div>
              <div class="value__wrapper">
                <div class="summary__value">
                  {{ (available - cancelValue > 0 ? available - cancelValue : 0) | smartRound(5, true) }} rTKN
                </div>
              </div>
            </div>
            <div class="summary__divider divider--long"></div>
            <div class="summary__value__pair">
              <div class="summary__label">
                PRIME received
              </div>
              <div class="value__wrapper">
                <div class="summary__value">
                  {{ (available - cancelValue > 0 ? (available - cancelValue) * conversionRatio : 0 ) | smartRound(5, true) }} PRIME
                </div>
              </div>
            </div>
          </div>
        </TransactionResultSummaryBeta>
      </div>

      <div class="button-wrapper">
        <Button :label="'Cancel'"
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
import BarGaugeBeta from './BarGaugeBeta.vue';
import DeltaIcon from './DeltaIcon.vue';

export default {
  name: 'RtknCancelModal',
  components: {
    DeltaIcon,
    BarGaugeBeta,
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal,
    Toggle
  },

  props: {
    cancel: 0,
    assetSymbol: null,
    available: null,
    yourCancel: null,
    rtknCap: null,
    conversionRatio: null,
  },

  data() {
    return {
      cancelValue: 0,
      validators: [],
      transactionOngoing: false,
      inputValidationError: false,
    };
  },

  mounted() {
    this.setupValidators();
  },

  methods: {
    submit() {
      this.transactionOngoing = true;
      const cancelEvent = {
        value: this.cancelValue,
      };
      this.$emit('CANCEL', cancelEvent);
    },

    cancelValueChange(event) {
      console.log(event);
      this.cancelValue = Number(event.value);
      const expectedPrime = event.value * this.conversionRatio;
      console.log(expectedPrime);
      this.inputValidationError = event.error;
    },

    setupValidators() {
      this.validators = [
        {
          validate: (value) => {
            if (value > this.available) {
              return 'Exceeds commited rTKNs';
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

.rtkn-cancel-modal-component {
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

  .reverse-swap-button {
    position: relative;
    margin: 28px auto;
    height: 40px;
    width: 40px;
    border: var(--swap-modal__reverse-swap-button-border);
    background: var(--swap-modal__reverse-swap-button-background);
    box-shadow: var(--swap-modal__reverse-swap-button-box-shadow);
    border-radius: 999px;
    pointer-events: none;

    .reverse-swap-icon {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: var(--swap-modal__reverse-swap-icon-color);
    }
  }

  .modal-top-info-bar {
    text-align: center;

    a, a:visited {
      color: inherit;
      font-weight: 700;

      &:hover {
        text-decoration: underline;
      }
    }
  }
}

</style>
