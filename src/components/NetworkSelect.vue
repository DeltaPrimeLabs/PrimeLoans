<template>
  <div class="network-select">
    <div class="indicator" @click="toggleDropdown()">
      <img class="logo" :src="selectedNetwork.logoSrc"/>
      <div class="network">{{ selectedNetwork.chainName }}</div>
      <DeltaIcon
          :class="['chevron', showOptions ? 'chevron--open' : '']"
          :icon-src="'src/assets/icons/chevron-down.svg'"
          :size="17"
      ></DeltaIcon>
    </div>
    <div class="dropdown__wrapper">
      <transition name="slide">
        <div class="dropdown" v-if="showOptions">
          <div class="dropdown__header">Select network</div>
          <div
              :class="['option', network.chainId === selectedNetwork.chainId ? 'option--selected' : '']"
              v-for="network in networks"
              @click="switchChain(network.chainId)">
            <img class="option__logo" :src="network.logoSrc"></img>
            <div class="option__name">{{ network.chainName }}</div>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script>
import {mapState} from "vuex";
import DeltaIcon from "./DeltaIcon.vue";
import Vue from "vue";
import config from "../config";

const ethereum = window.ethereum;

export default {
  name: "NetworkSelect",
  components: {DeltaIcon},
  data() {
    return {
      networks: [
        {
          chainId: 43114,
          chainName: 'Avalanche',
          logoSrc: 'src/assets/icons/avax-icon.svg',
        },
        {
          chainId: 42161,
          chainName: 'Base',
          logoSrc: 'src/assets/icons/base-icon.svg',
        },
        {
          chainId: 42161,
          chainName: 'Arbitrum',
          logoSrc: 'src/assets/icons/arb-icon.svg',
        },
      ],
      selectedNetwork: undefined,
      showOptions: false,
      networkConfigs: [
        {
          chainId: this.toHex(43114),
          chainName: 'Avalanche',
          rpcUrls: [config.readRpcUrl],
          nativeCurrency: {
            name: 'AVAX',
            symbol: 'AVAX',
            decimals: 18
          }
        },
        {
          chainId: this.toHex(42161),
          chainName: 'Base',
          rpcUrls: ['https://arbitrum-mainnet.core.chainstack.com/9a30fb13b2159a76c8e143c52d5579bf'],
          nativeCurrency: {
            name: 'ETH',
            symbol: 'ETH',
            decimals: 18
          }
        },
      ]
    }
  },
  computed: {
    ...mapState('network', ['account', 'provider']),
  },
  methods: {
    toggleDropdown() {
      console.log(config.readRpcUrl);
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
    async switchChain(chainId) {
      try {
        await ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{chainId: this.toHex(chainId)}],
        });
      } catch (switchError) {
        // This error code indicates that the chain has not been added to MetaMask
        if (switchError.code === 4902) {
          const selectedNetwork = this.networkConfigs.find(network => network.chainId === this.toHex(chainId))
          if (selectedNetwork) {
            try {
              await ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [selectedNetwork]
              });
            } catch (addError) {
              Vue.$toast.error('Error while adding network');
            }
          }
        } else {
          Vue.$toast.error('Error while switching network');
        }
      }
    }
  },
  created() {
    setTimeout(() => {
      this.selectedNetwork = this.networks.find(network => network.chainId === window.chainId)
    }, 500);
  }
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
  width: 132px;
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
