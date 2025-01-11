import {mapState} from 'vuex';
import config from '@/config';
import {formatUnits} from '../utils/calculate';
import {handleCall, handleTransaction, isOracleError, isPausedError} from '../utils/blockchain';
import Vue from 'vue';
import {token} from '@redstone-finance/evm-connector/dist/typechain-types/@openzeppelin/contracts';

export default {
  methods: {
    toHex(dec) {
      return '0x' + dec.toString(16);
    },

    toDec(hex) {
      return parseInt(hex, 16);
    },

    formatTokenBalance(value, precision = 5, toFixed = false) {
      const balanceOrderOfMagnitudeExponent = String(value).split('.')[0].length - 1;
      const precisionMultiplierExponent = precision - balanceOrderOfMagnitudeExponent;
      const precisionMultiplier = Math.pow(10, precisionMultiplierExponent >= 0 ? precisionMultiplierExponent : 0);
      if (value !== null) {
        if (!toFixed) {
          return String(Math.round(value * precisionMultiplier) / precisionMultiplier);
        } else {
          return (Math.round(value * precisionMultiplier) / precisionMultiplier).toFixed(precision).replace(/([0-9]+(\.[0-9]+[1-9])?)(\.?0+$)/, '$1');
        }
      } else {
        return '';
      }
    },

    formatTokenBalanceWithLessThan(value, precision = 5, toFixed = false) {
      const formatted = this.formatTokenBalance(value, precision, toFixed)
      if (formatted === '0' && value !== '0.0' && value !== 0 && value !== '0') {
        return `<0.${'0'.repeat(precision - 1)}1`
      } else {
        return formatted
      }
    },

    formatLongNum(value) {
      if (!value) return 0;
      if (value < 1000) {
        return value;
      } else if (value < 1000000) {
        return `${(value / 1000).toFixed()}k`;
      } else {
        return `${(value / 1000000).toFixed()}M`;
      }
    },

    formatTvl(value) {
      if (!value) return 0;
      if (value < 1000000) {
        return `$${(value / 1000).toFixed()}k`
      } else {
        return `$${(value / 1000000).toFixed()}M`;
      }
    },

    formatPercent(value, decimalPlaces = 2) {
      const multiplier = Math.pow(10, decimalPlaces);
      return `${Math.round(value * multiplier * 100) / multiplier}%`;
    },

    async handleTransaction(fun, args, onSuccess, onFail) {
      if (!onFail) onFail = async (e) => await this.handleError(e);
      return await handleTransaction(fun, args, onSuccess, onFail);
    },
    async handleCall(fun, args, onSuccess, onFail) {
      if (!onFail) onFail = async (e) => await this.handleError(e);
      return await handleCall(fun, args, onSuccess, onFail);
    },
    async handleError(e) {
      if (isPausedError(e)) this.$store.commit('fundsStore/setProtocolPaused', true);
      if (isOracleError(e)) this.$store.commit('fundsStore/setOracleError', true);
    },
    acceptableSlippage(slippage) {
      return acceptableSlippage(slippage);
    },
    logoSrc(asset) {
      asset = asset ? asset : 'avax';
      const assetData = config.ASSETS_CONFIG[asset]
          ? config.ASSETS_CONFIG[asset]
          : config.LP_ASSETS_CONFIG[asset]
          ? config.LP_ASSETS_CONFIG[asset]
          : config.GMX_V2_ASSETS_CONFIG[asset]
          ? config.GMX_V2_ASSETS_CONFIG[asset]
          : config.GMX_V2_ASSETS_CONFIG[asset];

      if (assetData) {
        return `src/assets/logo/${asset.toLowerCase()}.${assetData.logoExt ? assetData.logoExt : 'svg'}`;
      }
    },

    openModal(component) {
      const modal = Vue.extend(component);
      const instance = new modal();
      instance.$mount();
      document.body.appendChild(instance.$el);
      document.body.style.maxHeight = '100vh';
      document.body.style.overflow = 'hidden';
      return instance;
    },

    closeModal() {
      const modalComponent = document.getElementById('modal');
      if (modalComponent) {
        document.body.removeChild(modalComponent);
        document.body.style.maxHeight = 'unset';
        document.body.style.overflow = 'unset';
      }
    },

    getAssetIcon(assetSymbol) {
      const asset = config.ASSETS_CONFIG[assetSymbol];
      return `src/assets/logo/${assetSymbol.toLowerCase()}.${asset.logoExt ? asset.logoExt : 'svg'}`;
    },

    getIcon(assetSymbol, extension) {
      return `src/assets/logo/${assetSymbol.toLowerCase()}.${extension}`;
    },

    async getWalletTokenBalance(account, assetSymbol, tokenContract, decimals) {
      const walletAssetBalanceResponse = await tokenContract.balanceOf(account.toLowerCase());

      return formatUnits(walletAssetBalanceResponse, decimals);
      },
  },
  computed: {
    ...mapState('network', ['provider', 'avaxPrice']),
    isMobile() {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },
    minAllowedHealth() {
      return config.MIN_ALLOWED_HEALTH;
    },
    nullAddress() {
      return '0x0000000000000000000000000000000000000000';
    }
  },
  data() {
    return {};
  }
};
