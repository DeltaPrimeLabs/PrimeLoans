<template>
  <div class="currency-input-wrapper" v-bind:class="{'embedded': embedded}">
    <div class="input-wrapper"
         :style="{ 'margin-top': flexDirection === 'column-reverse' ? '40px' : '0'}"
         @click="$refs.input.focus()">
      <span class="input">
        <input ref="input"
               v-model="internalValue"
               :disabled="disabled"
               v-on:input="typeWatch"
               placeholder="0" min="0" maxlength="20" lang="en-US">
      </span>
      <div class="input-extras-wrapper">
        <div v-if="max != null" class="max-wrapper" v-on:click="setMax()">
          <div class="max">MAX</div>
        </div>
        <div v-if="!embedded" class="logo-wrapper">
          <img class="logo" :src="logoSrc(symbol)"/>
          <img class="logo secondary" v-if="symbolSecondary" :src="logoSrc(symbolSecondary)"/>
          <span v-if="!isMobile" class="symbol">{{ symbol }}<br>{{ symbolSecondary ? symbolSecondary : '' }}</span>
        </div>
      </div>
    </div>
    <div class="info"
         v-if="!error"
         :style="{'order': flexDirection === 'row' ? 1 : ''}">
      <div
        v-if="info && value && !isNaN(value) && !waiting && !ongoingErrorCheck"
        v-html="info(value)"></div>
    </div>
    <div class="error"
         v-if="error"
         :style="{'order': flexDirection === 'row' ? 1 : ''}">
      <span>
        <img src="src/assets/icons/error.svg"/>
        {{ error }}
      </span>
    </div>
    <div class="warning"
         v-if="warning && !error && !waiting && !ongoingErrorCheck">
      <span>
        <img src="src/assets/icons/error.svg"/>
        {{ warning }}
      </span>
    </div>
  </div>
</template>


<script>
import config from '@/config';
import {mapState} from 'vuex';

