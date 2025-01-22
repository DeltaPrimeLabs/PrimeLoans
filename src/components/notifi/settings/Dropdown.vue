<template>
  <div class="custom-dropdown">
    <div
      class="select"
      @click.stop="open = !open"
    >
      <input
        disabled
        :placeholder="options[0] && options[0].name || 'Select...'"
        :value="value"
      >
      <DeltaIcon
        v-if="options"
        :class="['chevron', open ? 'chevron-open' : '']"
        :icon-src="'src/assets/icons/chevron-down.svg'"
        :size="17"
      ></DeltaIcon>
    </div>
    <div
      v-show="open"
      class="dropdown"
    >
      <div
        v-for="option in options"
        class="dropdown-option notifi-modal__text notifi-modal__text-label"
        v-bind:key="option.name"
        @click.stop="handleSelect(option)"
      >
        {{ option.name }}
      </div>
    </div>
  </div>
</template>
  
<script>
import DeltaIcon from '../../DeltaIcon.vue';

export default {
  name: "Dropdown",
  components: {
    DeltaIcon
  },
  props: {
    options: { type: Array, default: () => [] }
  },
  data() {
    return {
      open: false,
      value: null
    }
  },
  methods: {
    handleSelect(option) {
      this.open = false;
      this.value = option.name;
      this.$emit('dropdownSelected', option);
    }
  }
}
</script>
  
<style scoped lang="scss">
@import "~@/styles/variables";

.custom-dropdown {
  width: 100%;
  height: 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-radius: 10px;
  border: solid 1px var(--notifi-dropdown__border-color);
  background-color: var(--notifi-dropdown__background-color);
  cursor: pointer;

  .select {
    width: 100%;
    display: flex;
    align-items: center;
    padding: 0 12px;

    input {
      width: 100%;
      height: 100%;
      border: none;
      outline: none;
      background: transparent;
      margin: 0;
      padding: 6px 0;
      font-size: 15px;
      font-weight: 600;
      color: var(--notifi-dropdown__select-font-color);
      font-family: 'Montserrat';
      cursor: pointer;

      &::placeholder {
        color: $cloud-gray;
      }
    }

    .chevron {
      background: var(--notifi-dropdown__chevron-color);
      transition: transform 200ms ease-in-out;

      &.chevron-open {
        transform: rotate(-180deg);
      }
    }
  }

  .dropdown {
    width: 100%;
    margin-top: 2px;
    border-radius: 10px;
    border: solid 1px var(--notifi-dropdown__border-color);
    background-color: var(--notifi-dropdown__background-color);
    box-shadow: var(--notifi-dropdown__dropdown-box-shadow);
    padding: 5px 0;
    z-index: 1;

    .dropdown-option {
      padding: 5px 12px;

      &:hover {
        background: var(--notifi-dropdown__hover-background-color);
      }
    }
  }
}

</style>
