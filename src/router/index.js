import Vue from 'vue'
import Router from 'vue-router'
import PrimeAccount from '../pages/PrimeAccount';
import PoolsBeta from '../components/PoolsBeta';
import ProtocolStats from '../components/ProtocolStats';


Vue.use(Router)


export default new Router({
  routes: [
    {
      path: '/pools',
      name: 'Pools',
      component: PoolsBeta
    },
    {
      path: '/prime-account',
      name: 'Prime Account',
      component: PrimeAccount,
      children: [
        {
          name: 'Prime Account Assets',
          path: 'assets'
        },
        {
          name: 'Prime Account Farms',
          path: 'farms'
        },
      ]
    },
    {
      path: '/protocol',
      name: 'Protocol',
      component: ProtocolStats
    },
    {
      path: '*',
      redirect: { name: 'Prime Account Assets' }
    },
  ]
})
