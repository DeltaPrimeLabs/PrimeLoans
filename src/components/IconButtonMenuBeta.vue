<template>
  <div id="icon-button-menu-component" class="icon-button-menu-component"
       v-tooltip="!menuOpen && config.tooltip ? {content: config.tooltip, classes: 'button-tooltip'} : null">
    <Bubble v-if="bubbleText">
      <div v-html="bubbleText"></div>
    </Bubble>
    <div id="icon-button-container" class="icon-button-container" v-on:click="iconButtonClick($event)">
      <img id="icon-button" class="icon-button"
           v-bind:class="{'icon-button--disabled': config.disabled || disabled}"
           :src="config.iconSrc">
      <img id="icon-button--hover" class="icon-button--hover"
           v-bind:class="{'icon-button--disabled': config.disabled || disabled}"
           :src="config.hoverIconSrc">
    </div>
    <div class="menu" v-if="config.menuOptions && this.menuOpen">
      <div class="menu__option"
           v-for="option in config.menuOptions"
           v-if="option && (!option.hidden || showHiddenOptions)"
           v-bind:class="{'menu__option--disabled': option.disabled}"
           v-bind:key="option.key"
           v-on:click="menuOptionClick(option)">
        <div class="option__text" v-bind:class="{'option__text--disabled': option.disabled}">
          {{ option.name }}
        </div>
        <div class="option__info__wrapper">
          <img class="option__info-icon"
               v-if="option.disabled" src="src/assets/icons/info.svg"
               v-tooltip="{content: option.disabledInfo}">
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import Bubble from './Bubble';

export default {
  name: 'IconButtonMenuBeta',
  components: {Bubble},
  props: {
    config: {
      type: Object,
      required: true,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    bubbleText: {
      type: String,
      default: '',
    }
  },
  mounted() {
    document.addEventListener('icon-menu-open', () => {
      this.menuOpen = false;
    }, false);
  },
  data() {
    return {
      menuOpen: false,
      showHiddenOptions: false,
    };
  },
  methods: {
    iconButtonClick(event) {
      this.showHiddenOptions = event.metaKey || event.altKey;
      if (!this.config.disabled && !this.disabled) {
        if (this.config.menuOptions) {
          if (!this.menuOpen) {
            this.emitGlobalCloseOfAllMenus();
            this.stopObserveOutsideClick();
          }
          this.observeOutsideClick();
          this.menuOpen = !this.menuOpen;
        } else {
          this.$emit('iconButtonClick', this.config.iconButtonActionKey);
          this.emitGlobalCloseOfAllMenus();
          this.stopObserveOutsideClick();
        }
      }
    },

    menuOptionClick(option) {
      if (!option.disabled) {
        this.$emit('iconButtonClick', option.key);
        this.emitGlobalCloseOfAllMenus();
      }
    },

    emitGlobalCloseOfAllMenus() {
      const event = new Event('icon-menu-open');
      document.dispatchEvent(event);
    },

    closeMenuOnClickOutside(event) {
      if (!document.getElementById('icon-button-menu-component').contains(event.target) && event.target.id !== 'icon-button--hover') {
        if (this.menuOpen) {
          this.menuOpen = false;
        }
      }
    },

    observeOutsideClick() {
      document.addEventListener('click', this.closeMenuOnClickOutside);
    },

    stopObserveOutsideClick() {
      document.removeEventListener('click', this.closeMenuOnClickOutside);
    },
  },
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.icon-button-menu-component {
  position: relative;

  .icon-button-container {

    &:hover {
      .icon-button:not(.icon-button--disabled) {
        display: none;
      }

      .icon-button--hover:not(.icon-button--disabled) {
        display: block;
      }
    }

    .icon-button {
      height: 26px;
      width: 26px;
      cursor: pointer;

      &.icon-button--disabled {
        opacity: 0.5;
        filter: grayscale(1);
        cursor: default;
      }
    }

    .icon-button--hover {
      display: none;
      height: 26px;
      width: 26px;
      cursor: pointer;
    }
  }

  .menu {
    position: absolute;
    top: -10px;
    left: 36px;
    z-index: 1;
    display: flex;
    flex-direction: column;
    box-shadow: 2px 2px 8px 0 rgba(175, 171, 255, 0.5);
    border: solid 2px $delta-secondary;
    background-color: white;
    padding: 10px 18px;
    border-radius: 10px;

    &:after {
      position: absolute;
      left: -8px;
      top: 14px;
      width: 12px;
      height: 12px;
      border-left: solid 2px $delta-secondary;
      border-bottom: solid 2px $delta-secondary;
      background-color: white;
      transform: rotate(45deg);
      content: '';
    }

    .menu__option {
      display: flex;
      flex-direction: row;
      white-space: nowrap;
      color: $dark-gray;
      font-weight: 600;
      cursor: pointer;

      &:not(:last-child) {
        margin-bottom: 10px;
      }

      &:hover {
        color: $dark-gray;
      }

      .option__text {
        &:hover {
          color: $black;
        }
      }

      .option__text--disabled {
        opacity: 0.5;
        cursor: default;

        &:hover {
          color: $dark-gray;
        }
      }

      .option__info__wrapper {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        margin-left: 5px;

        .option__info-icon {
          width: 16px;
          height: 16px;
        }
      }
    }
  }
}
</style>

<style lang="scss">
.info-tooltip {
  max-width: 156px;
}
</style>