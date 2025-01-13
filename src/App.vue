<template>
  <div class="page-content">
    <Banner v-if="showNetworkBanner">
      You are connected to a wrong network. Please change to Avalanche or Arbitrum.
    </Banner>
    <Banner v-if="showNoWalletBanner">
      You have no wallet installed. Please download and activate
      <a class="banner-link"
         href="https://chrome.google.com/webstore/detail/rabby-wallet/acmacodkjbdgmoleebolmdjonilkdbch" target="_blank">
        <b>
          Rabby
        </b>
      </a>
      or
      <a class="banner-link" href="https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn"
         target="_blank">
        <b>
          Metamask
        </b>
      </a>.
    </Banner>
    <Banner v-if="showConnectBanner">
      You are not connected to Metamask. <a class="banner-link" @click="initNetwork"><b>Click here</b></a> to connect.
    </Banner>
<!--    <Banner v-if="showArbitrumDepositorBanner" background="green-accent" :closable="true">-->
<!--      rTKN - PRIME conversion submissions close at 13th of November, 2pm CET.-->
<!--      <a class="banner-link" href="https://discord.com/channels/889510301421166643/912702114252329060/1303715753735753780"-->
<!--         target="_blank">-->
<!--        <b>-->
<!--          Read more.-->
<!--        </b>-->
<!--      </a>-->
<!--    </Banner>-->
    <Banner v-if="showInterestRateBanner" background="green-accent" :closable="true">
      Interest rate model will be updated at 12:00 CET. <a class="banner-link"
                                                           href="https://discord.com/channels/889510301421166643/912702114252329060/1180080211254050897"><b>Read
      more</b></a>.
    </Banner>
    <Banner v-if="showMetamaskBanner">
      Please download and activate
      <a class="banner-link" href="https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn"
         target="_blank"><b>Metamask
        plugin</b></a>.
    </Banner>
    <Banner v-if="highGasPrice && !showMetamaskBanner && !showNetworkBanner && !showArbitrumCongestionBanner"
            :closable="true">
      Gas prices are high at the moment. Be careful with your transactions.
    </Banner>
    <Banner v-if="oracleError">
      Data feeds error. Some functions might be not available.
    </Banner>

    <Banner v-if="showRestrictedCountryBanner">
      Important: users connecting from your country will not be able to access our services starting June 28th.
      <a class="banner-link"
         href="https://discord.com/channels/889510301421166643/912702114252329060/1251122070172205067"
         target="_blank"><b>Read more.</b>
      </a>
    </Banner>
    <!--    <Banner v-if="showArbitrumPrimeAccountBanner" background="green-accent" :closable="true">
          Last chance to mint GM for the current milestone
        </Banner>-->
    <Banner v-if="showArbitrumCongestionBanner" :closable="true">
      The Arbitrum chain is fully congested resulting in failed transactions across apps. Please join our <a
      href='https://discord.gg/57EdDsvhxK' target='_blank'><b>Discord</b></a> to learn more
    </Banner>

    <Banner v-if="showDeprecatedAssetsBanner">
      We are dropping support to some tokens of your Prime Account. Please review your portfolio
    </Banner>
    <Banner v-if="showAvalancheDepositorBanner" :closable="true" background="green">
      THe Boost airdrop will begin on Monday 6PM CET.
    </Banner>
    <Banner v-if="showAvalanchePrimeAccountBanner || showArbitrumPrimeAccountBanner" background="green" :closable="true">
      The Prime Account is granularly being unpaused.
      <a class="banner-link"
         href="https://discord.com/channels/889510301421166643/912702114252329060/1309493526601662484"
         target="_blank"><b>Read more.</b>
      </a>
    </Banner>
    <div class="content">
      <div class="top-bar">
        <div class="top-bar__left-part">
          <a href="https://deltaprime.io/">
            <img src="src/assets/icons/deltaprime.svg" class="logo">
          </a>
          <AppToggle v-if="!isClaimPage" class="top-bar__app-toggle"></AppToggle>
          <ThemeToggle v-if="!isClaimPage" class="top-bar__theme-toggle"></ThemeToggle>
          <div v-if="isSavingsPage" class="protocol-insurance">
            <span>Reserve Fund:</span>
            <span class="insurance-value">$800,000</span>
            <InfoIcon class="info__icon"
                      :tooltip="{content: 'Atomica insurance pools.', classes: 'info-tooltip'}"
                      :classes="'info-tooltip'"></InfoIcon>
          </div>
        </div>
        <!--      <div class="connect" v-if="!account" v-on:click="initNetwork()">Connect to wallet</div>-->
        <Wallet :is-claim-page="isClaimPage" class="wallet"/>
      </div>
      <router-view></router-view>
      <ProgressBar></ProgressBar>
      <ProtectedByBar></ProtectedByBar>
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
const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
const LAUNCH_TIME = 1719853200000;
import Vue from 'vue';
import Button from './components/Button';
import ProgressBar from './components/ProgressBar';
import ThemeToggle from './components/ThemeToggle.vue';
import {fromWei, getCountdownString} from './utils/calculate';
import AppToggle from './components/AppToggle.vue';
import ProtectedByBar from './components/ProtectedByBar.vue';
import InfoIcon from './components/InfoIcon.vue';
import TermsModal from './components/TermsModal.vue';
import {combineLatest, forkJoin, map} from 'rxjs';
import fetch from 'node-fetch';
import RestrictedCountryModal from './components/RestrictedCountryModal.vue';
import SPrimeModal from './components/SPrimeModal.vue';
import TermsService from "./services/termsService";

