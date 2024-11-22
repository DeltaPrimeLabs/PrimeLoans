<template>
  <div class="simple-input-wrapper" v-bind:class="{'embedded': embedded}" :style="{width: width + 'px', height: height + 'px'}">
    <div class="input-wrapper"
         :style="{ 'margin-top': flexDirection === 'column-reverse' ? '40px' : '0', height: height + 'px'}"
         @click="$refs.input.focus()">
      <span class="input">
        <input  ref="input" v-model="internalValue" v-on:input="valueChange"
               placeholder="0" maxlength="20" lang="en-US">
      </span>
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

export default {
  name: 'SimpleInput',
  props: {
    width: {type: Number, default: 70},
    height: {type: Number, default: 26},
    flexDirection: {type: String, default: 'column'},
    validators: {
      type: Array, default: () => []
    },
    warnings: {
      type: Array, default: () => []
    },
    //TODO: make an array like in validators
    info: {type: Function, default: null},
    defaultValue: null,
    waiting: false,
    disabled: false,
    embedded: false,
    delayErrorCheckAfterValuePropagation: {type: Boolean, default: false}
  },
  computed: {},
  data() {
    return {
      error: '',
      warning: '',
      value: this.defaultValue,
      defaultValidators: [],
      ongoingErrorCheck: false,
      internalValue: this.defaultValue,
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
      this.internalValue = newValue;
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

      this.$emit('newValue', {value: value, error: hasError});
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
    valueChange() {
      const match = this.internalValue.match(/^\-?\d*[\.|\,]?\d{0,18}$/);
      if (match) {
        this.value = parseFloat(this.internalValue.replaceAll(',', '.'));
      } else {
        this.internalValue = this.internalValue.substring(0, this.internalValue.length - 1);
        this.value = parseFloat(this.internalValue.substring(0, this.internalValue.length - 1));
        this.$forceUpdate();
      }
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
      const wrongFormatValidator = {
        validate: (value) => {
          if (this.internalValue && !this.internalValue.toString().match(/^[0-9.,-]+$/)) {
            return `Incorrect formatting. Please use only alphanumeric values.`;
          }
        }
      }
      this.defaultValidators.push(wrongFormatValidator);
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.simple-input-wrapper {

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
  height: 30px;
  padding-left: 5px;
  padding-right: 5px;
  border-radius: 5px;
  border: solid 1px #dadada;
  width: 100%;

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
  font-size: 16px;
  font-weight: 600;
  padding-top: 0;
  padding-bottom: 0;
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
  color: #F5A200;
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