export default {
  name: 'CurrencyInput',
  props: {
    price: {type: Number},
    max: {default: null},
    symbol: {type: String, default: 'AVAX'},
    symbolSecondary: {type: String, default: null},
    flexDirection: {type: String, default: 'column'},
    validators: {
      type: Array, default: () => []
    },
    warnings: {
      type: Array, default: () => []
    },
    //TODO: make an array like in validators
    typingTimeout: {type: Number, default: 0},
    info: {type: Function, default: null},
    defaultValue: null,
    waiting: false,
    disabled: false,
    denominationButtons: false,
    slippage: {type: Number, default: 0},
    embedded: false,
    delayErrorCheckAfterValuePropagation: {type: Boolean, default: false},
  },
  computed: {},
  data() {
    return {
      error: '',
      warning: '',
      timer: 0,
      value: this.defaultValue,
      defaultValidators: [],
      asset: config.ASSETS_CONFIG[this.symbol],
      ongoingErrorCheck: false,
      usdDenominated: true,
      internalValue: this.defaultValue,
      maxButtonUsed: false,
    };
  },
  created() {
    this.setupDefaultValidators();
  },
  watch: {
    value: function (newValue) {
      this.updateValue(newValue);
    },
    defaultValue: function (newValue) {
      this.value = newValue;
    },
    warnings: function () {
      this.checkWarnings(this.value);
    },
    validators: function () {
      this.checkErrors(this.value);
    },
  },
  methods: {
    async updateValue(value) {
      console.log('updateValue');
      this.ongoingErrorCheck = true;
      this.$emit('ongoingErrorCheck', this.ongoingErrorCheck);

      if (this.delayErrorCheckAfterValuePropagation) {
        setTimeout(async () => {
          await this.checkErrors(value);
        });
      } else {
        await this.checkErrors(value);
      }

      this.ongoingErrorCheck = false;
      this.$emit('ongoingErrorCheck', this.ongoingErrorCheck);

      await this.checkWarnings(value);

      const hasError = this.error.length > 0;

      if (value !== this.max) {
        this.maxButtonUsed = false;
      }

      this.$emit('newValue', {value: value, error: hasError, maxButtonUsed: this.maxButtonUsed});
    },
    typeWatch() {
      this.$emit('ongoingTyping', {typing: true});

      this.parseValue();
      if (this.typingTimeout !== 0) {

        clearTimeout(this.timer);
        this.timer = setTimeout(this.emitValue, this.typingTimeout);
      } else {
        this.emitValue();
      }
    },
    async checkWarnings(newValue) {
      this.warning = '';

      for (const validator of [...this.warnings]) {
        let value = typeof newValue === 'number' ? newValue : 0;

        let validatorResult = await validator.validate(value);
        if (validatorResult) {
          this.warning = validatorResult;
        }
      }
    },

    async forceValidationCheck() {
      return this.checkErrors(this.value);
    },

    async checkErrors(newValue) {
      this.error = '';

      for (const validator of [...this.validators, ...this.defaultValidators]) {
        let value = typeof newValue === 'number' ? newValue : 0;

        let validatorResult = await validator.validate(value);
        if (validatorResult) {
          this.error = validatorResult;
        }
      }
      return this.error;
    },
    parseValue() {
      const match = this.internalValue.match(/^\d*[\.|\,]?\d{0,18}$/);
      if (match) {
        this.value = parseFloat(this.internalValue.replaceAll(',', '.'));
      } else {
        this.internalValue = this.internalValue.substring(0, this.internalValue.length - 1);
        this.value = parseFloat(this.internalValue.substring(0, this.internalValue.length - 1));
        this.$forceUpdate();
      }
    },

    emitValue() {
      this.$emit('ongoingTyping', {typing: false});

      this.$emit('inputChange', this.value);
    },

    async setValue(value) {
      this.value = value;
      this.internalValue = String(value);
      const checkErrorsResult = await this.checkErrors(this.value);
      const hasError = checkErrorsResult !== '';
      return {value: this.value, error: hasError};
    },

    setupDefaultValidators() {
      const positiveValidator = {
        validate: (value) => {
          if (this.internalValue <= 0) {
            return `Value must be higher than 0`;
          }
        }
      };
      const wrongFormatValidator = {
        validate: (value) => {
          if (this.internalValue && !this.internalValue.toString().match(/^[0-9.,]+$/)) {
            return `Incorrect formatting.`;
          }
        }
      };
      this.defaultValidators.push(positiveValidator, wrongFormatValidator);
    },

    setMax() {
      this.setValue(this.max);
      this.maxButtonUsed = true;
      const hasError = this.error.length > 0;
      this.checkErrors(this.max);
      this.$forceUpdate();
      this.$emit('newValue', {value: this.max, error: hasError, maxButtonUsed: this.maxButtonUsed});
      this.$emit('inputChange', this.max);
    },

    setValueOfMax(maxValue) {
      this.max = maxValue;
      this.$forceUpdate();
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.currency-input-wrapper {

  &.embedded {
    height: 60px;

    .input-wrapper {
      box-shadow: none;
      background-image: none;
    }
  }
}

.input-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: inset 3px 3px 8px rgba(191, 188, 255, 0.5);
  background-image: linear-gradient(114deg, rgba(115, 117, 252, 0.08) 39%, rgba(255, 162, 67, 0.08) 62%, rgba(245, 33, 127, 0.08) 81%);
  height: 60px;
  border-radius: 15px;
  padding-left: 15px;
  padding-right: 15px;
  border: none;
  width: 100%;

  @media screen and (min-width: $md) {
    padding-left: 30px;
    padding-right: 20px;
  }

  .input-extras-wrapper {
    display: flex;
    align-items: center;
  }
}

.input {
  position: relative;
}

input {
  background: transparent;
  border: none;
  font-family: Montserrat;
  font-weight: 600;
  font-size: 24px;
  padding-top: 0;
  padding-bottom: 0;
  max-width: 40%;

  &:disabled {
    opacity: 77%;
  }

  @media screen and (min-width: $md) {
    padding-right: 5px;
    max-width: none;
  }
}

input:focus {
  outline: none;
}

// hiding arrows
/* Chrome, Safari, Edge, Opera */
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* Firefox */
input[type=number] {
  -moz-appearance: textfield;
}

.converted {
  color: #696969;
  margin-right: 15px;
  white-space: nowrap;
  text-align: right;
  width: 140px;
  font-size: $font-size-sm;
  opacity: 0.6;
  display: none;

  @media screen and (min-width: $md) {
    display: block;
  }

  > div {
    text-overflow: ellipsis;
    overflow: hidden;
    display: flex;
    flex-direction: column;

  }
}

.symbol {
  margin-left: 10px;
  font-family: 'Lato';
  font-weight: 900;
  font-size: 18px;
}

.logo-wrapper {
  display: flex;
  align-items: center;
}

.logo.secondary {
  transform: translateX(-10px);
}

.max-wrapper {
  cursor: pointer;
  width: 35px;
  min-width: 35px;
  margin-right: 20px;


  .max {
    border: solid 1px #8986fe;
    border-radius: 10px;
    width: 45px;
    height: 26px;
    font-weight: bold;
    line-height: 24px;
    color: #8986fe;
    text-align: center;
    background-color: rgba(255, 255, 255, 0.2);

    &:hover {
      background-color: rgba(255, 255, 255, 0.9);
    }
  }
}

img {
  height: 24px;
  width: 24px;

  @media screen and (min-width: $md) {
    height: 36px;
    width: 36px;
  }
}

.error, .info, .warning {
  min-height: 30px;
  padding-top: 6px;
  color: #7d7d7d;
  font-size: 14px;
  width: 100%;
  text-align: start;
}

.warning {
  //color: #F5A200;
  color: $red;
}

.error, .warning {
  img {
    width: 20px;
    height: 20px;
    transform: translateY(-1px);
  }
}

.error {
  color: $red;
}

.denomination {
  min-width: 90px;

  .icon {
    width: 20px;
    cursor: pointer;

    &:hover {
      transform: scale(1.05);
    }
  }

  .slash {
    height: 24px;
    width: 12px;
  }
}
</style>
