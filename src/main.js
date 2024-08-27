// The Vue build version to load with the `import` command
// (runtime-only or standalone) has been set in webpack.base.conf with an alias.
import Vue from 'vue';
import App from './App';
import router from './router';
import Vue2Filters from 'vue2-filters';
import store from './store';
import globalMixin from './mixins/global';
import setupFilters from './utils/filters';
import VueLoadersBallBeat from 'vue-loaders/dist/loaders/ball-beat';
import Toast from 'vue-toastification';
import 'vue-loaders/dist/vue-loaders.css';
import 'vue-toastification/dist/index.css';
import './styles/overrides.scss';
import VTooltip from 'v-tooltip';
import config from './config';
import ConfigAvalanche from './configAvalanche';
import ConfigAvalancheDegen from './configAvalancheDegen';
import ConfigArbitrumDegen from './configArbitrumDegen';
import ConfigArbitrum from './configArbitrum';
import {BehaviorSubject} from 'rxjs';
const RPC_ERROR_FALLBACK_DURATION_MINS = 15

if (window.ethereum) {
  window.chain$ = new BehaviorSubject({});
  window.ethereum.request({method: 'eth_chainId'}).then((id) => {
    const chainId = parseInt(id, 16);
    if (process.env.DEGEN_MODE) {
      document.documentElement.classList.add('theme--dark')
      document.documentElement.classList.add('theme--degen')
    }
    switch (chainId) {
      case 43114: {
        window.chain = 'avalanche';
        window.chain$.next('avalanche');
        Object.assign(config, ConfigAvalanche);
        Object.assign(config, process.env.DEGEN_MODE ? ConfigAvalancheDegen : ConfigAvalanche);
        setupRpc();
        break;
      }
      case 42161: {
        window.chain = 'arbitrum';
        window.chain$.next('arbitrum');
        Object.assign(config, ConfigArbitrum);
        Object.assign(config, process.env.DEGEN_MODE ? ConfigArbitrumDegen : ConfigArbitrum);
        break;
      }
    }

    setupApp();
  })
} else {
  console.error('No wallet installed');
  window.chain = 'avalanche';
  window.noWalletInstalled = true;
  setupApp();
}

function setupRpc() {
  const rpcErrorDataString = localStorage.getItem('RPC_ERROR_DATA');
  if (rpcErrorDataString) {
    const now = new Date();
    const rpcErrorData = JSON.parse(rpcErrorDataString);
    const rpcFallbackValidTill = new Date(new Date(rpcErrorData.errorDate).getTime() + (RPC_ERROR_FALLBACK_DURATION_MINS * 60000));
    console.log(rpcFallbackValidTill);
    if (rpcFallbackValidTill.getTime() > now.getTime()) {
      config.readRpcUrl = rpcErrorData.nextRpcToTry;
    } else {
      localStorage.removeItem('RPC_ERROR_DATA');
    }
  }
}

function setupApp() {
  Vue.config.productionTip = false;

  Vue.use(Vue2Filters);
  Vue.use(VueLoadersBallBeat);
  Vue.use(Toast);
  Vue.use(VTooltip, {
    defaultPlacement: 'bottom',
    autoHide: false
  });

  Vue.mixin(globalMixin);

// notifi modal close on outside click
  let handleOutsideClick;
  Vue.directive('closable', {
    bind(el, binding, vnode, prevVnode) {
      handleOutsideClick = (e) => {
        e.stopPropagation();

        const {handler, exclude} = binding.value;
        let clickedOnExcludedEl = false;

        exclude.forEach(refName => {
          if (!clickedOnExcludedEl) {
            const excludedEl = vnode.context.$refs[refName];
            clickedOnExcludedEl = excludedEl && excludedEl.$el.contains(e.target);
          }
        });

        if (!el.contains(e.target) && !clickedOnExcludedEl) {
          vnode.context[handler]();
        }
      };
      document.addEventListener('click', handleOutsideClick);
      // document.addEventListener('touchstart', handleOutsideClick); // for mobile
    },

    unbind() {
      document.removeEventListener('click', handleOutsideClick);
      // document.removeEventListener('touchstart', handleOutsideClick); // for mobile
    }
  });

  setupFilters();

  /* eslint-disable no-new */
  new Vue({
    el: '#app',
    store,
    router,
    template: '<App/>',
    components: {App}
  });
}
