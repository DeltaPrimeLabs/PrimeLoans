import Vue from 'vue';
import Vuex from 'vuex';

import network from './network';
import nft from './nft';
import fundsStore from './fundsStore';
import poolStore from './poolStore';
import stakeStore from './stakeStore';
import serviceRegistry from './serviceRegistry';

Vue.use(Vuex);

export default new Vuex.Store({
  modules: {
    network,
    nft,
    fundsStore,
    poolStore,
    stakeStore,
    serviceRegistry
  },
});
