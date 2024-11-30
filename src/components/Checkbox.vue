<template>
  <div class="checkbox-component">
    <div class="checkbox" v-bind:class="{'checkbox--disabled': disabled}">
      <div class="checkbox__icon" v-on:click="checkboxClick()">
        <img v-if="value" class="icon__img" src="src/assets/icons/checkbox_on.svg">
        <div v-if="!value" class="icon__checkbox--off"></div>
      </div>
      <div class="checkbox__label">
        {{label}}
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Checkbox',
  props: {
    label: null,
    disabled: false,
  },

  data() {
    return {
      value: false,
    }
  },

  methods: {
    checkboxClick() {
      this.value = !this.value;
      this.$emit('checkboxChange', this.value);
    },
    changeValueWithoutEvent(isSelected) {
      this.value = isSelected
    }
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.checkbox-component {

  .checkbox {
    flex-direction: row;
    align-items: center;

    &--disabled {
      pointer-events: none;

      .icon__checkbox--off {
        background: var(--checkbox__background--disabled) !important;
        border: solid 1px var(--checkbox__border--disabled) !important;
      }
    }

    .checkbox__icon {
      display: flex;
      width: 16px;
      height: 16px;
      user-select: none;

      .icon__img {
        width: 16px;
        height: 16px;
        border-radius: 3px;
      }

      .icon__checkbox--off {
        width: 16px;
        height: 16px;
        border-radius: 3px;
        background: var(--checkbox__background);
        border: solid 1px var(--checkbox__border);
      }
    }


    .checkbox__label {
      color: var(--checkbox);
      font-weight: 500;
      margin-left: 8px;

    }
  }
}

</style>