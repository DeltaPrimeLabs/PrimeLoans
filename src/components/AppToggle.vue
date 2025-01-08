<template>
  <div class="app-toggle" v-on:click="onClick()"
       :class="{'app-toggle--pa': current === 'Degen Account', 'app-toggle--savings': current === 'Savings'}">
    <div class="app-toggle__switch">
      <div class="app-name">
        <div class="app-name__name app-name__name--pa">Degen Account</div>
        <div class="app-name__name app-name__name--savings">Savings</div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "AppToggle",
  mounted() {
    this.current = window.location.href.includes('prime-account') ? 'Degen Account' : 'Savings';
  },
  methods: {
    onClick() {
      this.current = this.current === 'Degen Account' ? 'Savings' : 'Degen Account';
      this.$router.push({ path: this.current === 'Degen Account' ? '/prime-account' : '/pools' })
      setTimeout(() => {
        window.location.reload();
      }, 500)
    }
  },
  data() {
    return {
      current: null
    }
  }
}
</script>

<style scoped lang="scss">
.app-toggle {
  cursor: pointer;
  height: 26px;
  padding: 2.5px;
  border-radius: 15.5px;
  background-color: var(--app-toggle__background);
  transition: padding 300ms ease-in-out, width 300ms ease-in-out;

  &.app-toggle--savings {
    padding-right: 22.5px;

    .app-toggle__switch {
      width: 76px;
    }

    .app-name__name--savings {
      opacity: 1;
    }

    .app-name__name--pa {
      opacity: 0;
    }

    .app-name {
      animation: fade-in-out-1 300ms linear;

      @keyframes fade-in-out-1 {
        0% {
          transform: scale(1);
        }
        50% {
          transform: scale(0);
        }
        100% {
          transform: scale(1);
        }
      }
    }
  }

  &.app-toggle--pa {
    padding-left: 22.5px;

    .app-toggle__switch {
      width: 130px;
    }

    .app-name__name--savings {
      opacity: 0;
    }

    .app-name__name--pa {
      opacity: 1;
    }

    .app-name {
      animation: fade-in-out-2 300ms ease-in-out;

      @keyframes fade-in-out-2 {
        0% {
          transform: scale(1);
        }
        50% {
          transform: scale(0);
        }
        100% {
          transform: scale(1);
        }
      }
    }
  }
}

.app-toggle__switch {
  height: 21px;
  position: relative;
  padding: 2px 10px;
  border-radius: 100px;
  background: var(--app-toggle__switch-background);
  color: var(--app-toggle__switch-color);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.2;
  box-shadow: var(--app-toggle__switch-box-shadow);
  transition: width 300ms ease-in-out;
}

.app-name {
  width: calc(100% - 20px);
  height: calc(100% - 4px);
  position: absolute;
  overflow: visible;
}

.app-name__name {
  position: absolute;
  transition: opacity 200ms ease-in-out;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);

  &.app-name__name--pa {
    width: 120px;
  }
}
</style>


