<template>
  <div v-if="selectedAsset" id="modal" class="add-from-wallet-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Create a Prime Account
      </div>
      <div class="modal-top-desc">
        <div>
          This action will deploy your <b>Prime Account</b> and add your
          collateral.
          <br><br>
        </div>
        <div>
          <b>It will require accepting Terms and 3 consecutive Metamask transactions.</b>
        </div>
      </div>
      <div class="modal-top-info">
        <div class="top-info__label">Available:</div>
        <div class="top-info__value" v-bind:class="{'available-balance--loading': !availableAssetAmount && availableAssetAmount !== 0}">
          <LoadedValue :check="() => availableAssetAmount != null || Number.isNaN(availableAssetAmount)"
                       :value="formatTokenBalance(availableAssetAmount, 10, true)"></LoadedValue>
          <div v-if="availableAssetAmount != null">
            <span class="top-info__currency">
              {{ this.nativeAssetOptionSelected === this.toggleOptions[1] ? this.nativeAssetOptionSelected : (selectedAsset.short ? selectedAsset.short : selectedAsset.symbol) }}
            </span>
          </div>
        </div>
      </div>

      <CurrencyComboInput ref="sourceInput"
                          :asset-options="assetOptions"
                          :default-asset="selectedAsset"
                          :validators="validators"
                          :disabled="false"
                          :max="availableAssetAmount"
                          :typingTimeout="2000"
                          v-on:valueChange="inputChange"
                          v-on:ongoingTyping="ongoingTyping"
      >
      </CurrencyComboInput>

      <div class="toggle-container" v-if="selectedAsset.symbol === toggleOptions[0]">
        <Toggle v-on:change="assetToggleChange" :options="toggleOptions" :initial-option="0"></Toggle>
      </div>

      <div class="button-wrapper">
       <Button :label="'Create account'"
                v-on:click="submit()"
                :disabled="validationError"
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
import LoadedValue from './LoadedValue';
import CurrencyComboInput from "./CurrencyComboInput.vue";

const ethers = require('ethers');

export default {
  name: 'CreateAccountModal',
  components: {
    CurrencyComboInput,
    LoadedValue,
    Button,
    CurrencyInput,
    TransactionResultSummaryBeta,
    Modal,
    BarGaugeBeta,
    Toggle
  },

  props: {
    selectedAsset: {},
    assetOptions: {},
    logo: null,
    assetBalance: Number,
    walletAssetBalances: null,
    transactionOngoing: false
  },

  data() {
    return {
      value: 0,
      validators: [],
      validationError: true,
      availableAssetAmount: 0,
      toggleOptions: config.NATIVE_ASSET_TOGGLE_OPTIONS,
      nativeAssetOptionSelected: config.NATIVE_ASSET_TOGGLE_OPTIONS[0],
      signer: null,
    };
  },

  mounted() {
    setTimeout(() => {
      this.setupAssetOptions();
      this.setupValidators();
    });
  },

  computed: {
    ...mapState('network', ['account']),
  },

  methods: {
    submit() {
      this.transactionOngoing = true;
      const asset = this.selectedAsset.symbol === this.toggleOptions[0] ? this.nativeAssetOptionSelected : this.selectedAsset
      this.$emit('ZAP_CREATE_ACCOUNT_EVENT', {
          value: parseFloat(this.value).toFixed(this.selectedAsset.decimals),
          asset: asset,
        });
    },

    recalculateAvailable() {
      const isSecondaryNativeTokenOptionSelected = this.selectedAsset.symbol === this.toggleOptions[0] && this.nativeAssetOptionSelected !== this.toggleOptions[0]

      this.availableAssetAmount = this.walletAssetBalances[isSecondaryNativeTokenOptionSelected ? this.toggleOptions[1] : this.selectedAsset.symbol]
      this.$forceUpdate()
    },

    async inputChange(changeEvent) {
      if (this.selectedAsset.symbol !== changeEvent.asset) {
        this.selectedAsset = config.ASSETS_CONFIG[changeEvent.asset]
        this.nativeAssetOptionSelected = this.toggleOptions[0]
        this.recalculateAvailable()
      }
      this.value = changeEvent.value;
      this.validationError = changeEvent.error;
    },

    setupValidators() {
      this.validators = [
        {
          validate: (value) => {
            if (value > this.availableAssetAmount) {
              return 'Exceeds account balance';
            }
          }
        },
        {
          validate: async (value) => {
            const allowed = this.selectedAsset.maxExposure - this.selectedAsset.currentExposure;
        
            if (value > allowed) {
              return `Max. allowed amount is ${allowed.toFixed(2)}.`;
            }
          }
        }
      ];
    },

    async assetToggleChange(asset) {
      this.nativeAssetOptionSelected = asset;
      const error = await this.$refs.sourceInput.forceValidationCheck(this.value);
      this.validationError = error;
      this.recalculateAvailable()
    },

    setTokenBalances(balancesObject) {
      this.walletAssetBalances = balancesObject
      this.recalculateAvailable();
    },

    setupAssetOptions() {
      this.assetOptions = [];

      this.assets.forEach(assetSymbol => {
        const asset = config.ASSETS_CONFIG[assetSymbol];
        const assetOption = {
          symbol: assetSymbol,
          name: asset.name,
          logo: `src/assets/logo/${assetSymbol.toLowerCase()}.${asset.logoExt ? asset.logoExt : 'svg'}`
        };
        this.assetOptions.push(assetOption);
      });
    },

    ongoingTyping(event) {
      this.isTyping = event.typing;
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