const BUY_SPRIME_MODAL_CLOSED = 'BUY_SPRIME_MODAL_CLOSED';

export default {
  components: {
    InfoIcon,
    ProtectedByBar,
    AppToggle,
    ThemeToggle,
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
      gasPriceIntervalId: null,
      showGlpBanner: false,
      showDepositBanner: false,
      showInterestRateBanner: false,
      showPrimeAccountBanner: false,
      showAffectedPrimeAccountBanner: false,
      showArbitrumDepositorBanner: false,
      showArbitrumPrimeAccountBanner: false,
      showAvalancheDepositorBanner: false,
      showAvalanchePrimeAccountBanner: false,
      showArbitrumCongestionBanner: false,
      showRestrictedCountryBanner: false,
      remainingTime: '',
      darkMode: false,
      showNoWalletBanner: window.noWalletInstalled,
      isSavingsPage: false,
      isClaimPage: false,
      signingTermsInProgress: false,
      showDeprecatedAssetsBanner: false,
      restrictModalOpen: false,
      buySPrimeModalOpened: false,
      showWarningBanner: false,
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

    if (window.location.href.includes('prime-account')) {
      this.showGlpBanner = true;
    }

    if (window.location.href.includes('pools')) {
      this.showDepositBanner = true;
      this.isSavingsPage = true;
    }

    if (window.location.href.includes('claim')) {
      this.isClaimPage = true;
    }

    if (window.location.href.includes('prime-account')) {
      this.showPrimeAccountBanner = true;
    }

    if (config.chainId === 42161) {
      if (window.location.href.includes('pools')) {
        // this.showArbitrumDepositorBanner = true;
      }
      if (window.location.href.includes('prime-account')) {
        this.remainingTime = getCountdownString(1695218400000);
        this.showArbitrumPrimeAccountBanner = true;
      }
    }

    if (config.chainId === 43114) {
      if (window.location.href.includes('pools')) {
        this.showAvalancheDepositorBanner = true;
      }
      if (window.location.href.includes('prime-account')) {
        // this.showAvalanchePrimeAccountBanner = true;
      }
    }
  },

  mounted() {
    window.testProperty = 'test value'
    document.addEventListener('keyup', (event) => {
      if (event.key === 'Escape') {
        this.closeModal();
      }
    });
    this.bullScoreService.setChain(window.chain)
    const url = document.location.href;
    const lastUrlPart = url.split('/').reverse()[0];
    this.checkClaimTheme(`/${lastUrlPart}`)
    this.watchCloseModal();
    this.checkTerms();
    this.watchHasDeprecatedAssets();
    this.watchPrimeAccountLoaded();
    this.watchIntents();
    setTimeout(() => {
      this.checkWallet();
    }, 500)
    this.getCountry();
  },
  computed: {
    ...mapState('network', ['account', 'provider']),
    ...mapState('fundsStore', ['protocolPaused', 'oracleError', 'smartLoanContract']),
    ...mapState('serviceRegistry', [
      'modalService',
      'termsService',
      'accountService',
      'poolService',
      'deprecatedAssetsService',
      'globalActionsDisableService',
      'paWithdrawQueueService',
      'bullScoreService',
    ]),
    ...mapState('poolStore', ['pools'])
  },
  methods: {
    ...mapActions('network', ['initNetwork']),
    ...mapActions('fundsStore', ['updateAssetIntents']),
    async checkConnectedChain() {
      const chainId = await ethereum.request({method: 'eth_chainId'});

      ethereum.on('chainChanged', async () => {
        const chainId = await ethereum.request({method: 'eth_chainId'});
        location.reload();

        if (chainId == this.toHex(config.chainId)) {
          this.showNetworkBanner = false;
        } else {
          this.showNetworkBanner = true;
        }
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
                rpcUrls: [config.readRpcUrl],
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

      // this.highGasPrice = parseInt(blockchainData.result.SafeGasPrice) > 150;
    },

    hasUnwindedGlp() {
      return ['0x2716f9dd4058b2e2023a79100795c1647f9a5cfa', '0xc991663FA798E5f27C854EE751285C23796EF6f6', '0xB0399dAC8f4D4100b49b2a7B3873481114229D18', '0x57356793365301b26bD8dA93a7249C92A2003b1D', '0xfb5845A7128149215a92B7dd01985C31EdA3A202', '0x76Ee7EE3C1B60e2bcA3Effb3d266BF0688BF4297', '0xfA713713B1ACd89A00e6b35512161630d5ea90de', '0xc5dE27336E04e4A6EB1A766323d3AD1d21efA767', '0xfE6776498f7b814A6b7b69fc37cDf8A993B01708', '0xC69aDFF7F2f28d5339fCe333259B1d804ffA44B3', '0x648349e02C549986C8ef2b75514d73040D581Acc', '0x6f36736A0D146e8B2DE5d580fe181Aa2f9f46D2a', '0x8aC228d85989cea83b8C07b8829524214C92Fee8', '0x5D80a1c0a5084163F1D2620c1B1F43209cd4dB12', '0x6C21A841d6f029243AF87EF01f6772F05832144b', '0x8c1A4C98C470900567FB9e764243c89cDa79400C', '0x254D63d3eDfDf71a50D8Fa51B7D5083b46381E5a', '0xB8e6F532f6FeE638d369228E87af10A79ecaaf63', '0xbCc8cB0a825c61355a460da85159f1B43D5d49AB', '0xF20EeBD5E7B0b812CF2A892772439C1B945287fE'].includes(this.account);
    },

    watchCloseModal() {
      this.modalService.watchCloseModal().subscribe(() => {
        this.closeModal();
      })
    },

    watchPrimeAccountLoaded() {
      this.accountService.observeSmartLoanContract().subscribe(() => {
        // this.showPrimeAccountBanner = false;
        // this.showArbitrumPrimeAccountBanner = false;

        // if ([
        //   '0x2FfD0D2bEa8E922A722De83c451Ad93e097851F5',
        //   '0x0b7DcF8E70cF0f9c73D2777d871F4eBD6150Bd3b',
        //   '0x48285109D4b959608C8E9691cAb1aFc244a80D5F',
        //   '0xCC5159C01C1bdAb6c607F800E71B84898597c9FE',
        //   '0xfeD94826098d636c517F7F1021B37EB465b9FCE4',
        //   '0x58c80413603841455b3C5abF08d6AA854F376086',
        //   '0xc00bE32F7669A3417AD26DD41352418Fc49eB0F7',
        //   '0x36a1bCcf37AF1E315888c2cA967B163c50B1D943',
        //   '0xb9967f0e4ea928550E3d05B0e57a627AB0302108',
        //   '0x7F23dc430AF70aBE865387d5b1FDC91c27daEcCB',
        //   '0x35C93a488906798341ce4267Ecb398dC2aD230a6',
        //   '0x0844F379be6E5b7Fd4A6D8f7A1b5146A68E23e9f',
        //   '0xeAA7425910Af14657ED96a278274e6e85D947f2D'
        // ].map(el => el.toLowerCase()).includes(this.smartLoanContract && this.smartLoanContract.address.toLowerCase())) {
        //   this.showAffectedPrimeAccountBanner = true;
        // }
      })
    },

    watchIntents() {
      this.paWithdrawQueueService.observeAssetIntents().subscribe(intents => {
        this.updateAssetIntents(intents)
      })
    },

    checkTerms() {
      combineLatest([
        this.accountService.observeAccountLoaded(),
        this.accountService.observeSmartLoanContract(),
        this.poolService.observePools(),
        this.getCountry()
      ])
        .subscribe(([walletAddress, smartLoanContract, pools, country]) => {
          const isSavingsPage = window.location.href.includes('pools');
          const isCountryRestricted = config.restrictedCountries.includes(country.country);

          if (isSavingsPage) {
            forkJoin(pools.map(pool => pool.contract.balanceOf(walletAddress)))
              .subscribe(bigNumberBalances => {
                const balances = bigNumberBalances.map(balance => fromWei(balance));
                if (balances.every(balance => balance === 0)) {
                  // console.log('SAVINGS PAGE - no deposits - terms not required');
                  if (isCountryRestricted) {
                    this.restrictApp(false);
                  } else {
                    this.openBuySPrimeModal();
                  }
                } else {
                  // console.log('SAVINGS PAGE - some deposit - checking terms');
                  if (isCountryRestricted) {
                    this.restrictApp(true);
                  } else {
                    this.termsService.checkTerms(walletAddress).then(signedTerms => {
                      const termsForCurrentPage = signedTerms.find(terms => terms.type === 'SAVINGS');
                      if (termsForCurrentPage === undefined || termsForCurrentPage.termsVersion !== TermsService.CURRENT_TERMS_VERSION) {
                        // console.log('SAVINGS PAGE - some deposit - terms not signed');
                        if (!this.signingTermsInProgress) {
                          this.handleTermsSign(walletAddress, true);
                        }
                      } else {
                        this.openBuySPrimeModal();
                      }
                    })
                  }
                }
              });
          } else {
            // console.log('PA PAGE - checking PA contract');
            if (smartLoanContract && smartLoanContract.address === NULL_ADDRESS) {
              // console.log('PA PAGE - no account - terms not required');
              if (isCountryRestricted) {
                this.restrictApp(false);
              } else {
                this.openBuySPrimeModal();
              }
            } else {
              // console.log('PA PAGE - account created - checking terms');
              if (isCountryRestricted) {
                this.restrictApp(true);
              } else {
                this.termsService.checkTerms(walletAddress).then(signedTerms => {
                  console.log(signedTerms);
                  const termsForCurrentPage = signedTerms.find(terms => terms.type === 'PRIME_ACCOUNT');
                  if (termsForCurrentPage === undefined || termsForCurrentPage.termsVersion !== TermsService.CURRENT_TERMS_VERSION) {
                    // console.log('PA PAGE - account created - terms not signed');
                    if (!this.signingTermsInProgress && smartLoanContract) {
                      this.handleTermsSign(walletAddress, false, smartLoanContract.address);
                    }
                  } else {
                    // console.log('PA PAGE - account created - terms signed');
                    this.openBuySPrimeModal();
                  }
                });
              }
            }
          }
        })
    },

    handleTermsSign(walletAddress, isSavings, paAddress) {
      this.signingTermsInProgress = true;
      const termsType = isSavings ? 'SAVINGS' : 'PRIME_ACCOUNT';
      const modalInstance = this.openModal(TermsModal);
      modalInstance.$on('SIGN_TERMS', async () => {
        const signResult = await this.termsService.signTerms(walletAddress, this.provider, true)
        await this.termsService.saveSignedTerms(paAddress, walletAddress, signResult, termsType);
        this.closeModal();
      })
    },

    watchHasDeprecatedAssets() {
      this.deprecatedAssetsService.observeHasDeprecatedAssets().subscribe(hasDeprecatedAssets => {
        if (hasDeprecatedAssets) {
          this.showDeprecatedAssetsBanner = true;
        }
      })
    },

    checkWallet() {
      if (this.provider && this.provider.provider) {
        if (this.provider.provider.isRabby) {
          window.isRabby = true;
          window.isMetaMask = false;
          return;
        }

        if (this.provider.provider.isMetaMask && !this.provider.provider.isRabby) {
          window.isMetaMask = true;
          window.isRabby = false;
          return;
        }
      }
    },

    async getCountry() {
      const countryRequest = await fetch('https://geo-service-frtt8nrlk-deltaprimelabs.vercel.app/api/hello');
      const countryResponse = await countryRequest.json();
      return countryResponse;
    },

    restrictApp(allowWithdrawals) {
      if (allowWithdrawals) {
        this.globalActionsDisableService.disableActionGlobally('ADD_FROM_WALLET');
        this.globalActionsDisableService.disableActionGlobally('BORROW');
        this.globalActionsDisableService.disableActionGlobally('WRAP');
        this.globalActionsDisableService.disableActionGlobally('BRIDGE_COLLATERAL');
        this.globalActionsDisableService.disableActionGlobally('DEPOSIT');
        this.globalActionsDisableService.disableActionGlobally('DEPOSIT_AND_STAKE');
        this.globalActionsDisableService.disableActionGlobally('MIGRATE');
        this.globalActionsDisableService.disableActionGlobally('BRIDGE');
        this.globalActionsDisableService.disableActionGlobally('BRIDGE_DEPOSIT');
        this.globalActionsDisableService.disableActionGlobally('SWAP_DEPOSIT');
        this.globalActionsDisableService.disableActionGlobally('STAKE');
        this.globalActionsDisableService.disableActionGlobally('PROVIDE_LIQUIDITY');
        this.globalActionsDisableService.disableActionGlobally('PARTNER_PROFILE');
        this.globalActionsDisableService.disableActionGlobally('ADD_LIQUIDITY');
        this.globalActionsDisableService.disableActionGlobally('FUND_AND_STAKE');
        this.globalActionsDisableService.disableActionGlobally('LONG');
        this.globalActionsDisableService.disableActionGlobally('SHORT');
        this.globalActionsDisableService.disableActionGlobally('CONVERT_GLP_TO_GM');
        this.globalActionsDisableService.disableActionGlobally('CREATE_ACCOUNT');
        this.globalActionsDisableService.disableActionGlobally('IMPORT_AND_STAKE');
        this.globalActionsDisableService.disableActionGlobally('CREATE_LP');
        this.globalActionsDisableService.disableActionGlobally('MINT');
        this.globalActionsDisableService.disableActionGlobally('REBALANCE');
        this.globalActionsDisableService.disableActionGlobally('REDEEM');
        this.globalActionsDisableService.disableActionGlobally('BUY');
      } else {
        this.globalActionsDisableService.enableReadonlyMode();
      }
      if (!this.restrictModalOpen) {
        const modal = this.openModal(RestrictedCountryModal);
        modal.allowWithdrawals = allowWithdrawals;
        setTimeout(() => {
          this.$forceUpdate();
        })
        this.restrictModalOpen = true;
      }
    },

    checkClaimTheme(path) {
      this.isClaimPage = path === '/claim'
      if (this.isClaimPage) {
        document.documentElement.classList.remove('theme--dark')
        document.documentElement.classList.add('theme--light')
      } else {
        const wasDark = localStorage.getItem('PA_VIEW_THEME') === 'DARK'
        document.documentElement.classList.remove(wasDark ? 'theme--light' : 'theme--dark')
        document.documentElement.classList.add(wasDark ? 'theme--dark' : 'theme--light')
      }
    },

    openBuySPrimeModal() {
      const now = new Date().getTime();
      if (now > LAUNCH_TIME) {
        const buySPrimeModalClosedOnce = localStorage.getItem(BUY_SPRIME_MODAL_CLOSED);
        if (!this.buySPrimeModalOpened && !buySPrimeModalClosedOnce) {
          const sprimeModalInstance = this.openModal(SPrimeModal);
          this.buySPrimeModalOpened = true;
          sprimeModalInstance.$on('CLOSE', () => {
            localStorage.setItem(BUY_SPRIME_MODAL_CLOSED, 'true');
          })
        }
      }
    },

  },
  watch:{
    $route (to){
      this.checkClaimTheme(to.fullPath)
    }
  },
  destroyed() {
    clearInterval(this.gasPriceIntervalId);
  }
};
</script>


<style lang="scss">
@import "~@/styles/themes/theme-dark";
@import "~@/styles/themes/theme-light";

html {
  color: var(--default-text-color);

  ::placeholder {
    color: var(--default-input-placeholder-color);
    opacity: 1;
  }

  :-ms-input-placeholder {
    color: var(--default-input-placeholder-color);
  }

  ::-ms-input-placeholder {
    color: var(--default-input-placeholder-color);
  }
}
</style>
<style lang="scss" scoped>
@import "~@/styles/variables";

a {
  color: black;
}

.page-content:before {
  content: ' ';
  display: block;
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: var(--app-page-content__background--opacity);
  z-index: -1;
  background-image: var(--app-page-content__background);
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

.banner-link {
  text-decoration: underline;
  cursor: pointer;
}

.banner-unwinded-glp {
  height: 70px;
  text-align: center;
  padding: 0 70px;
}

.top-bar__left-part {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.top-bar__theme-toggle,
.top-bar__app-toggle, {
  margin-left: 24px;
}

.protocol-insurance {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  height: 27px;
  padding: 0 13px;
  margin-left: 14px;
  color: var(--protocol-insurance-text);
  border: 1px solid var(--protocol-insurance-border);
  border-radius: 16px;
  font-size: $font-size-xsm;
  font-weight: 500;
  background-color: var(--protocol-insurance-background);

  .insurance-value {
    color: var(--protocol-insurance-value);
    font-weight: 600;
    margin: 0 6px;
  }
}

</style>
