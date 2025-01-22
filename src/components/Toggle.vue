<template>
  <div class="toggle-component" ref="toggleComponent" v-bind:class="{'toggle-component--big': size === 'big'}">
    <div class="toggle">
      <div class="toggle__options">
        <div class="option"
             v-for="option in options"
             v-bind:key="option"
             v-bind:id="`option-${option}-${uuid}`"
             v-bind:class="{'option--selected': option === selectedOption}"
             v-on:click="clickOption(option)">
          {{ option }}
          <div class="option__info">
            <InfoIcon v-if="option === 'PnL'"
                      :tooltip="{content: 'This might show collateral instead of PnL. This is currently being restored per PA, and will be restored for everyone before Friday', classes: 'info-tooltip long'}"></InfoIcon>
          </div>

        </div>
      </div>
      <div ref="pointer" class="pointer"></div>
      <div class="toggle__background"></div>
    </div>
  </div>
</template>

<script>
import InfoIcon from './InfoIcon.vue';

export default {
  name: 'Toggle',
  components: {InfoIcon},
  props: {
    options: Array,
    initialOption: Number,
    size: {
      type: String,
      default: 'SMALL'
    }
  },
  data() {
    return {
      selectedOption: this.$props.initialOption ? this.$props.options[this.$props.initialOption] : this.$props.options[0],
      uuid: crypto.randomUUID(),
    };
  },
  mounted() {
    this.setup();
  },
  methods: {
    setup() {
      setTimeout(() => {
        const selectedOptionElement = document.getElementById(`option-${this.selectedOption}-${this.uuid}`);
        const selectOptionRect = selectedOptionElement.getBoundingClientRect();
        this.$refs.pointer.style.width = `${selectOptionRect.width}px`;
        this.$refs.pointer.style.left = `${selectedOptionElement.offsetLeft}px`;
      }, 100);
    },

    clickOption(option) {
      if (option !== this.selectedOption) {
        this.selectedOption = option;
        this.$emit('change', option);
        const targetOptionElement = document.getElementById(`option-${this.selectedOption}-${this.uuid}`);
        const targetOptionRect = targetOptionElement.getBoundingClientRect();
        this.$refs.pointer.style.left = `${targetOptionElement.offsetLeft}px`;
        this.$refs.pointer.style.width = `${targetOptionRect.width}px`;
      }
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
      width: 50px;
      margin: 0 80px 0 0;
      padding: 4px 10px;
      box-shadow: var(--toggle__pointer-box-shadow);
      border-radius: 7px;
      backdrop-filter: contrast(200%) brightness(150%);
      z-index: 1;
      transition: all 100ms;

      &:before {
        content: '';
        position: absolute;
        border-radius: 7px;
        inset: 0;
        background: var(--toggle__pointer-border);
      }

      &:after {
        content: '';
        position: absolute;
        border-radius: 6px;
        inset: 1px;
        background: var(--toggle__pointer-background);
      }
    }

    .toggle__options {
      display: flex;
      flex-direction: row;
      border-radius: 7px;
      font-size: $font-size-xsm;
      color: var(--toggle__options-color);
      z-index: 2;

      .option {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        padding: 4px 10px;
        cursor: pointer;

        &.option--selected {
          color: var(--toggle__options-color--selected);
          font-weight: 600;
        }

        &:hover {
          color: var(--toggle__options-color--hover);
        }

        .option__info {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
          margin-left: 5px;
        }
      }
    }

    .toggle__background {
      position: absolute;
      inset: 0;
      height: 28px;
      background-color: var(--toggle__background);
      border: var(--toggle__border);
      z-index: 0;
      border-radius: 7px;
    }
  }
}

.toggle-component--big {
  .pointer {
    height: 31px !important;
  }

  .toggle__background {
    height: 31px !important;
  }

  .toggle__options {
    font-size: $font-size-sm !important;
  }

  .option {
    padding: 6px 12px !important;
  }
}

</style>
