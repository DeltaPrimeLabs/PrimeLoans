<template>
  <div class="wallet-component">
    <div v-if="account" class="wallet">
      <NetworkSelect v-if="!isClaimPage"></NetworkSelect>
      <div class="prime-account" v-if="hasSmartLoanContract && !isClaimPage">
        <div class="separator"></div>
        <img class="logo" src="src/assets/logo/deltaprime.svg"/>
        <div class="account" v-tooltip="{content: 'Your Prime Account address', classes: 'info-tooltip long'}">
          <a :href="getPrimeAccountExplorerUrl" target="_blank">{{ smartLoanContract.address | tx(true) }}</a>
        </div>
      </div>
      <div v-if="!isClaimPage" class="separator"></div>
      <img class="logo" :src="getWalletIcon"/>
      <div class="account" v-tooltip="{content: 'Your wallet address', classes: 'info-tooltip long'}">
        <a :href='getWalletExplorerUrl' target="_blank">{{ account | tx(true) }}</a>
      </div>
      <div class="balance">{{ accountBalance | avax(3) }}</div>
      <img class="logo" :src="tokenLogos[nativeToken]"/>
      <div v-if="!isClaimPage" class="separator"></div>
      <IconButton v-if="!isClaimPage"
                  :disabled="!account || !notifiScreenLoaded || !isNotifiEnabled"
                  ref="notifiBtn"
                  class="alert-icon"
                  :icon-src="'src/assets/icons/alert_icon.svg'" :size="20"
                  v-tooltip="{content: notificationTooltip, classes: 'info-tooltip'}"
                  @click="showModal = !showModal">
      </IconButton>
      <NotifiModal
        :show="showModal"
        v-closable="{
        exclude: ['notifiBtn'],
        handler: 'handleClose'
      }"
      >
      </NotifiModal>
      <div v-if="!isClaimPage" class="separator"></div>
      <IconButton ref="notifiBtn"
                  class="alert-icon"
                  :icon-src="'src/assets/icons/cross.svg'" :size="20"
                  @click="resetWallet">
      </IconButton>
    </div>

    <div v-if="!account">
      <WalletSelect @walletSelected="connectWallet"></WalletSelect>
    </div>
  </div>
</template>


<script>
import {mapState} from 'vuex';
import IconButton from './IconButton.vue';
import NetworkSelect from './NetworkSelect.vue';
import NotifiModal from './notifi/NotifiModal.vue';
import config from '../config';
import Button from './Button.vue';
import WalletSelect from './WalletSelect.vue';

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

const nativeTokesLogos = {
  ETH: 'src/assets/logo/eth.svg',
  AVAX: 'src/assets/icons/avax-icon.svg',
};

export default {
  name: 'Wallet',
  components: {
    WalletSelect,
    IconButton,
    NotifiModal,
    NetworkSelect,
    Button
  },
  props: {
    isClaimPage: null,
  },
  computed: {
    ...mapState('fundsStore', ['smartLoanContract', 'noSmartLoan']),
    ...mapState('serviceRegistry', ['notifiService', 'accountService', 'providerService']),
    network() {
      return 'Avalanche';
    },

    hasSmartLoanContract() {
      return this.smartLoanContract && this.smartLoanContract.address !== NULL_ADDRESS;
    },

    isNotifiEnabled() {
      return config.notifiEnabled;
    },

    getPrimeAccountExplorerUrl() {
      switch (window.chain) {
        case 'avalanche': {
          return `https://snowtrace.dev/address/${this.smartLoanContract.address}`;
        }
        case 'arbitrum': {
          return `https://arbiscan.io/address/${this.smartLoanContract.address}`;
        }
      }
    },

    getWalletExplorerUrl() {
      switch (window.chain) {
        case 'avalanche': {
          return `https://snowtrace.dev/address/${this.account}`;
        }
        case 'arbitrum': {
          return `https://arbiscan.io/address/${this.account}`;
        }
      }
    },

    getWalletIcon() {
      if (this.provider && this.provider.provider) {
        if (this.provider.provider.isRabby) {
          return 'src/assets/logo/rabby.png';
        }

        if (this.provider.provider.isMetaMask) {
          return 'src/assets/logo/metamask.svg';
        }
      }
    },
  },
  data() {
    return {
      showModal: false,
      notifiScreenLoaded: false,
      notifi: null,
      tokenLogos: nativeTokesLogos,
      nativeToken: config.nativeToken,
      accountBalance: null,
      account: null,
      provider: null,
    };
  },
  mounted() {
    this.watchNotifi();
    this.watchNotifiCurrentScreen();
    this.watchAccountBalance();
    this.watchAccount();
    this.watchProvider();
  },
  methods: {
    watchNotifi() {
      this.notifiService.observeNotifi().subscribe((notifi) => {
        this.notifi = notifi;
      });
    },

    handleClose() {
      this.showModal = false;
      this.notifiService.refreshClientInfo(this.notifi.client);
    },

    watchNotifiCurrentScreen() {
      this.notifiService.observeCurrentScreen().subscribe(() => {
        this.notifiScreenLoaded = true;
      });
    },

    watchAccountBalance() {
      this.accountService.observeBalance().subscribe(balance => {
        console.log('received account balance', balance);
        this.accountBalance = balance;
      });
    },

    watchAccount() {
      this.accountService.observeAccount().subscribe(account => {
        this.account = account;
      });
    },

    watchProvider() {
      this.providerService.observeProvider().subscribe(provider => {
        this.provider = provider;
      });
    },

    notificationTooltip() {
      return this.isNotifiEnabled ?
          `
          <span>Notifications</span>
          <div class='tooltip-extra'>
            <img class="tooltip-extra__icon" src="src/assets/icons/rating.png"/>
            <span>This is a Prime feature</span>
          </div>
        `
          :
          `<span>Coming soon!</span>`;
    },

    connectWallet(walletId) {
      switch (walletId) {
        case 'RABBY': {
          this.providerService.initMetamaskProvider();
          break;
        }

        case 'WALLET_CONNECT': {
          this.providerService.initWalletConnectProvider();
          break;
        }
      }
    },

    resetWallet() {
      this.providerService.resetWallet();
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.wallet {
  display: flex;
  font-weight: 500;
  font-size: 14px;
  position: relative;

  @media screen and (max-width: $md) {
    font-size: initial;
  }

  a {
    color: var(--wallet-a-color);
  }

  .balance {
    margin-right: 6px;
    margin-left: 6px;
  }

  .prime-account {
    display: flex;
  }
}

.account {
  font-weight: 500;
}

.logo {
  height: 16px;
  vertical-align: middle;
  margin-right: 5px;
  transform: translateY(2px);
}

.separator {
  width: 2px;
  height: 25px;
  flex-grow: 0;
  margin: 0 13px 0 14px;
  transform: translateY(-2px);
  border: solid 1px var(--wallet-separator-color);
}

.alert-icon {
  cursor: pointer;
  margin-right: 5px;
  transform: translateY(-2px);
}
</style>

