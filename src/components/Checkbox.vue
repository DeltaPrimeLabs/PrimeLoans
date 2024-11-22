<template>
  <div class="checkbox-component">
    <div class="checkbox">
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
  },

  data() {
    return {
      value: false,
    }
  },

  methods: {
    checkboxClick() {
      this.value = !this.value;
      this.$emit('CHANGE', this.value);
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.checkbox-component {

  .checkbox {
    display: flex;
    flex-direction: row;
    align-items: center;

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
        border: solid 1px $cloud-gray;
      }
    }


    .checkbox__label {
      color: $steel-gray;
      font-weight: 500;
      margin-left: 8px;

    }
  }
}

</style>