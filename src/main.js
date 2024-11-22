// The Vue build version to load with the `import` command
// (runtime-only or standalone) has been set in webpack.base.conf with an alias.
import Vue from 'vue'
import App from './App'
import router from './router'
import Vue2Filters from 'vue2-filters'
import store from './store';
import globalMixin from './mixins/global';
import setupFilters from './utils/filters';
import VueLoadersBallBeat from 'vue-loaders/dist/loaders/ball-beat';
import Toast from "vue-toastification";
import 'vue-loaders/dist/vue-loaders.css';
import "vue-toastification/dist/index.css";
import "./styles/overrides.scss";
import VTooltip from "v-tooltip";

Vue.config.productionTip = false;

Vue.use(Vue2Filters);
Vue.use(VueLoadersBallBeat);
Vue.use(Toast);
Vue.use(VTooltip, {
  defaultPlacement: 'bottom',
  autoHide: false
});

Vue.mixin(globalMixin);

setupFilters();

/* eslint-disable no-new */
new Vue({
  el: '#app',
  store,
  router,
  template: '<App/>',
  components: {App}
})
