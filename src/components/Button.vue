<template>
  <button class="btn" :class="[disabled ? 'disabled': '', waiting ? 'disabled waiting': '', 'purple']"
          @click="clicked"
          :style="variant && variants[variant]">
    <div class="btn-label">
      <img
        v-if="leftIconSrc"
        class="btn-label__icon-left"
        :src="leftIconSrc"
      >
      {{ label }}
      <DeltaIcon
        v-if="rightIconSrc"
        class="btn-label__icon btn-label__icon-right"
        :icon-src="rightIconSrc"
        :size="16"
      ></DeltaIcon>
    </div>
    <vue-loaders-ball-beat :style="variant ? { marginTop: '1px', marginBottom: '1px' } : ''" color="#FFFFFF" scale="0.5"></vue-loaders-ball-beat>
  </button>
</template>


<script>
import DeltaIcon from './DeltaIcon.vue';
export default {
  name: 'Button',
  components: {
    DeltaIcon
  },
  props: {
    variant: null,
    disabled: false,
    waiting: false,
    label: '',
    leftIconSrc: { type: String, default: null },
    rightIconSrc: { type: String, default: null }
  },
  data() {
    return {
      variants: {
        medium: {
          fontSize: "14px",
          padding: "9px 16px"
        },
        slim: {
          fontSize: "15px",
          padding: "7px 8px"
        }
      }
    }
  },
  methods: {
    clicked(event) {
      const metaKey = event.metaKey || event.ctrlKey;
      if (!(this.disabled || this.waiting)) {
        this.$emit('click', metaKey ? {value: true, metaKey} : true);
      }
    }
  },
}
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.btn {
  display: inline-block;
  font-weight: 800;
  color: rgb(66, 66, 66);
  text-align: center;
  vertical-align: middle;
  user-select: none;
  background-color: transparent;
  line-height: 1.5;
  border-width: 0;
  border-style: solid;
  border-color: transparent;
  border-image: initial;
  border-radius: 999px;
  font-family: 'Montserrat', sans-serif;
  text-transform: uppercase;
  cursor: pointer;
  font-size: $font-size-md;
  padding: 0.75rem 1.5rem;

  @media screen and (min-width: $md) {
    padding: 18px 41px;
    font-size: $font-size-xl;
  }

  .btn-label {
    display: flex;
    justify-content: center;
    align-items: center;
    min-width: 57px;

    .btn-label__icon {
      background: var(--button__purple-color);
    }

    .btn-label__icon-left, .btn-label__icon-right {
      height: 100%;
      object-fit: contain;
    }

    .btn-label__icon-left {
      margin-right: 8px;
    }

    .btn-label__icon-right {
      margin-left: 8px;
    }
  }

  .ball-beat {
    display: none;
  }

  &.disabled {
    cursor: not-allowed;
    box-shadow: none;
  }

  &.waiting {
    cursor: wait;

    .btn-label {
      visibility: hidden;
      height: 0;
    }

    .ball-beat {
      display: block;
      margin-top: 7px;
      margin-bottom: 8px;
    }
  }
}

.purple {
  color: var(--button__purple-color);
  background-image: var(--button__purple-background);
  box-shadow: var(--button__purple-box-shadow);

  &:hover {
    background-image: var(--button__purple-background--hover);
  }

  &.disabled {
    color: var(--button__purple-color--disabled);
    background-image: var(--button__purple-background--disabled);
    box-shadow: none;

    .btn-label {
      .btn-label__icon {
        background: var(--button__purple-color--disabled);        
      }
    }
  }
}
</style>

