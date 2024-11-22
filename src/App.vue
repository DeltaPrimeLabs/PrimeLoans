<template>
  <div class="page-content">
<!--    <button v-on:click="testClick()">test</button>-->
    <Banner v-if="showNetworkBanner">
      You are connected to a wrong network. <a @click="connectToProperChain"><b>Click here</b></a> to switch to the
      correct one.
    </Banner>
    <Banner v-if="showConnectBanner">
      You are not connected to Metamask. <a @click="initNetwork"><b>Click here</b></a> to connect.
    </Banner>
    <Banner v-if="showMetamaskBanner">
      Please download and activate
      <a href="https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn" target="_blank"><b>Metamask
        plugin</b></a>.
    </Banner>
    <Banner v-if="highGasPrice && !showMetamaskBanner && !showNetworkBanner && !showUpgradeBanner" :closable="true">
      Gas prices are high at the moment. Be careful with your transactions.
    </Banner>
    <Banner v-if="protocolPaused">
      The protocol is paused because of an upgrade.
    </Banner>
    <Banner v-if="oracleError">
      The protocol detected unusual market behavior. Some functions might be not available.
    </Banner>
    <div class="content">
      <div class="top-bar">
        <a href="https://deltaprime.io/">
          <img src="src/assets/icons/deltaprime.svg" class="logo">
        </a>
        <!--      <div class="connect" v-if="!account" v-on:click="initNetwork()">Connect to wallet</div>-->
        <Wallet class="wallet"/>
      </div>
      <router-view></router-view>
      <ProgressBar></ProgressBar>
    </div>
  </div>

</template>


<script>
import Navbar from '@/components/Navbar.vue';
import Wallet from '@/components/Wallet.vue';
import Banner from '@/components/Banner';
import {mapActions, mapState} from 'vuex';
import config from '@/config';

const ethereum = window.ethereum;
import Vue from 'vue';
import Button from './components/Button';
import ProgressBar from './components/ProgressBar';

export default {
  components: {
    ProgressBar,
    Button,
    Navbar,
    Wallet,
    Banner
  },
  data: () => {
    return {
      showNetworkBanner: false,
      showMetamaskBanner: false,
      showConnectBanner: false,
      highGasPrice: false,
      gasPriceIntervalId: null
    };
  },
  async created() {
    await this.initNetwork();

    if (!ethereum) {
      this.showMetamaskBanner = true;
      return;
    }

    if (await this.checkConnectedChain() !== config.chainId) {
      this.showNetworkBanner = true;
      return;
    }

    await this.metamaskChecks();

    if (!this.provider || !this.account) {
      this.showConnectBanner = true;
      return;
    }

    this.initGasPrices();
  },

  mounted() {
    document.addEventListener('keyup', (event) => {
      if (event.key === 'Escape') {
        this.closeModal();
      }
    });
    this.watchCloseModal();
  },
  computed: {
    ...mapState('network', ['account', 'provider']),
    ...mapState('fundsStore', ['protocolPaused', 'oracleError']),
    ...mapState('serviceRegistry', ['modalService']),
  },
  methods: {
    ...mapActions('network', ['initNetwork']),
    ...mapActions('nft', ['initNfts']),
    async checkConnectedChain() {
      const chainId = await ethereum.request({method: 'eth_chainId'});

      ethereum.on('chainChanged', () => {
        window.location.reload();
      });

      return this.toDec(chainId);
    },
    async connectToProperChain() {
      try {
        await ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{chainId: this.toHex(config.chainId)}],
        });
      } catch (switchError) {
        // This error code indicates that the chain has not been added to MetaMask
        if (switchError.code === 4902) {
          let walletParams;
          switch (config.chainId) {
            case 2140:
              walletParams = {
                chainName: 'Forked Avalanche',
                chainId: this.toHex(config.chainId),
                rpcUrls: ['https://207.154.255.139/'],
                nativeCurrency: {
                  name: 'AVAX',
                  symbol: 'AVAX',
                  decimals: 18
                }
              };
              break;
            case 43114:
              walletParams = {
                chainName: 'Avalanche Mainnet C-Chain',
                chainId: this.toHex(config.chainId),
                rpcUrls: ['https://rpc.ankr.com/avalanche'],
                nativeCurrency: {
                  name: 'AVAX',
                  symbol: 'AVAX',
                  decimals: 18
                }
              };
              break;
            case 43113:
              walletParams = {
                chainName: 'Avalanche FUJI C-Chain',
                chainId: this.toHex(config.chainId),
                rpcUrls: ['https://api.avax-test.network/ext/bc/C/rpc'],
                nativeCurrency: {
                  name: 'AVAX',
                  symbol: 'AVAX',
                  decimals: 18
                }
              };
          }

          try {
            await ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [walletParams]
            });
          } catch (addError) {
            Vue.$toast.error('Error while adding network');
          }
        } else {
          Vue.$toast.error('Error while switching network');
        }
      }
    },
    async metamaskChecks() {
      window.ethereum.on('accountsChanged', function () {
        window.location.reload();
      });
    },
    initGasPrices() {
      this.gasPriceIntervalId = setInterval(async () => {
        this.checkGasPrices();
      }, 2000);
    },
    async checkGasPrices() {
      const resp = await fetch('https://gavax.blockscan.com/gasapi.ashx?apikey=key&method=gasoracle');
      const blockchainData = await resp.json();

      this.highGasPrice = parseInt(blockchainData.result.SafeGasPrice) > 150;
    },

    watchCloseModal() {
      this.modalService.watchCloseModal().subscribe(() => {
        this.closeModal();
      })
    },

  },
  destroyed() {
    clearInterval(this.gasPriceIntervalId);
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

a {
  color: black;
}

.page-content:before {
  content: ' ';
  display: block;
  position: fixed;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  opacity: 0.08;
  z-index: -1;

  background-image: linear-gradient(152deg, #7476fc 23%, #ff6f43 65%, #f5217f 96%);
}

.content {
  position: relative;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 0 68px 0;

  .account-apr-widget-wrapper {
    position: absolute;
    top: 0;
    left: calc(50% - 111px);
  }
}

.logo {
  cursor: pointer;
  margin-left: 5vw;

  @media screen and (min-width: $md) {
    margin-left: 40px;
  }

  &:hover {
    transform: scale(1.02);
  }
}

.connect, .wallet {
  margin-right: 5vw;

  @media screen and (min-width: $md) {
    margin-right: 40px;
  }
}

.connect {
  white-space: nowrap;
  color: #6b70ed;
  cursor: pointer;

  &:hover {
    font-weight: 500;
  }
}
</style>

