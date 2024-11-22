<template>
  <div class="toggle-component">
    <div class="toggle">
      <div class="toggle__options">
        <div class="option"
             v-for="option in options"
             v-bind:key="option"
             v-bind:id="'option-' + option"
             v-bind:class="{'option--selected': option === selectedOption}"
             v-on:click="clickOption(option)">{{ option }}</div>
      </div>
      <div ref="pointer" class="pointer"></div>
      <div class="toggle__background"></div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Toggle',
  props: {
    options: Array
  },
  data() {
    return {
      selectedOption: 'AVAX'
    }
  },
  mounted() {
    this.setup();
  },
  methods: {
    setup() {
      const selectedOptionElement = document.getElementById(`option-${this.selectedOption}`);
      const selectOptionRect = selectedOptionElement.getBoundingClientRect();
      this.$refs.pointer.style.width = `${selectOptionRect.width}px`;
    },

    clickOption(option) {
      this.selectedOption = option;
      this.$emit('change', option);
      const targetOptionElement = document.getElementById(`option-${option}`);
      const targetOptionRect = targetOptionElement.getBoundingClientRect();
      this.$refs.pointer.style.left = `${targetOptionElement.offsetLeft}px`;
      this.$refs.pointer.style.width = `${targetOptionRect.width}px`;

    }
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.toggle-component {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;

  .toggle {
    display: flex;
    position: relative;

    .pointer {
      position: absolute;
      left: 0;
      height: 28px;
      margin: 0 80px 0 0;
      padding: 4px 10px;
      box-shadow: 1px 1px 6px 0 rgba(117, 107, 237, 0.3);
      border-radius: 7px;
      border: 1px solid $light-violet;
      backdrop-filter: contrast(200%) brightness(150%);
      z-index: 1;
      transition: all 100ms;

    }

    .toggle__options {
      display: flex;
      flex-direction: row;
      border-radius: 7px;
      font-size: $font-size-xsm;
      color: $medium-gray;
      z-index: 2;

      .option {
        padding: 4px 10px;
        cursor: pointer;

        &.option--selected {
          color: $persian-blue;
          font-weight: 600;
        }

        &:hover {
          color: $persian-blue;
        }
      }
    }

    .toggle__background {
      position: absolute;
      top: 0;
      left: 0;
      width: 131.5px;
      height: 28px;
      background-color: $mist-gray;
      border: 1px solid $goose-gray;
      z-index: 0;
      border-radius: 7px;
    }
  }
}

</style>