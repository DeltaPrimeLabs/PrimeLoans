<template>
  <div class="wallet-select">
    <div class="indicator" @click="toggleDropdown()">
      <div class="network">Connect Wallet</div>
      <DeltaIcon
          :class="['chevron', showOptions ? 'chevron--open' : '']"
          :icon-src="'src/assets/icons/chevron-down.svg'"
          :size="17"
      ></DeltaIcon>
    </div>
    <div class="dropdown__wrapper">
      <transition name="slide">
        <div class="dropdown" v-if="showOptions">
          <div class="dropdown__header">Select wallet</div>
          <div
              :class="['option']"
              v-for="wallet in wallets"
              @click="connectWallet(wallet.id)">
            <img class="option__logo" :src="wallet.logoSrc">
            <div class="option__name">{{ wallet.name }}</div>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script>
import DeltaIcon from "./DeltaIcon.vue";
import config from "../config";

const ethereum = window.ethereum;

export default {
  name: "WalletSelect",
  components: {DeltaIcon},
  data() {
    return {
      wallets: [
        {
          id: 'RABBY',
          name: 'Rabby',
          logoSrc: 'src/assets/logo/rabby-wallet.png',
        },
        {
          id: 'WALLET_CONNECT',
          name: 'WalletConnect',
          logoSrc: 'src/assets/logo/wallet-connect.png',
        },
      ],
      selectedNetwork: undefined,
      showOptions: false,
    }
  },
  computed: {
  },
  methods: {
    toggleDropdown() {
      this.showOptions = !this.showOptions
      if (this.showOptions) {
        setTimeout(() => {
          document.body.addEventListener('click', this.closeDropdownIfClickedOutside);
        })
      } else {
        document.body.removeEventListener('click', this.closeDropdownIfClickedOutside);
      }
    },
    closeDropdownIfClickedOutside(event) {
      if (!event.target.classList.contains('dropdown')) {
        this.toggleDropdown()
      }
    },
    connectWallet(walletId) {
      this.$emit('walletSelected', walletId);
    }
  },
}
</script>

<style lang="scss" scoped>
.network-select {
  position: relative;
}

.indicator {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.chevron {
  background: var(--network-select__chevron-color);
  transition: transform 200ms ease-in-out;

  &.chevron--open {
    transform: rotate(180deg);
  }
}

.dropdown__wrapper {
  position: absolute;
  top: calc(100% + 9px);
  left: 50%;
  transform: translateX(-50%);
  overflow: hidden;
  z-index: 1;
}

.dropdown {
  padding: 10px 12px;
  border-radius: 10px;
  border: 2px solid var(--network-select__dropdown-border-color);
  background: var(--network-select__dropdown-background);
  box-shadow: var(--network-select__dropdown-shadow);
}

.dropdown__header {
  font-size: 12px;
  color: var(--network-select__dropdown-header-color);
  margin-bottom: 9px;
  margin-left: 11px;
  pointer-events: none;
}

.option {
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 155px;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 5px;
  color: var(--network-select__option-name-color);
  border: 1px solid transparent;

  &:not(:last-child) {
    margin-bottom: 6px;
  }

  &.option--selected {
    cursor: auto;
    background: var(--network-select__option-background--selected);
    font-weight: 600;
    pointer-events: none;

    .option__name {
      color: var(--network-select__option-name-color--selected);
    }
  }

  &:not(.option--selected):hover {
    border-color: var(--network-select__option-border--hover);
  }
}

.option__logo {
  height: 18px;
  width: 18px;
  margin-right: 8px;
}

.logo {
  height: 18px;
  width: 18px;
}

.network {
  font-size: 16px;
  color: var(--network-select__indicator-network-color);
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.25s ease;
  transform: translateY(-100%);
}

.slide-leave-to {
  transform: translateY(-100%);
}

.slide-enter-to {
  transform: translateY(0%);
}
</style>
